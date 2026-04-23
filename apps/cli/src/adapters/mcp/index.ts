import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../../config.js';
import { registerModelTools } from './models.js';
import { registerItemTools } from './items.js';
import { registerFeatureTools } from './features.js';
import { registerAssetTools } from './assets.js';

/**
 * Start the MCP server on stdio. The MCP protocol owns stdout
 * (JSON-RPC frames only); any human-readable logging must go to stderr.
 */
export async function startMcpServer(): Promise<void> {
  const config = loadConfig();
  const client = createClient(config);

  const server = new McpServer({
    name: 'reearth-cms',
    version: '0.0.0',
  });

  registerModelTools(server, client);
  registerItemTools(server, client);
  registerFeatureTools(server, client);
  registerAssetTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
