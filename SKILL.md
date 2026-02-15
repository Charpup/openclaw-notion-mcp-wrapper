---
name: notion-mcp-wrapper
version: "2.0.0"
description: Production-ready Notion MCP Server wrapper with health monitoring, automatic reconnection, and fallback strategies
author: Galatea
homepage: https://github.com/Charpup/openclaw-notion-mcp-wrapper
---

# notion-mcp-wrapper

生产级的 Notion MCP Server 包装器，提供健康监控、自动重连和降级策略。

## 特性

- ✅ **健康监控** - 持续监控 MCP 连接状态
- ✅ **自动重连** - 连接断开时自动恢复
- ✅ **智能降级** - MCP 失败时自动切换到直接 API 调用
- ✅ **指数退避** - 智能重试策略
- ✅ **完整测试** - 单元测试 + 集成测试覆盖

## 架构

```
┌─────────────────────────────────────────┐
│      NotionMCPWrapper (主入口)          │
├─────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   │
│  │ HealthMonitor│   │ RetryPolicy  │   │
│  │   (健康监控)  │   │   (重试策略)  │   │
│  └──────────────┘   └──────────────┘   │
│  ┌──────────────┐   ┌──────────────┐   │
│  │  MCPClient   │   │FallbackStrategy│ │
│  │ (MCP 通信)   │   │   (降级策略)   │  │
│  └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────┘
```

## 安装

```bash
npm install
```

## 配置

环境变量：
```bash
export NOTION_TOKEN="your-notion-integration-token"
# 或
export NOTION_API_KEY="your-notion-api-key"
```

## 使用

### 作为库使用

```javascript
const { NotionMCPWrapper } = require('notion-mcp-wrapper');

const wrapper = new NotionMCPWrapper({
  enableHealthMonitor: true,
  enableRetry: true,
  enableFallback: true,
  retryOptions: {
    maxRetries: 3,
    baseDelayMs: 1000
  }
});

// 启动
await wrapper.start();

// 执行操作
const result = await wrapper.execute('movePage', {
  page_id: 'your-page-id',
  parent: { page_id: 'new-parent-id' }
});

// 停止
await wrapper.stop();
```

### CLI 使用

```bash
# 检查健康状态
npm run health

# 移动页面
node bin/notion-mcp-wrapper.js move-page <page-id> <parent-id>
```

## 支持的操作

| 操作 | MCP 工具 | Fallback |
|------|----------|----------|
| movePage | API-move-page | ✅ |
| getPage | API-retrieve-a-page | ✅ |
| updatePage | API-patch-page | ✅ |
| createPage | API-post-page | ✅ |
| deletePage | API-delete-a-block | ✅ |
| getBlockChildren | API-get-block-children | ❌ |
| appendBlocks | API-patch-block-children | ❌ |
| queryDatabase | API-query-data-source | ❌ |
| search | API-post-search | ❌ |

## 测试

```bash
# 运行所有测试
npm test

# 单元测试
npm test -- tests/unit

# 集成测试
npm test -- tests/integration
```

## 开发

使用 TDD+SDD 双金字塔模式开发：

1. **SDD** - 先写 SPEC.yaml 定义行为
2. **TDD** - 根据 SPEC 写测试
3. **实现** - 让测试通过
4. **重构** - 改进代码质量

## License

MIT
