/**
 * Unit Tests - MCPClient
 * Tests MCP protocol communication
 */

const { spawn } = require('child_process');
const { MCPClient } = require('../../lib/mcp-client');

// Mock child_process
jest.mock('child_process');

describe('MCPClient', () => {
  let client;
  let mockProcess;
  let stdoutCallbacks = [];
  let stderrCallbacks = [];
  let closeCallbacks = [];

  beforeEach(() => {
    stdoutCallbacks = [];
    stderrCallbacks = [];
    closeCallbacks = [];

    mockProcess = {
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn((event, cb) => stdoutCallbacks.push(cb)) },
      stderr: { on: jest.fn((event, cb) => stderrCallbacks.push(cb)) },
      on: jest.fn((event, cb) => closeCallbacks.push(cb)),
      kill: jest.fn()
    };

    spawn.mockReturnValue(mockProcess);
    process.env.NOTION_TOKEN = 'test-token';
    
    client = new MCPClient();
  });

  afterEach(() => {
    client.disconnect();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    test('TC-001: Successful connection', async () => {
      const connectPromise = client.connect();

      // Simulate successful initialize response
      setTimeout(() => {
        stdoutCallbacks[0](Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05' }
        }) + '\n'));
      }, 10);

      await connectPromise;
      
      expect(spawn).toHaveBeenCalledWith(
        'npx',
        ['-y', '@notionhq/notion-mcp-server'],
        expect.objectContaining({
          env: expect.objectContaining({ NOTION_TOKEN: 'test-token' }),
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
      expect(client.isReady).toBe(true);
    });

    test('TC-002: Missing token', async () => {
      delete process.env.NOTION_TOKEN;
      delete process.env.NOTION_API_KEY;
      
      await expect(client.connect()).rejects.toThrow('NOTION_TOKEN');
    });

    test('handles initialization timeout', async () => {
      const connectPromise = client.connect();
      
      // Don't send initialize response
      await expect(connectPromise).rejects.toThrow('initialization timeout');
    });
  });

  describe('callTool', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      
      setTimeout(() => {
        stdoutCallbacks[0](Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05' }
        }) + '\n'));
      }, 10);

      await connectPromise;
    });

    test('TC-003: Call move-page tool', async () => {
      const callPromise = client.callTool('API-move-page', {
        page_id: 'test-page-id',
        parent: { page_id: 'test-parent-id' }
      });

      // Get the request ID from the call
      const writeCall = mockProcess.stdin.write.mock.calls.find(
        call => call[0].includes('tools/call')
      );
      const request = JSON.parse(writeCall[0].trim());

      // Simulate tool response
      setTimeout(() => {
        stdoutCallbacks[0](Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: '{"object": "page", "id": "test-page-id"}' }]
          }
        }) + '\n'));
      }, 10);

      const result = await callPromise;
      
      expect(result).toEqual({
        object: 'page',
        id: 'test-page-id'
      });
    });

    test('handles tool error', async () => {
      const callPromise = client.callTool('API-move-page', {});

      const writeCall = mockProcess.stdin.write.mock.calls.find(
        call => call[0].includes('tools/call')
      );
      const request = JSON.parse(writeCall[0].trim());

      setTimeout(() => {
        stdoutCallbacks[0](Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { message: 'Invalid page_id' }
        }) + '\n'));
      }, 10);

      await expect(callPromise).rejects.toThrow('Invalid page_id');
    });
  });

  describe('disconnect', () => {
    test('kills process and resets state', async () => {
      await client.connect();
      
      setTimeout(() => {
        stdoutCallbacks[0](Buffer.from(JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05' }
        }) + '\n'));
      }, 10);

      await new Promise(r => setTimeout(r, 50));
      
      client.disconnect();
      
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(client.isReady).toBe(false);
      expect(client.process).toBeNull();
    });
  });
});
