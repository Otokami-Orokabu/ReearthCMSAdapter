import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  CMS_FIELD_TYPE_VALUES,
  type ReearthClient,
} from '@hw/reearth-api-server';
import { bboxSchema, nearSchema, sortSchema } from './internal/schemas.js';
import { toListOpts } from './internal/listOpts.js';
import { toTextMessage, toTextResponse } from './internal/response.js';

/**
 * Register item tools on the MCP server:
 * list_items, list_all_items, get_item, create_item, update_item,
 * delete_item, publish_item.
 */
export function registerItemTools(server: McpServer, client: ReearthClient): void {
  const fieldTypeEnum = z.enum(CMS_FIELD_TYPE_VALUES);
  const payloadSchema = z.record(
    z.string(),
    z.object({ type: fieldTypeEnum, value: z.unknown() }),
  );

  const listInputSchema = {
    model: z.string().describe('Model key or id'),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    bbox: bboxSchema.optional(),
    near: nearSchema.optional(),
    sort: sortSchema.optional(),
  };

  server.registerTool(
    'list_items',
    {
      description:
        'List items for a CMS model via Public API. Returns only **published** items — newly created items are draft by default and will NOT appear here until `publish_item` is called. Use `list_all_items` when you need drafts too. Supports client-side bbox / near / sort / offset / limit.',
      inputSchema: listInputSchema,
    },
    async ({ model, limit, offset, bbox, near, sort }) => {
      const items = await client.listItems<Record<string, unknown>>(
        model,
        toListOpts({ limit, offset, bbox, near, sort }),
      );
      return toTextResponse(items);
    },
  );

  server.registerTool(
    'list_all_items',
    {
      description:
        'List items for a CMS model via Integration API, returning **both drafts and published** items. Use this to verify seeded / created items before publish, or to enumerate drafts for cleanup. Same client-side bbox / near / sort / offset / limit as list_items.',
      inputSchema: listInputSchema,
    },
    async ({ model, limit, offset, bbox, near, sort }) => {
      const items = await client.listAllItems<Record<string, unknown>>(
        model,
        toListOpts({ limit, offset, bbox, near, sort }),
      );
      return toTextResponse(items);
    },
  );

  server.registerTool(
    'get_item',
    {
      description:
        'Get a single item by id via Public API. Returns `null` if not found. **Draft items also return `null`** (Public API only sees published items) — if you just created an item and it seems to vanish, it is a draft, not missing. Use `list_all_items` to enumerate drafts.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        id: z.string().describe('Item id'),
      },
    },
    async ({ model, id }) => {
      const item = await client.getItem<Record<string, unknown>>(model, id);
      return toTextResponse(item);
    },
  );

  server.registerTool(
    'create_item',
    {
      description:
        'Create a new item via Integration API. Items are created as **draft** — they will NOT appear in `list_items` (Public API) until you call `publish_item`. Run `get_model` first if you are unsure what fields the model accepts. For `select` / `tag` fields, the value must match a CMS-registered option exactly (`get_model` returns these in `field.options`) otherwise the CMS responds 400.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        payload: payloadSchema.describe(
          'Fields keyed by name, each shaped as { type, value }. See list_models for available fields.',
        ),
      },
    },
    async ({ model, payload }) => {
      const created = await client.createItem<Record<string, unknown>>(model, payload);
      return toTextResponse(created);
    },
  );

  server.registerTool(
    'update_item',
    {
      description:
        'Update an existing item by id via Integration API. **Partial update** — only the fields present in `payload` are touched; absent fields are kept as-is. The item\'s publish state is preserved (published stays published; draft stays draft).',
      inputSchema: {
        id: z.string().describe('Item id'),
        payload: payloadSchema.describe('Fields to change'),
      },
    },
    async ({ id, payload }) => {
      const updated = await client.updateItem<Record<string, unknown>>(id, payload);
      return toTextResponse(updated);
    },
  );

  server.registerTool(
    'delete_item',
    {
      description:
        'Delete an item by id via Integration API. **Destructive and irreversible** — the item cannot be recovered. If invoked interactively, confirm intent with the user before calling. Both drafts and published items can be deleted.',
      inputSchema: { id: z.string().describe('Item id') },
    },
    async ({ id }) => {
      await client.deleteItem(id);
      return toTextMessage(`Deleted item ${id}`);
    },
  );

  server.registerTool(
    'publish_item',
    {
      description:
        'Publish a draft item so it becomes visible via Public API (`list_items`, `get_item`, `list_features`). The typical flow is: `create_item` (draft) → `publish_item` (now public). Already-published items can be re-published safely (no-op on visibility).',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        id: z.string().describe('Item id'),
      },
    },
    async ({ model, id }) => {
      await client.publishItem(model, id);
      return toTextMessage(`Published item ${id}`);
    },
  );
}
