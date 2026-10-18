import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { addPointsAtomic, spendPointsAtomic } from '../../shared/pointsOperations.ts';

// Processes points operations for admin users. Each operation is routed
// through the shared atomic helpers (addPointsAtomic / spendPointsAtomic)
// which serialize per-user via a mutex (preventing TOCTOU races) and create
// a PointsTransaction audit record.
//
// AUTH: admin-only.
//
// The previous version had two problems:
// 1. The `processImmediate` path did a raw User.update with any caller-
//    supplied userId + amount — no cap, no idempotency, no mutex — so a
//    compromised admin session could inflate any user's points to any value.
// 2. The queued path was dead code: the setInterval grouped operations but
//    never wrote to the DB, silently dropping every queued operation.
//
// Caps: max 50 operations per call, max 1000 points per single operation.

const MAX_OPERATIONS_PER_CALL = 50;
const MAX_AMOUNT_PER_OPERATION = 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { operations } = body;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return Response.json({ error: 'Missing or invalid operations array' }, { status: 400 });
    }
    if (operations.length > MAX_OPERATIONS_PER_CALL) {
      return Response.json({ error: `Too many operations: max ${MAX_OPERATIONS_PER_CALL} per call` }, { status: 400 });
    }

    // Validate each operation and cap amounts before processing
    for (const op of operations) {
      if (!op.userId || !op.action || typeof op.amount !== 'number') {
        return Response.json({ error: 'Each operation requires userId, action, and amount' }, { status: 400 });
      }
      if (Math.abs(op.amount) > MAX_AMOUNT_PER_OPERATION) {
        return Response.json({ error: `Amount exceeds cap: max ${MAX_AMOUNT_PER_OPERATION} per operation` }, { status: 400 });
      }
    }

    const serviceBase44 = base44.asServiceRole;
    const results = [];

    for (const op of operations) {
      const { userId, amount, action, description, relatedEntityId, relatedEntityType } = op;
      const desc = description || `${action}: ${amount}`;

      if (amount > 0) {
        await addPointsAtomic(
          serviceBase44, userId, amount, action, desc,
          relatedEntityId, relatedEntityType
        );
        results.push({ userId, amount, result: 'ok' });
      } else if (amount < 0) {
        const result = await spendPointsAtomic(
          serviceBase44, userId, Math.abs(amount), action, desc,
          relatedEntityId, relatedEntityType
        );
        results.push({ userId, amount, result: result.error || 'ok' });
      }
    }

    const processed = results.filter(r => r.result === 'ok').length;
    return Response.json({
      success: true,
      processed,
      results,
    });
  } catch (error) {
    console.error('[POINTS QUEUE ERROR]', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}