/**
 * MCPClient - Manages MCP protocol communication via stdio
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
    this.initializeTimeoutMs = options.initializeTimeoutMs ?? 10000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30000;
    this.buffer = '';
  }

  /**
   * Spawn MCP server and initialize connection
   * @returns {Promise<void>}
   * @throws {Error} If connection fails or token is missing
   */
  async connect() {
    if (this.process) return;

    const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
    if (!NOTION_TOKEN) {
      throw new Error('NOTION_TOKEN or NOTION_API_KEY environment variable required');
    }

    this.process = spawn('npx', ['-y', '@notionhq/notion-mcp-server'], {
      env: { 
        ...process.env, 
        NOTION_TOKEN
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this._setupProcessHandlers();
    
    await this._initialize();
  }

  /**
   * Setup stdout/stderr/close handlers
   * @private
   */
  _setupProcessHandlers() {
    this.process.stdout.on('data', (data) => this._handleStdout(data));
    
    this.process.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.includes('Error') || msg.includes('error')) {
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
   * Initialize MCP connection
   * @private
   */
  async _initialize() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP initialization timeout'));
      }, this.initializeTimeoutMs);

      this.once('initialized', () => {
        clearTimeout(timeout);
        this.isReady = true;
        resolve();
      });

      // Send initialize request
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
    });
  }

  /**
   * Handle incoming message
   * @private
   */
  _handleMessage(line) {
    try {
      const msg = JSON.parse(line);

      // Handle initialize response
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
      this.pendingRequests.set(id, { resolve, reject });
      this._sendRequest(request);

      // Set request timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
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
    if (this.process) {
      this.process.kill();
      this._resetState();
    }
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
  }
}

module.exports = { MCPClient };
