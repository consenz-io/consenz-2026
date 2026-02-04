/**
 * Notification queue to prevent rate limiting
 * Queues notifications and sends them with throttling
 */

class NotificationQueue {
  constructor(maxConcurrent = 3, delayBetweenBatches = 2000) {
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = maxConcurrent; // Max notifications to send at once
    this.delayBetweenBatches = delayBetweenBatches; // Delay between batches in ms
    this.inProgressCount = 0;
  }

  async add(notificationFn) {
    this.queue.push(notificationFn);
    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      // Take next batch
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      // Execute batch in parallel
      await Promise.all(batch.map(fn => 
        fn().catch(err => {
          console.error('[NOTIFICATION QUEUE] Error:', err);
          // Don't throw - continue processing other notifications
        })
      ));

      // Delay before next batch (unless queue is empty)
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    this.processing = false;
  }

  size() {
    return this.queue.length;
  }
}

// Global queue instance
export const notificationQueue = new NotificationQueue(
  3,    // Max 3 concurrent notifications
  1500  // 1.5 second delay between batches
);