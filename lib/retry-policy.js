/**
 * RetryPolicy - Configurable retry with exponential backoff
 */

class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} - Function result
   * @throws {Error} - Last error if all retries fail
   */
  async execute(fn) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          const delay = this._calculateDelay(attempt);
          await this._sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate delay for given attempt using exponential backoff
   * @private
   */
  _calculateDelay(attempt) {
    const delay = this.baseDelayMs * Math.pow(this.backoffMultiplier, attempt);
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Sleep for given milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { RetryPolicy };
