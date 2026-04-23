import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReearthClient } from '@hw/reearth-api-server';
import { toTextResponse } from './internal/response.js';

/** Register model-discovery tools on the MCP server:
 *  list_models, get_model, get_json_schema. */
export function registerModelTools(server: McpServer, client: ReearthClient): void {
  server.registerTool(
    'list_models',
    {
      description: 'List all models in the configured Re:Earth CMS project.',
      inputSchema: {},
    },
    async () => {
      const models = await client.listModels();
      return toTextResponse(models);
    },
  );

  server.registerTool(
    'get_model',
    {
      description:
        'Get a single model with its full field schema (key, name, type, required, multiple, and — when available — description, options for select/tag, geoSupportedTypes). Useful before constructing create/update payloads.',
      inputSchema: {
        model: z.string().describe('Model id (UUID) or key'),
      },
    },
    async ({ model }) => {
      const detail = await client.getModel(model);
      return toTextResponse(detail);
    },
  );

  server.registerTool(
    'get_json_schema',
    {
      description:
        'Fetch the raw JSON Schema (2020-12 + `x-` extensions) of a model. Use this when you need the untouched schema — `get_model` already merges the interesting fields into a typed shape, so prefer that for routine field discovery.',
      inputSchema: {
        model: z.string().describe('Model id (UUID) or key'),
      },
    },
    async ({ model }) => {
      const schema = await client.getJsonSchema(model);
      return toTextResponse(schema);
    },
  );
}
