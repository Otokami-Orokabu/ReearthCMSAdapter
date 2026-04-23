import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReearthClient } from '@hw/reearth-api-server';
import { toTextResponse } from './internal/response.js';

/**
 * Register asset tools on the MCP server: get_asset and
 * upload_asset_by_url. Direct (multipart) upload is omitted because
 * binary over stdio is awkward; CLI and HTTP expose that path.
 */
export function registerAssetTools(server: McpServer, client: ReearthClient): void {
  server.registerTool(
    'get_asset',
    {
      description:
        'Get a single asset by id (Integration API). Returns `null` if it does not exist. Useful after `upload_asset_by_url` to re-read `url` / `contentType` / `totalSize`, or to resolve an id found on an item\'s `asset`-typed field.',
      inputSchema: {
        id: z.string().describe('Asset id (UUID)'),
      },
    },
    async ({ id }) => {
      const asset = await client.getAsset(id);
      return toTextResponse(asset);
    },
  );

  server.registerTool(
    'upload_asset_by_url',
    {
      description:
        'Create a CMS asset by asking the server to fetch a public URL. The returned `id` goes into an item field of type `asset` (e.g. `photos: { type: "asset", value: [assetId] }` when calling `create_item` / `update_item`).',
      inputSchema: {
        url: z.string().url().describe('Public URL the CMS will fetch'),
      },
    },
    async ({ url }) => {
      const asset = await client.uploadAssetByURL(url);
      return toTextResponse(asset);
    },
  );
}
