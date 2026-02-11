/**
 * FallbackStrategy - Fallback to direct Notion API when MCP fails
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class FallbackStrategy {
  constructor() {
    this.supportedOperations = [
      'movePage',
      'getPage',
      'updatePage',
      'createPage',
      'deletePage'
    ];
  }

  /**
   * Execute operation via direct Notion API
   * @param {string} operation - Operation name
   * @param {object} params - Operation parameters
   * @returns {Promise<object>} - Operation result
   * @throws {Error} If operation fails or is unsupported
   */
  async execute(operation, params) {
    if (!this.supportedOperations.includes(operation)) {
      throw new Error(`Unsupported fallback operation: ${operation}`);
    }

    const NOTION_API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY or NOTION_TOKEN required for fallback');
    }

    const curlCmd = this._buildCurlCommand(operation, params, NOTION_API_KEY);
    
    try {
      const { stdout } = await execAsync(curlCmd);
      const result = JSON.parse(stdout);

      if (result.object === 'error') {
        throw new Error(result.message);
      }

      return { ...result, source: 'fallback' };
    } catch (error) {
      if (error.message.includes('object')) {
        throw error;
      }
      throw new Error(`Fallback failed: ${error.message}`);
    }
  }

  /**
   * Get list of supported operations
   * @returns {string[]}
   */
  getSupportedOperations() {
    return [...this.supportedOperations];
  }

  /**
   * Build curl command for operation
   * @private
   */
  _buildCurlCommand(operation, params, apiKey) {
    const baseUrl = 'https://api.notion.com/v1';
    const headers = [
      `-H "Authorization: Bearer ${apiKey}"`,
      `-H "Content-Type: application/json"`,
      `-H "Notion-Version: 2022-06-28"`
    ].join(' \\\n      ');

    switch (operation) {
      case 'movePage':
        return `curl -s -X PATCH \\
      ${headers} \\
      -d '${JSON.stringify({ parent: params.parent })}' \\
      ${baseUrl}/pages/${params.page_id}`;

      case 'getPage':
        return `curl -s \\
      ${headers} \\
      ${baseUrl}/pages/${params.page_id}`;

      case 'updatePage':
        const updateBody = {};
        if (params.properties) updateBody.properties = params.properties;
        if (params.archived !== undefined) updateBody.archived = params.archived;
        if (params.icon) updateBody.icon = params.icon;
        if (params.cover) updateBody.cover = params.cover;
        
        return `curl -s -X PATCH \\
      ${headers} \\
      -d '${JSON.stringify(updateBody)}' \\
      ${baseUrl}/pages/${params.page_id}`;

      case 'createPage':
        return `curl -s -X POST \\
      ${headers} \\
      -d '${JSON.stringify({
        parent: params.parent,
        properties: params.properties,
        children: params.children
      })}' \\
      ${baseUrl}/pages`;

      case 'deletePage':
        // Notion uses archive=true for deletion
        return `curl -s -X PATCH \\
      ${headers} \\
      -d '{"archived":true}' \\
      ${baseUrl}/pages/${params.page_id}`;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}

module.exports = { FallbackStrategy };
