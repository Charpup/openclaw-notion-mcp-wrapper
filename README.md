# OpenClaw Notion MCP Wrapper

[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-blue)](https://clawhub.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Notion MCP Server wrapper with health check, auto-reconnect, and fallback

**Dependencies**: This skill works best with [openclaw-notion-md-converter](https://github.com/Charpup/openclaw-notion-md-converter) for Markdown → Notion blocks conversion.

## Features

- ✅ **Health Check** - Monitor MCP server connectivity
- ✅ **Auto Reconnect** - Exponential backoff retry on failure  
- ✅ **Seamless Fallback** - Auto-switch to direct API when MCP fails
- ✅ **CLI Tools** - Quick diagnostics and operations

## Installation

```bash
git clone https://github.com/Charpup/openclaw-notion-mcp-wrapper.git
cd openclaw-notion-mcp-wrapper
npm install
```

## Prerequisites

### OAuth Setup for Notion MCP Server

For **cloud VM / headless CLI environments** (like this case):

1. **Use Internal Integration Token** (Recommended for agents)
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create "Internal" integration (not Public OAuth)
   - Copy the token: `ntn_...`
   - No OAuth redirect needed!

2. **Set Environment Variable**
   ```bash
   export NOTION_API_KEY="ntn_YOUR_INTERNAL_TOKEN"
   ```

3. **Share Pages with Integration**
   - In Notion, go to page → Share → Add integration
   - Select your integration name

4. **Start MCP Server**
   ```bash
   npx -y @notionhq/notion-mcp-server
   ```

**Why Internal Token?**
- No browser-based OAuth flow needed
- Perfect for CLI-only environments
- Same API access as OAuth

## Usage

### As Library

```javascript
const { NotionMCPWrapper } = require('./lib/notion-mcp-wrapper');

const wrapper = new NotionMCPWrapper({
  maxRetries: 5,
  baseDelayMs: 1000
});

// Start wrapper
await wrapper.start();

// Execute with auto-fallback
const result = await wrapper.execute('query', { databaseId: 'xxx' });
console.log(result.source); // 'mcp' or 'fallback'
```

### CLI Commands

```bash
# Check MCP health
npm run health

# Start wrapper
npm run start

# Run tests
npm test
```

## Architecture

```
┌─────────────────────────────────┐
│     NotionMCPWrapper            │
├─────────────────────────────────┤
│  HealthChecker  → Ping MCP      │
│  Reconnector    → Exponential   │
│  FallbackMgr    → Auto-switch   │
└─────────────────────────────────┘
```

## Related Projects

- [openclaw-notion-md-converter](https://github.com/Charpup/openclaw-notion-md-converter) - Markdown to Notion blocks
- [OpenClaw](https://github.com/openclaw/openclaw) - The agent framework

## License

MIT
