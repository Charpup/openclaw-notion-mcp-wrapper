#!/usr/bin/env node
/**
 * 使用 Notion MCP Wrapper 归档 Claw Context Hub 页面
 */

const path = require('path');
const { NotionMCPWrapper } = require(path.join(__dirname, '../lib/notion-mcp-wrapper.js'));

// 页面 ID 映射
const PAGES_TO_MOVE = {
  // MemU 研究文档 -> 🔬 MemU-Research (30437c3f-7f6f-81ec-9748-c169bc0dfa4d)
  '2fc37c3f-7f6f-813b-9821-cbcf3d109745': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 夜间研究任务
  '2fd37c3f-7f6f-81d1-9c9d-f6391db9a43b': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // Task Progress
  '2ff37c3f-7f6f-8178-9e66-f83eb1209dcb': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 飞书配置诊断
  '30437c3f-7f6f-8197-9de1-d220e81b470f': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // Inbox 晨间报告
  '30037c3f-7f6f-8139-9b15-ec77b4d56307': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // sessions_spawn 分析

  // MemU 文档 -> MemU-Research
  '30037c3f-7f6f-81bd-8eeb-e4a7c599b197': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // MemU 本地记忆方案调研
  '30037c3f-7f6f-8184-9bd4-e777ed240879': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // Phase 1
  '30037c3f-7f6f-81e9-962b-eb7a734e5a8c': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // Phase 2
  '30037c3f-7f6f-8160-ba9f-d6dd67a25a39': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // Phase 3
  '30137c3f-7f6f-812c-b557-e7cd4a518882': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 落地方案
  '30137c3f-7f6f-8142-86d2-cf4593b730d5': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 架构报告1
  '30137c3f-7f6f-81f1-b684-e783a58bd1a5': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 架构报告2
  '30337c3f-7f6f-81d6-aa4c-caf32ad4af6a': '30437c3f-7f6f-81ec-9748-c169bc0dfa4d', // 双系统集成

  // 审计报告 -> 📝 Audit-Reports (30437c3f-7f6f-8107-935b-de5a79b7c425)
  '30237c3f-7f6f-81fc-b8ce-ee06844bea54': '30437c3f-7f6f-8107-935b-de5a79b7c425', // Docs RAG 审计
  '30437c3f-7f6f-8186-8ce6-e1854b123690': '30437c3f-7f6f-8107-935b-de5a79b7c425', // Skill Security Auditor
  '30437c3f-7f6f-81d1-abb9-c873b921e008': '30437c3f-7f6f-8107-935b-de5a79b7c425', // AGENTS.md 审计

  // 系统日志 -> 99_System (30437c3f-7f6f-8193-8426-e956364b2f93)
  '30237c3f-7f6f-81cd-9e7c-fe300235d866': '30437c3f-7f6f-8193-8426-e956364b2f93', // Heartbeat 失效
  '30237c3f-7f6f-8184-9cfe-cccb14260b19': '30437c3f-7f6f-8193-8426-e956364b2f93', // Config Error
};

async function main() {
  console.log('🚀 启动 Notion MCP Wrapper...\n');
  
  const wrapper = new NotionMCPWrapper({
    fallbackEnabled: true
  });

  try {
    // 启动 wrapper
    const startResult = await wrapper.start();
    if (!startResult.success) {
      console.error('❌ Failed to start MCP wrapper');
      process.exit(1);
    }

    // 执行页面移动
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const [pageId, parentId] of Object.entries(PAGES_TO_MOVE)) {
      try {
        console.log(`📄 ${pageId} -> ${parentId}`);
        
        const result = await wrapper.execute('movePage', {
          page_id: pageId.replace(/-/g, ''),
          parent: {
            page_id: parentId.replace(/-/g, '')
          }
        });
        
        if (result.success) {
          successCount++;
          console.log(`   ✅ ${result.source === 'fallback' ? '(fallback)' : ''}`);
        } else {
          failCount++;
          console.log(`   ❌ Failed`);
        }
        
        results.push({ pageId, parentId, success: result.success, source: result.source });
      } catch (error) {
        failCount++;
        console.error(`   ❌ ${error.message}`);
        results.push({ pageId, parentId, success: false, error: error.message });
      }
      
      // 小延迟避免限流
      await new Promise(r => setTimeout(r, 500));
    }

    // 停止 wrapper
    await wrapper.stop();

    // 打印总结
    console.log('\n━━━━━━━━━━━━');
    console.log('📊 归档完成');
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log('━━━━━━━━━━━━');

    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    await wrapper.stop();
    process.exit(1);
  }
}

main();
