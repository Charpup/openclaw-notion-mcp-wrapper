/**
 * Unit Tests - FallbackStrategy
 * Tests direct Notion API fallback
 */

const { FallbackStrategy } = require('../../lib/fallback-strategy');
const { exec } = require('child_process');
const util = require('util');

jest.mock('child_process');

describe('FallbackStrategy', () => {
  let strategy;
  const mockExecAsync = jest.fn();

  beforeEach(() => {
    process.env.NOTION_API_KEY = 'test-api-key';
    exec.mockReturnValue({});
    util.promisify = jest.fn(() => mockExecAsync);
    strategy = new FallbackStrategy();
  });

  describe('execute', () => {
    test('moves page via direct API', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({
          object: 'page',
          id: 'test-page-id',
          parent: { page_id: 'test-parent-id' }
        })
      });

      const result = await strategy.execute('movePage', {
        page_id: 'test-page-id',
        parent: { page_id: 'test-parent-id' }
      });

      expect(result).toEqual({
        object: 'page',
        id: 'test-page-id',
        parent: { page_id: 'test-parent-id' },
        source: 'fallback'
      });
    });

    test('gets page via direct API', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({
          object: 'page',
          id: 'test-page-id',
          properties: { title: { title: [{ text: { content: 'Test Page' } }] } }
        })
      });

      const result = await strategy.execute('getPage', {
        page_id: 'test-page-id'
      });

      expect(result.object).toBe('page');
      expect(result.source).toBe('fallback');
    });

    test('handles API error', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: JSON.stringify({
          object: 'error',
          status: 404,
          message: 'Page not found'
        })
      });

      await expect(strategy.execute('getPage', {
        page_id: 'invalid-id'
      })).rejects.toThrow('Page not found');
    });

    test('throws for unsupported operation', async () => {
      await expect(strategy.execute('unsupportedOp', {}))
        .rejects.toThrow('Unsupported fallback operation');
    });

    test('handles network error', async () => {
      mockExecAsync.mockRejectedValue(new Error('Network timeout'));

      await expect(strategy.execute('movePage', {
        page_id: 'test-id',
        parent: { page_id: 'parent-id' }
      })).rejects.toThrow('Network timeout');
    });
  });

  describe('supportedOperations', () => {
    test('lists supported operations', () => {
      const ops = strategy.getSupportedOperations();
      
      expect(ops).toContain('movePage');
      expect(ops).toContain('getPage');
      expect(ops).toContain('updatePage');
      expect(ops).toContain('createPage');
      expect(ops).toContain('deletePage');
    });
  });
});
