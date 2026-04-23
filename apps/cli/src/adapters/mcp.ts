import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createClient,
  CMS_FIELD_TYPE_VALUES,
  type CmsPayload,
} from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * Start the MCP adapter on stdio so AI clients (Claude Code, Cursor, etc.)
 * can invoke Core operations as tools.
 *
 * This is a Secondary Adapter over the same Core (`createClient`) that
 * backs the CLI and HTTP (`apps/server`) adapters — the shape of the
 * tools mirrors the HTTP endpoints and CLI subcommands.
 *
 * **I/O contract**: the MCP protocol owns stdout (JSON-RPC messages only).
 * All human-facing logging must go to stderr. This module never writes to
 * stdout outside the SDK transport.
 */
export async function startMcpServer(): Promise<void> {
  const config = loadConfig();
  const client = createClient(config);

  const server = new McpServer({
    name: 'reearth-cms',
    version: '0.0.0',
  });

  server.registerTool(
    'list_models',
    {
      description: 'List all models in the configured Re:Earth CMS project.',
      inputSchema: {},
    },
    async () => {
      const models = await client.listModels();
      return { content: [{ type: 'text', text: JSON.stringify(models, null, 2) }] };
    },
  );

  server.registerTool(
    'get_model',
    {
      description:
        'Get a single model with its full field schema (key, name, type, required, multiple). Useful before constructing create/update payloads.',
      inputSchema: {
        model: z.string().describe('Model id (UUID) or key'),
      },
    },
    async ({ model }) => {
      const detail = await client.getModel(model);
      const body = detail === null ? 'null' : JSON.stringify(detail, null, 2);
      return { content: [{ type: 'text', text: body }] };
    },
  );

  const bboxSchema = z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .describe('[minLng, minLat, maxLng, maxLat] (WGS-84 degrees)');
  const sortSchema = z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc']).optional(),
  });

  server.registerTool(
    'list_items',
    {
      description:
        'List items for a CMS model via Public API. Only *published* items are returned. Supports client-side bbox filter, sort, offset and limit.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
        bbox: bboxSchema.optional(),
        sort: sortSchema.optional(),
      },
    },
    async ({ model, limit, offset, bbox, sort }) => {
      const items = await client.listItems<Record<string, unknown>>(model, {
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(bbox !== undefined ? { bbox: bbox as [number, number, number, number] } : {}),
        ...(sort !== undefined
          ? {
              sort: {
                field: sort.field,
                ...(sort.order !== undefined ? { order: sort.order } : {}),
              },
            }
          : {}),
      });
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
    },
  );

  server.registerTool(
    'list_features',
    {
      description:
        'Fetch items as a GeoJSON FeatureCollection (uses the `.geojson` variant of Public API). Items without Point location are excluded server-side. Supports client-side bbox / sort / offset / limit.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
        bbox: bboxSchema.optional(),
        sort: sortSchema.optional(),
      },
    },
    async ({ model, limit, offset, bbox, sort }) => {
      const fc = await client.listFeatures(model, {
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(bbox !== undefined ? { bbox: bbox as [number, number, number, number] } : {}),
        ...(sort !== undefined
          ? {
              sort: {
                field: sort.field,
                ...(sort.order !== undefined ? { order: sort.order } : {}),
              },
            }
          : {}),
      });
      return { content: [{ type: 'text', text: JSON.stringify(fc, null, 2) }] };
    },
  );

  server.registerTool(
    'get_item',
    {
      description: 'Get a single item by id via Public API. Returns null if not found.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        id: z.string().describe('Item id'),
      },
    },
    async ({ model, id }) => {
      const item = await client.getItem<Record<string, unknown>>(model, id);
      const body = item === null ? 'null' : JSON.stringify(item, null, 2);
      return { content: [{ type: 'text', text: body }] };
    },
  );

  const fieldTypeEnum = z.enum(CMS_FIELD_TYPE_VALUES);
  const payloadSchema = z.record(
    z.string(),
    z.object({ type: fieldTypeEnum, value: z.unknown() }),
  );

  server.registerTool(
    'create_item',
    {
      description:
        'Create a new item via Integration API. Items are created as **draft** — they will not appear in `list_items` (Public API) until explicitly published.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        payload: payloadSchema.describe(
          'Fields keyed by name, each shaped as { type, value }. See list_models for available fields.',
        ),
      },
    },
    async ({ model, payload }) => {
      const created = await client.createItem<Record<string, unknown>>(
        model,
        payload as CmsPayload,
      );
      return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
    },
  );

  server.registerTool(
    'update_item',
    {
      description: 'Update an existing item by id via Integration API.',
      inputSchema: {
        id: z.string().describe('Item id'),
        payload: payloadSchema.describe('Fields to change'),
      },
    },
    async ({ id, payload }) => {
      const updated = await client.updateItem<Record<string, unknown>>(
        id,
        payload as CmsPayload,
      );
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    },
  );

  server.registerTool(
    'delete_item',
    {
      description: 'Delete an item by id via Integration API. Destructive.',
      inputSchema: { id: z.string().describe('Item id') },
    },
    async ({ id }) => {
      await client.deleteItem(id);
      return { content: [{ type: 'text', text: `Deleted item ${id}` }] };
    },
  );

  server.registerTool(
    'publish_item',
    {
      description:
        'Publish a draft item so it becomes visible via Public API (`list_items`).',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        id: z.string().describe('Item id'),
      },
    },
    async ({ model, id }) => {
      await client.publishItem(model, id);
      return { content: [{ type: 'text', text: `Published item ${id}` }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // After connect, the SDK takes over stdin/stdout until the transport ends.
  // Returning here keeps the process alive implicitly (stdio stays open).
}
