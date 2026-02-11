/**
 * Integration Tests - NotionMCPWrapper
 * Tests component integration and end-to-end workflows
 */

const { NotionMCPWrapper } = require('../../lib/wrapper');
const { MCPClient } = require('../../lib/mcp-client');

jest.mock('../../lib/mcp-client');

describe('NotionMCPWrapper - Integration', () => {
  let wrapper;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      connect: jest.fn().mockResolvedValue(),
      callTool: jest.fn(),
      disconnect: jest.fn(),
      isReady: true
    };

    MCPClient.mockImplementation(() => mockClient);
  });

  describe('start/stop', () => {
    test('initializes all components', async () => {
      wrapper = new NotionMCPWrapper({
        enableHealthMonitor: true,
        enableRetry: true,
        enableFallback: true
      });

      const result = await wrapper.start();

      expect(result.success).toBe(true);
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test('handles initialization failure', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      wrapper = new NotionMCPWrapper();
      const result = await wrapper.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    test('cleans up resources on stop', async () => {
      wrapper = new NotionMCPWrapper();
      await wrapper.start();
      await wrapper.stop();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('execute with MCP', () => {
    beforeEach(async () => {
      wrapper = new NotionMCPWrapper({
        enableFallback: false,
        enableRetry: false
      });
      await wrapper.start();
    });

    test('executes movePage via MCP', async () => {
      mockClient.callTool.mockResolvedValue({
        object: 'page',
        id: 'page-id'
      });

      const result = await wrapper.execute('movePage', {
        page_id: 'page-id',
        parent: { page_id: 'parent-id' }
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('mcp');
      expect(mockClient.callTool).toHaveBeenCalledWith('API-move-page', {
        page_id: 'page-id',
        parent: { page_id: 'parent-id' }
      });
    });

    test('maps operations to correct tool names', async () => {
      const testCases = [
        { op: 'getPage', tool: 'API-retrieve-a-page' },
        { op: 'updatePage', tool: 'API-patch-page' },
        { op: 'createPage', tool: 'API-post-page' },
        { op: 'deletePage', tool: 'API-delete-a-block' }
      ];

      for (const { op, tool } of testCases) {
        mockClient.callTool.mockResolvedValue({});
        await wrapper.execute(op, { page_id: 'test' });
        
        expect(mockClient.callTool).toHaveBeenLastCalledWith(tool, expect.any(Object));
      }
    });

    test('throws for unknown operation', async () => {
      await expect(wrapper.execute('unknownOp', {}))
        .rejects.toThrow('Unknown operation');
    });
  });

  describe('E2E-001: Complete page move workflow', () => {
    test('successful MCP execution', async () => {
      wrapper = new NotionMCPWrapper();
      await wrapper.start();

      mockClient.callTool.mockResolvedValue({
        object: 'page',
        id: 'test-page-id'
      });

      const result = await wrapper.execute('movePage', {
        page_id: 'test-page-id',
        parent: { page_id: 'test-parent-id' }
      });

      expect(result.success).toBe(true);
      expect(result.data.object).toBe('page');
      expect(result.source).toBe('mcp');
    });
  });

  describe('E2E-002: Recovery from MCP failure', () => {
    test('uses fallback when MCP fails', async () => {
      // Mock fallback
      const mockFallback = {
        execute: jest.fn().mockResolvedValue({
          success: true,
          source: 'fallback'
        })
      };

      wrapper = new NotionMCPWrapper({ enableFallback: true });
      wrapper.fallbackStrategy = mockFallback;
      await wrapper.start();

      mockClient.callTool.mockRejectedValue(new Error('MCP failed'));

      const result = await wrapper.execute('movePage', {
        page_id: 'test-id',
        parent: { page_id: 'parent-id' }
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('fallback');
    });
  });
});
