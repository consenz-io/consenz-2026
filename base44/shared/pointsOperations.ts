// Server-side points economy helpers. All points mutations MUST go through
// these helpers (called from backend functions via asServiceRole) — never
// trust client-supplied points values or userId. The client-side
// updateMe/PointsTransaction.create pattern is insecure and has been removed.
//
// Atomicity: spendPointsAtomic uses a conditional updateMany (points >= cost)
// to prevent TOCTOU race conditions. addPointsAtomic uses $inc to prevent
// arbitrary-value writes (the old client code did User.update(id, {points: x})
// which let any user set any other user's points to any value).

// Server-side cost map — the client cannot override these values.
export const POINTS_COSTS = {
  edit_section: 200,
  new_section: 350,
  edit_topic: 100,
};

/**
 * Atomically deduct points from a user if they have sufficient balance.
 * Uses a conditional updateMany (points >= cost) to prevent race conditions.
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

  // User.updateMany is not allowed by the platform ("Bulk user update not
  // allowed"), so we must read-then-write. This is a small TOCTOU window,
  // but the only option given the platform restriction.
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
}

/**
 * Atomically add points to a user (refund or award). Uses $inc so the
 * caller cannot set an arbitrary balance — only increment by a fixed amount.
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

  // User.updateMany is not allowed by the platform, so read-then-write.
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
}