// Server-side points economy helpers. All points mutations MUST go through
// these helpers (called from backend functions via asServiceRole) — never
// trust client-supplied points values or userId. The client-side
// updateMe/PointsTransaction.create pattern is insecure and has been removed.
//
// Atomicity: the platform does not allow User.updateMany, so points mutations
// are serialized per-user via an in-process mutex (withUserLock). This closes
// the TOCTOU window where two concurrent spends both read the same
// pre-deduction balance and both pass the balance check. Only fixed amounts
// are ever written (never a caller-supplied absolute balance), so a caller
// cannot set another user's points to an arbitrary value.

// Server-side cost map — the client cannot override these values.
export const POINTS_COSTS = {
  edit_section: 200,
  new_section: 350,
  edit_topic: 100,
};

// Per-user in-process mutex. The platform forbids User.updateMany, so we
// cannot make the deduction conditional at the database level. Instead we
// serialize all points read-then-write operations for the same user within
// this isolate so that a concurrent spend cannot read a stale pre-deduction
// balance. Entries are tiny resolved promises bounded by the number of
// unique users, so no cleanup is needed.
const userLocks = new Map<string, Promise<void>>();

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) ?? Promise.resolve();
  // Run fn after the previous operation settles, regardless of its outcome.
  const run = prev.then(fn, fn) as Promise<T>;
  // Store a void promise that settles when run settles, so the next caller
  // waits for this operation to finish.
  userLocks.set(userId, run.then(() => undefined, () => undefined));
  return run;
}

/**
 * Atomically deduct points from a user if they have sufficient balance.
 * Serialized per-user via withUserLock to prevent TOCTOU race conditions.
 * Returns { success: true } or { error: 'INSUFFICIENT_POINTS' }.
 */
export async function spendPointsAtomic(
  serviceBase44,
  userId,
  cost,
  action,
  description,
  relatedEntityId,
  relatedEntityType
) {
  if (cost <= 0) return { success: true };

  return withUserLock(userId, async () => {
    // User.updateMany is not allowed by the platform ("Bulk user update not
    // allowed"), so we read-then-write. The per-user mutex (withUserLock)
    // serializes concurrent calls so two spends cannot both read the same
    // pre-deduction balance and both pass the check.
    const users = await serviceBase44.entities.User.filter({ id: userId });
    const user = users[0];
    if (!user) return { error: "INSUFFICIENT_POINTS" };

    const currentPoints = user.points ?? 1000;
    if (currentPoints < cost) return { error: "INSUFFICIENT_POINTS" };

    await serviceBase44.entities.User.update(userId, {
      points: currentPoints - cost,
    });

    await serviceBase44.entities.PointsTransaction.create({
      userId,
      amount: -cost,
      action,
      description,
      relatedEntityId: relatedEntityId || null,
      relatedEntityType: relatedEntityType || null,
    });

    return { success: true };
  });
}

/**
 * Atomically add points to a user (refund or award). Serialized per-user via
 * withUserLock to prevent TOCTOU race conditions. Only fixed amounts are
 * written, so the caller cannot set an arbitrary balance.
 */
export async function addPointsAtomic(
  serviceBase44,
  userId,
  amount,
  action,
  description,
  relatedEntityId,
  relatedEntityType
) {
  if (amount <= 0) return { success: true };

  return withUserLock(userId, async () => {
    // User.updateMany is not allowed by the platform, so read-then-write.
    // The per-user mutex (withUserLock) serializes concurrent calls so two
    // awards cannot both read the same pre-increment balance.
    const users = await serviceBase44.entities.User.filter({ id: userId });
    const user = users[0];
    if (!user) return { success: true };

    const currentPoints = user.points ?? 1000;
    await Promise.all([
      serviceBase44.entities.User.update(userId, {
        points: currentPoints + amount,
      }),
      serviceBase44.entities.PointsTransaction.create({
        userId,
        amount,
        action,
        description,
        relatedEntityId: relatedEntityId || null,
        relatedEntityType: relatedEntityType || null,
      }),
    ]);

    return { success: true };
  });
}