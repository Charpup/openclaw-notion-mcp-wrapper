#!/usr/bin/env node
/**
 * CLI for Notion MCP Wrapper
 */

const path = require('path');
const { NotionMCPWrapper } = require('../lib/wrapper');

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'health':
      console.log('Checking MCP server health...');
      const wrapper = new NotionMCPWrapper({ enableHealthMonitor: false });
      const result = await wrapper.start();
      
      if (result.success) {
        console.log('✅ MCP server is healthy');
        await wrapper.stop();
        process.exit(0);
      } else {
        console.error('❌ MCP server is unhealthy:', result.error);
        process.exit(1);
      }
      break;

    case 'move-page':
      const pageId = process.argv[3];
      const parentId = process.argv[4];
      
      if (!pageId || !parentId) {
        console.error('Usage: notion-mcp-wrapper move-page <page-id> <parent-id>');
        process.exit(1);
      }

      const moveWrapper = new NotionMCPWrapper();
      await moveWrapper.start();
      
      try {
        const result = await moveWrapper.execute('movePage', {
          page_id: pageId.replace(/-/g, ''),
          parent: { page_id: parentId.replace(/-/g, '') }
        });
        
        console.log(result.success ? '✅ Page moved successfully' : '❌ Failed to move page');
        process.exit(result.success ? 0 : 1);
      } finally {
        await moveWrapper.stop();
      }
      break;

    default:
      console.log(`
Notion MCP Wrapper v2.0.0

Usage:
  notion-mcp-wrapper <command> [options]

Commands:
  health              Check MCP server health
  move-page <id> <parent>  Move a page to new parent

Examples:
  notion-mcp-wrapper health
  notion-mcp-wrapper move-page abc123 def456
`);
      process.exit(0);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
