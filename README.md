# OpenClaw Notion MCP Wrapper

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/Charpup/openclaw-notion-mcp-wrapper/releases/tag/v2.1.0)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-4CAF50.svg)](https://openclaw.ai)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![evals](https://img.shields.io/badge/evals-3%20cases-blueviolet.svg)](evals/evals.json)
[![Oathe Security](https://img.shields.io/badge/Oathe-92%2F100%20SAFE-brightgreen.svg)](https://oathe.ai/report/Charpup/openclaw-notion-mcp-wrapper)

> Production-ready Notion MCP Server wrapper with health monitoring, automatic reconnection, and transparent fallback to direct REST API. Built for OpenClaw agents operating in headless / cloud environments.

**Companion skill:** [openclaw-notion-md-converter](https://github.com/Charpup/openclaw-notion-md-converter) — Markdown → Notion blocks conversion.

---

## AI Agent Quick Reference

```yaml
# Skill identity (SKILL.md frontmatter)
name: notion-mcp-wrapper
version: "2.0.1"
triggers:
  - "notion"
  - "mcp"
  - "notion-mcp-wrapper"
  - "move page"
  - "notion health"

# Runtime requirements
requires:
  bins: [node, npm]
  env: [NOTION_TOKEN]   # or NOTION_API_KEY

# Install
run: cd ~/.openclaw/skills/notion-mcp-wrapper && npm install
```

**When to invoke:**
- Check Notion MCP connectivity / health status
- Execute Notion operations (movePage, createPage, updatePage, deletePage) via MCP
- Auto-reconnect after MCP server crash or timeout
- Fall back to direct Notion REST API when MCP is unavailable

**When NOT to invoke:**
- Simple Notion reads that work directly via MCP tools
- Non-Notion operations

---

## Features

| Feature | Description |
|---------|-------------|
| **Health Monitoring** | Continuous MCP ping; reports `healthy` / `degraded` / `down` with latency |
| **Auto Reconnect** | Exponential backoff retry — configurable `maxRetries` and `baseDelayMs` |
| **Seamless Fallback** | Auto-switches to Notion REST API when MCP fails; transparent to callers |
| **Operation Support** | movePage, getPage, updatePage, createPage, deletePage (with fallback) |
| **Full Test Suite** | Unit + integration tests via Jest |

---

## Installation

```bash
git clone https://github.com/Charpup/openclaw-notion-mcp-wrapper.git \
  ~/.openclaw/skills/notion-mcp-wrapper
cd ~/.openclaw/skills/notion-mcp-wrapper
npm install
```

**Environment:**

```bash
export NOTION_TOKEN="ntn_YOUR_INTERNAL_INTEGRATION_TOKEN"
# Alternative:
export NOTION_API_KEY="ntn_YOUR_INTERNAL_INTEGRATION_TOKEN"
```

> **Headless / cloud setup:** Use an [Internal Integration Token](https://www.notion.so/my-integrations) — no browser OAuth needed. Share target Notion pages with your integration before use.

---

## Usage

### As a Library

```javascript
const { NotionMCPWrapper } = require('./lib/notion-mcp-wrapper');

const wrapper = new NotionMCPWrapper({
  maxRetries: 5,
  baseDelayMs: 1000,
  enableHealthMonitor: true,
  enableFallback: true,
});

await wrapper.start();

// Execute with automatic MCP → API fallback
const result = await wrapper.execute('movePage', {
  page_id: 'abc123def456',
  parent: { page_id: 'xyz789ghi012' },
});

console.log(result.source); // 'mcp' | 'fallback'
await wrapper.stop();
```

### CLI

```bash
npm run health                                             # Check MCP health
node bin/notion-mcp-wrapper.js move-page <page-id> <parent-id>
npm test                                                   # Run test suite
```

---

## Supported Operations

| Operation | MCP Tool | API Fallback |
|-----------|----------|--------------|
| `movePage` | `API-move-page` | ✅ |
| `getPage` | `API-retrieve-a-page` | ✅ |
| `updatePage` | `API-patch-page` | ✅ |
| `createPage` | `API-post-page` | ✅ |
| `deletePage` | `API-delete-a-block` | ✅ |
| `getBlockChildren` | `API-get-block-children` | ❌ |
| `appendBlocks` | `API-patch-block-children` | ❌ |
| `queryDatabase` | `API-query-data-source` | ❌ |
| `search` | `API-post-search` | ❌ |

---

## Architecture

```
NotionMCPWrapper  ←  entry point
├── HealthMonitor     periodic MCP ping → healthy / degraded / down
├── RetryPolicy       exponential backoff, configurable maxRetries
├── MCPClient         stdio-based MCP protocol communication
└── FallbackStrategy  Notion REST API when MCP unavailable
```

---

## Evals

Skill test cases live in [`evals/evals.json`](evals/evals.json) following the skill-creator standard:

| ID | Scenario | Expected Trigger |
|----|----------|-----------------|
| 1 | Check Notion MCP health status | ✅ Yes |
| 2 | Move page via MCP wrapper with fallback | ✅ Yes |
| 3 | Write a JavaScript string-reversal function | ❌ No |

---

## Version History

| Version | Changes |
|---------|---------|
| **v2.0.1** | Add `metadata.openclaw` compliance block; add `evals/evals.json` (3 cases) |
| **v2.0.0** | Production rewrite: HealthMonitor, RetryPolicy, FallbackStrategy, full tests |

---

## Related Projects

- [openclaw-notion-md-converter](https://github.com/Charpup/openclaw-notion-md-converter) — Markdown → Notion blocks
- [triadev](https://github.com/Charpup/triadev) — Golden Triangle workflow (uses this skill)
- [OpenClaw](https://openclaw.ai) — The agent framework

## License

MIT — [Charpup](https://github.com/Charpup)

## Changelog
- 2026-03-11: Skill audit upgrade — normalized SKILL.md frontmatter to `name` + `description`, revalidated trigger wording, and rechecked lightweight lint/smoke compatibility with OpenClaw.
