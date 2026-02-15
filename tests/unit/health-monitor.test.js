/**
 * Unit Tests - HealthMonitor
 * Tests health checking and recovery detection
 */

const { HealthMonitor } = require('../../lib/health-monitor');

describe('HealthMonitor', () => {
  let mockClient;
  let healthMonitor;

  beforeEach(() => {
    mockClient = {
      callTool: jest.fn()
    };
    healthMonitor = new HealthMonitor(mockClient, {
      checkIntervalMs: 100,
      timeoutMs: 500
    });
  });

  afterEach(() => {
    healthMonitor.stop();
  });

  describe('start/stop', () => {
    test('starts health checking', () => {
      healthMonitor.start();
      expect(healthMonitor.isRunning()).toBe(true);
    });

    test('stops health checking', () => {
      healthMonitor.start();
      healthMonitor.stop();
      expect(healthMonitor.isRunning()).toBe(false);
    });
  });

  describe('isHealthy', () => {
    test('returns false before first check', () => {
      expect(healthMonitor.isHealthy()).toBe(false);
    });

    test('returns true when checks pass', async () => {
      mockClient.callTool.mockResolvedValue({ status: 'ok' });
      
      healthMonitor.start();
      await new Promise(r => setTimeout(r, 150)); // Wait for first check
      
      expect(healthMonitor.isHealthy()).toBe(true);
    });

    test('returns false when checks fail', async () => {
      mockClient.callTool.mockRejectedValue(new Error('Connection failed'));
      
      healthMonitor.start();
      await new Promise(r => setTimeout(r, 150));
      
      expect(healthMonitor.isHealthy()).toBe(false);
    });
  });

  describe('events', () => {
    test('emits healthChange on status change', async () => {
      const healthChangeHandler = jest.fn();
      healthMonitor.on('healthChange', healthChangeHandler);
      
      mockClient.callTool.mockResolvedValue({ status: 'ok' });
      healthMonitor.start();
      
      await new Promise(r => setTimeout(r, 150));
      
      expect(healthChangeHandler).toHaveBeenCalledWith({
        healthy: true,
        latency: expect.any(Number)
      });
    });

    test('emits recoveryNeeded when health fails', async () => {
      const recoveryHandler = jest.fn();
      healthMonitor.on('recoveryNeeded', recoveryHandler);
      
      mockClient.callTool.mockRejectedValue(new Error('Connection failed'));
      healthMonitor.start();
      
      await new Promise(r => setTimeout(r, 150));
      
      expect(recoveryHandler).toHaveBeenCalledWith({
        reason: expect.stringContaining('Connection failed')
      });
    });
  });

  describe('latency tracking', () => {
    test('tracks check latency', async () => {
      mockClient.callTool.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 'ok' }), 50))
      );
      
      healthMonitor.start();
      await new Promise(r => setTimeout(r, 150));
      
      const latency = healthMonitor.getLastLatency();
      // Latency should be a positive number, timing can vary
      expect(latency).toBeGreaterThanOrEqual(40);
      expect(latency).toBeLessThan(200);
    });
  });
});
