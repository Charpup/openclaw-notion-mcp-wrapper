/**
 * Unit Tests - RetryPolicy
 * Tests retry logic with exponential backoff
 */

const { RetryPolicy } = require('../../lib/retry-policy');

describe('RetryPolicy', () => {
  let retryPolicy;

  beforeEach(() => {
    retryPolicy = new RetryPolicy({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2
    });
  });

  describe('execute', () => {
    test('TC-004: Success on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retryPolicy.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('TC-005: Success after retry', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await retryPolicy.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('TC-006: All retries fail', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(retryPolicy.execute(fn)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    test('exponential backoff delays', async () => {
      const delays = [];
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retryPolicy.execute(fn);
      const totalTime = Date.now() - startTime;

      // 100ms + 200ms = 300ms minimum delay
      expect(totalTime).toBeGreaterThanOrEqual(250);
    });

    test('respects maxDelayMs cap', async () => {
      const policy = new RetryPolicy({
        maxRetries: 5,
        baseDelayMs: 500,
        maxDelayMs: 800, // Cap at 800ms
        backoffMultiplier: 2
      });

      const fn = jest.fn().mockRejectedValue(new Error('Fail'));
      
      const startTime = Date.now();
      await expect(policy.execute(fn)).rejects.toThrow();
      const totalTime = Date.now() - startTime;

      // Without cap: 500 + 1000 + 2000 + 4000 = 7500ms
      // With cap: 500 + 800 + 800 + 800 = 2900ms
      expect(totalTime).toBeLessThan(4000);
    });
  });
});
