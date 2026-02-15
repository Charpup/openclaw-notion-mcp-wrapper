#!/usr/bin/env node
const { NotionMCPWrapper } = require('./lib/wrapper');

async function test() {
  const wrapper = new NotionMCPWrapper({ enableHealthMonitor: false });
  await wrapper.start();
  
  try {
    // 尝试获取 Galata Journal 页面
    const result = await wrapper.execute('getPage', {
      page_id: '2fb37c3f7f6f80c2b194d3f5f062eb38'
    });
    
    if (result.success) {
      console.log('✅ Successfully accessed Journal page');
      console.log('Page title:', result.data?.properties?.title?.title?.[0]?.plain_text || 'N/A');
      console.log('Page URL:', result.data?.url || 'N/A');
    } else {
      console.log('❌ Failed to access page:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await wrapper.stop();
  }
}

test();
