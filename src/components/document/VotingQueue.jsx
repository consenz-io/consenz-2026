/**
 * VotingQueue - manages and throttles voting operations
 * Prevents rate limit errors when voting on multiple suggestions
 */

class VotingQueue {
  constructor(concurrency = 2, delayBetweenRequests = 500) {
    this.queue = [];
    this.active = 0;
    this.concurrency = concurrency;
    this.delayBetweenRequests = delayBetweenRequests;
  }

  async add(voteFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ voteFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.active >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.active++;
    const { voteFn, resolve, reject } = this.queue.shift();

    try {
      const result = await voteFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.active--;
      // Add delay between requests
      await new Promise(r => setTimeout(r, this.delayBetweenRequests));
      this.process();
    }
  }
}

// Export a global instance
export const votingQueue = new VotingQueue(2, 500);