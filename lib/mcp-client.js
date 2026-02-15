/**
 * MCPClient - Manages MCP protocol communication via stdio
 * Fixed version with improved timeout handling, retry logic, and race condition fixes
 */

const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class MCPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.isReady = false;
    
    // Increased default timeouts to handle slow npx startup
    this.initializeTimeoutMs = options.initializeTimeoutMs ?? 30000; // 30s default (was 10s)
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30000;
    
    // Retry configuration
    this.maxConnectionRetries = options.maxConnectionRetries ?? 3;
    this.connectionRetryDelayMs = options.connectionRetryDelayMs ?? 2000;
    
    this.buffer = '';
    this._connecting = false;
    this._connectionPromise = null;
  }

  /**
   * Spawn MCP server and initialize connection with retry logic
   * @returns {Promise<void>}
   * @throws {Error} If connection fails or token is missing
   */
  async connect() {
    // Prevent concurrent connection attempts
    if (this._connecting && this._connectionPromise) {
      return this._connectionPromise;
    }
    
    if (this.process) return;

    this._connecting = true;
    this._connectionPromise = this._connectWithRetry();
    
    try {
      await this._connectionPromise;
    } finally {
      this._connecting = false;
      this._connectionPromise = null;
    }
  }

  /**
   * Connect with retry logic
   * @private
   */
  async _connectWithRetry() {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxConnectionRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[MCPClient] Connection retry attempt ${attempt + 1}/${this.maxConnectionRetries}...`);
          await this._sleep(this.connectionRetryDelayMs * attempt); // Exponential backoff
        }
        
        return await this._attemptConnection();
      } catch (error) {
        lastError = error;
        console.error(`[MCPClient] Connection attempt ${attempt + 1} failed:`, error.message);
        
        // Clean up before retry
        this._cleanup();
      }
    }
    
    throw new Error(`Failed to connect after ${this.maxConnectionRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Single connection attempt
   * @private
   */
  async _attemptConnection() {
    const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
    if (!NOTION_TOKEN) {
      throw new Error('NOTION_TOKEN or NOTION_API_KEY environment variable required');
    }

    return new Promise((resolve, reject) => {
      let timeoutId;
      let isResolved = false;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      const safeResolve = () => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve();
        }
      };
      
      const safeReject = (error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      try {
        this.process = spawn('npx', ['-y', '@notionhq/notion-mcp-server'], {
          env: { 
            ...process.env, 
            NOTION_TOKEN
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle spawn errors immediately
        this.process.on('error', (error) => {
          console.error('[MCP] Spawn error:', error.message);
          safeReject(new Error(`Failed to spawn MCP server: ${error.message}`));
        });

        this._setupProcessHandlers(safeReject);
        
        // Setup timeout after handlers are in place
        timeoutId = setTimeout(() => {
          safeReject(new Error(`MCP initialization timeout (${this.initializeTimeoutMs}ms)`));
        }, this.initializeTimeoutMs);

        // Setup initialized listener BEFORE sending request
        this.once('initialized', () => {
          this.isReady = true;
          safeResolve();
        });

        // Send initialize request after listeners are ready
        this._sendRequest({
          jsonrpc: '2.0',
          id: ++this.requestId,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'notion-mcp-wrapper',
              version: '2.0.0'
            }
          }
        });
        
      } catch (error) {
        safeReject(error);
      }
    });
  }

  /**
   * Setup stdout/stderr/close handlers
   * @private
   */
  _setupProcessHandlers(rejectFn) {
    this.process.stdout.on('data', (data) => this._handleStdout(data));
    
    this.process.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      // Only log actual errors, not info messages
      if (msg.includes('Error') || msg.includes('error') || msg.includes('Failed')) {
        console.error('[MCP stderr]:', msg);
      }
    });

    this.process.on('close', (code) => {
      console.log(`[MCP] Process exited with code ${code}`);
      this._resetState();
      this.emit('disconnected', { code });
    });
  }

  /**
   * Handle stdout data with line buffering
   * @private
   */
  _handleStdout(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (line.trim()) {
        this._handleMessage(line.trim());
      }
    }
  }

  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(line) {
    try {
      const msg = JSON.parse(line);

      // Handle initialize response (id should be 1 for first request)
      if (msg.id === 1 && msg.result) {
        this._sendNotification({
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        });
        this.emit('initialized');
        return;
      }

      // Handle response to pending request
      if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
        const { resolve, reject } = this.pendingRequests.get(msg.id);
        this.pendingRequests.delete(msg.id);

        if (msg.error) {
          reject(new Error(msg.error.message || 'MCP Error'));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      // Ignore non-JSON output
    }
  }

  /**
   * Send JSON-RPC request
   * @private
   */
  _sendRequest(request) {
    if (!this.process) {
      throw new Error('Not connected');
    }
    this.process.stdin.write(JSON.stringify(request) + '\n');
  }

  /**
   * Send JSON-RPC notification
   * @private
   */
  _sendNotification(notification) {
    if (!this.process) return;
    this.process.stdin.write(JSON.stringify(notification) + '\n');
  }

  /**
   * Call an MCP tool
   * @param {string} toolName - Tool name (e.g., 'API-move-page')
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} - Parsed tool result
   */
  async callTool(toolName, args) {
    if (!this.isReady) {
      await this.connect();
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    };

    return new Promise((resolve, reject) => {
      let timeoutId;
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
      };
      
      this.pendingRequests.set(id, { 
        resolve: (result) => { cleanup(); resolve(result); },
        reject: (error) => { cleanup(); reject(error); }
      });
      
      this._sendRequest(request);

      // Set request timeout
      timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout (${this.requestTimeoutMs}ms)`));
        }
      }, this.requestTimeoutMs);
    }).then(result => this._parseResult(result));
  }

  /**
   * Parse tool result
   * @private
   */
  _parseResult(result) {
    if (!result || !result.content) {
      return result;
    }

    const textContent = result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    try {
      return JSON.parse(textContent);
    } catch (e) {
      return { text: textContent };
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this._cleanup();
  }
  
  /**
   * Clean up resources without full reset
   * @private
   */
  _cleanup() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {
        // Ignore kill errors
      }
    }
    this._resetState();
  }

  /**
   * Reset internal state
   * @private
   */
  _resetState() {
    this.process = null;
    this.isReady = false;
    this.pendingRequests.clear();
    this.buffer = '';
    this._connecting = false;
    this._connectionPromise = null;
  }
  
  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { MCPClient };
