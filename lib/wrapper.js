/**
 * NotionMCPWrapper - Main entry point combining all features
 * Production-ready MCP wrapper with health monitoring, retry, and fallback
 */

const { MCPClient } = require('./mcp-client');
const { HealthMonitor } = require('./health-monitor');
const { RetryPolicy } = require('./retry-policy');
const { FallbackStrategy } = require('./fallback-strategy');

class NotionMCPWrapper {
  constructor(options = {}) {
    this.options = {
      enableHealthMonitor: options.enableHealthMonitor ?? true,
      enableRetry: options.enableRetry ?? true,
      enableFallback: options.enableFallback ?? true,
      retryOptions: options.retryOptions ?? {},
      healthOptions: options.healthOptions ?? {},
      clientOptions: options.clientOptions ?? {}
    };

    this.client = new MCPClient(this.options.clientOptions);
    this.healthMonitor = null;
    this.retryPolicy = null;
    this.fallbackStrategy = null;
    
    this._setupComponents();
  }

  /**
   * Setup components based on options
   * @private
   */
  _setupComponents() {
    if (this.options.enableHealthMonitor) {
      this.healthMonitor = new HealthMonitor(this.client, this.options.healthOptions);
      this.healthMonitor.on('recoveryNeeded', ({ reason }) => {
        console.log('[NotionMCPWrapper] Recovery needed:', reason);
      });
    }

    if (this.options.enableRetry) {
      this.retryPolicy = new RetryPolicy(this.options.retryOptions);
    }

    if (this.options.enableFallback) {
      this.fallbackStrategy = new FallbackStrategy();
    }
  }

  /**
   * Initialize all components
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async start() {
    try {
      await this.client.connect();
      
      if (this.healthMonitor) {
        this.healthMonitor.start();
      }

      console.log('[NotionMCPWrapper] ✓ Started successfully');
      return { success: true };
    } catch (error) {
      console.error('[NotionMCPWrapper] Failed to start:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute operation with retry and fallback
   * @param {string} operation - Operation name (movePage, getPage, etc.)
   * @param {object} params - Operation parameters
   * @returns {Promise<{success: boolean, data?: any, source?: string, error?: string}>}
   */
  async execute(operation, params) {
    // Map operation to MCP tool name
    const toolName = this._getToolName(operation);
    if (!toolName) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    // Execute with retry if enabled
    const executeFn = async () => {
      return this._executeWithMCP(toolName, params);
    };

    try {
      let result;
      
      if (this.retryPolicy) {
        result = await this.retryPolicy.execute(executeFn);
      } else {
        result = await executeFn();
      }

      return { success: true, data: result, source: 'mcp' };
    } catch (error) {
      // Try fallback if enabled and operation is supported
      if (this.fallbackStrategy && this.fallbackStrategy.getSupportedOperations().includes(operation)) {
        console.log(`[NotionMCPWrapper] MCP failed, using fallback: ${error.message}`);
        return this._executeWithFallback(operation, params);
      }
      
      throw error;
    }
  }

  /**
   * Execute via MCP
   * @private
   */
  async _executeWithMCP(toolName, params) {
    console.log(`[NotionMCPWrapper] Executing via MCP: ${toolName}`);
    return this.client.callTool(toolName, params);
  }

  /**
   * Execute via fallback
   * @private
   */
  async _executeWithFallback(operation, params) {
    try {
      const result = await this.fallbackStrategy.execute(operation, params);
      return { success: true, data: result, source: 'fallback' };
    } catch (error) {
      throw new Error(`Fallback also failed: ${error.message}`);
    }
  }

  /**
   * Get MCP tool name for operation
   * @private
   */
  _getToolName(operation) {
    const toolMap = {
      'movePage': 'API-move-page',
      'getPage': 'API-retrieve-a-page',
      'updatePage': 'API-patch-page',
      'createPage': 'API-post-page',
      'deletePage': 'API-delete-a-block',
      'getBlockChildren': 'API-get-block-children',
      'appendBlocks': 'API-patch-block-children',
      'queryDatabase': 'API-query-data-source',
      'search': 'API-post-search'
    };
    return toolMap[operation];
  }

  /**
   * Cleanup all resources
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }
    this.client.disconnect();
    console.log('[NotionMCPWrapper] ✓ Stopped');
  }
}

module.exports = { NotionMCPWrapper };
