/**
 * Notion MCP Wrapper - Main entry point
 * Production-ready wrapper for Notion MCP Server
 */

const { MCPClient } = require('./lib/mcp-client');
const { HealthMonitor } = require('./lib/health-monitor');
const { RetryPolicy } = require('./lib/retry-policy');
const { FallbackStrategy } = require('./lib/fallback-strategy');
const { NotionMCPWrapper } = require('./lib/wrapper');

module.exports = {
  MCPClient,
  HealthMonitor,
  RetryPolicy,
  FallbackStrategy,
  NotionMCPWrapper
};
