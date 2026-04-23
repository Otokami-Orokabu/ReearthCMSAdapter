import { z } from 'zod';

/**
 * Shared zod schemas for bbox / near / sort tool inputs.
 *
 * @internal
 */
const lngSchema = z.number().min(-180).max(180);
const latSchema = z.number().min(-90).max(90);

export const bboxSchema = z
  .tuple([lngSchema, latSchema, lngSchema, latSchema])
  .describe('[minLng, minLat, maxLng, maxLat] (WGS-84 degrees)');

export const nearSchema = z
  .object({
    lng: lngSchema,
    lat: latSchema,
    radius: z
      .number()
      .nonnegative()
      .describe('Radius in meters (0 = exact coordinate match only)'),
  })
  .describe('Keep features within <radius> meters of [lng, lat]');

export const sortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).optional(),
});
