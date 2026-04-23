import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReearthClient } from '@hw/reearth-api-server';
import { bboxSchema, nearSchema, sortSchema } from './internal/schemas.js';
import { toListOpts } from './internal/listOpts.js';
import { toTextResponse } from './internal/response.js';

/** Register GeoJSON / geo-utility tools on the MCP server:
 *  list_features and get_bbox. */
export function registerFeatureTools(server: McpServer, client: ReearthClient): void {
  server.registerTool(
    'list_features',
    {
      description:
        'Fetch items as a GeoJSON FeatureCollection (uses the `.geojson` variant of Public API). Items without Point location are excluded server-side. Supports client-side bbox / near / sort / offset / limit.',
      inputSchema: {
        model: z.string().describe('Model key or id'),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
        bbox: bboxSchema.optional(),
        near: nearSchema.optional(),
        sort: sortSchema.optional(),
      },
    },
    async ({ model, limit, offset, bbox, near, sort }) => {
      const fc = await client.listFeatures(
        model,
        toListOpts({ limit, offset, bbox, near, sort }),
      );
      return toTextResponse(fc);
    },
  );

  server.registerTool(
    'get_bbox',
    {
      description:
        'Compute the bounding box `[minLng, minLat, maxLng, maxLat]` covering all Point-located items in a model. Returns `null` for empty / geometry-less models. The result shape fits MapLibre `map.fitBounds([[minLng,minLat],[maxLng,maxLat]])` and Leaflet `map.fitBounds([[minLat,minLng],[maxLat,maxLng]])` (note the axis-order difference).',
      inputSchema: { model: z.string().describe('Model key or id') },
    },
    async ({ model }) => {
      const bbox = await client.getBounds(model);
      return toTextResponse(bbox);
    },
  );
}
