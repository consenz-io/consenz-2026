import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// In-memory queue for points operations
const pointsQueue = [];
const processing = { active: false };

// Process queue in batches every 3 seconds
setInterval(async () => {
  if (processing.active || pointsQueue.length === 0) return;
  
  processing.active = true;
  const batch = pointsQueue.splice(0, Math.min(50, pointsQueue.length)); // Process up to 50 at once
  
  console.log('[POINTS QUEUE] Processing batch of', batch.length, 'operations');
  
  try {
    // Group by userId for efficient updates
    const userPointsMap = new Map();
    const transactions = [];
    
    for (const op of batch) {
      if (!userPointsMap.has(op.userId)) {
        userPointsMap.set(op.userId, { total: 0, operations: [] });
      }
      const userData = userPointsMap.get(op.userId);
      userData.total += op.amount;
      userData.operations.push(op);
      
      transactions.push({
        userId: op.userId,
        amount: op.amount,
        action: op.action,
        description: op.description,
        relatedEntityId: op.relatedEntityId,
        relatedEntityType: op.relatedEntityType
      });
    }
    
    console.log('[POINTS QUEUE] Grouped into', userPointsMap.size, 'unique users');
    
    // This will be called by backend with proper auth
    // For now, just log the batch
    console.log('[POINTS QUEUE] Batch ready for processing');
    
  } catch (error) {
    console.error('[POINTS QUEUE] Error processing batch:', error);
    // Re-add failed operations to queue
    batch.forEach(op => pointsQueue.push(op));
  } finally {
    processing.active = false;
  }
}, 3000);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { operations, processImmediate = false } = body;

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return Response.json({ error: 'Missing or invalid operations array' }, { status: 400 });
    }

    console.log('[POINTS QUEUE] Received', operations.length, 'operations');

    if (processImmediate) {
      // Process immediately (for critical operations)
      console.log('[POINTS QUEUE] Processing immediately...');
      
      const userPointsMap = new Map();
      const transactions = [];
      
      // Deduplicate and aggregate by user
      for (const op of operations) {
        const key = `${op.userId}-${op.relatedEntityId}-${op.action}`;
        if (!userPointsMap.has(key)) {
          userPointsMap.set(key, op);
          transactions.push({
            userId: op.userId,
            amount: op.amount,
            action: op.action,
            description: op.description,
            relatedEntityId: op.relatedEntityId,
            relatedEntityType: op.relatedEntityType
          });
        }
      }

      // Fetch all users - note: no complex query support, fetch all and filter
      const userIds = [...new Set(transactions.map(t => t.userId))];
      const allUsers = await base44.asServiceRole.entities.User.list();
      const users = allUsers.filter(u => userIds.includes(u.id));
      
      const userUpdates = users.map(user => {
        const userTransactions = transactions.filter(t => t.userId === user.id);
        const totalPoints = userTransactions.reduce((sum, t) => sum + t.amount, 0);
        const newPoints = (user.points || 1000) + totalPoints;
        
        return base44.asServiceRole.entities.User.update(user.id, { points: newPoints });
      });

      await Promise.all([
        ...userUpdates,
        base44.entities.PointsTransaction.bulkCreate(transactions)
      ]);

      return Response.json({ 
        success: true, 
        processed: transactions.length,
        message: `Processed ${transactions.length} points operations`
      });
    } else {
      // Add to queue for batch processing
      operations.forEach(op => pointsQueue.push(op));
      
      return Response.json({ 
        success: true, 
        queued: operations.length,
        message: `Queued ${operations.length} operations for processing`
      });
    }

  } catch (error) {
    console.error('[POINTS QUEUE ERROR]', error);
    return Response.json({ 
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
});