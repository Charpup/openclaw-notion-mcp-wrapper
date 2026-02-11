/**
 * HealthMonitor - Continuous health checking with automatic recovery detection
 */

const { EventEmitter } = require('events');

class HealthMonitor extends EventEmitter {
  constructor(client, options = {}) {
    super();
    this.client = client;
    this.checkIntervalMs = options.checkIntervalMs ?? 5000;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this._isRunning = false;
    this._isHealthy = false;
    this._lastLatency = null;
    this._intervalId = null;
  }

  /**
   * Start periodic health checks
   */
  start() {
    if (this._isRunning) return;
    
    this._isRunning = true;
    this._checkHealth(); // Immediate first check
    this._intervalId = setInterval(() => this._checkHealth(), this.checkIntervalMs);
  }

  /**
   * Stop health checks
   */
  stop() {
    if (!this._isRunning) return;
    
    this._isRunning = false;
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Get current health status
   * @returns {boolean}
   */
  isHealthy() {
    return this._isHealthy;
  }

  /**
   * Check if monitoring is running
   * @returns {boolean}
   */
  isRunning() {
    return this._isRunning;
  }

  /**
   * Get last check latency
   * @returns {number|null}
   */
  getLastLatency() {
    return this._lastLatency;
  }

  /**
   * Perform single health check
   * @private
   */
  async _checkHealth() {
    const startTime = Date.now();
    
    try {
      // Use a lightweight operation for health check
      await this._ping();
      
      const latency = Date.now() - startTime;
      this._lastLatency = latency;
      
      const wasHealthy = this._isHealthy;
      this._isHealthy = true;
      
      if (!wasHealthy) {
        this.emit('healthChange', { healthy: true, latency });
      }
    } catch (error) {
      this._isHealthy = false;
      this._lastLatency = null;
      
      this.emit('healthChange', { healthy: false });
      this.emit('recoveryNeeded', { reason: error.message });
    }
  }

  /**
   * Ping MCP server with timeout
   * @private
   */
  async _ping() {
    // Try to call a lightweight tool
    return Promise.race([
      this.client.callTool('API-retrieve-a-page', { page_id: 'test' }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), this.timeoutMs)
      )
    ]);
  }
}

module.exports = { HealthMonitor };
