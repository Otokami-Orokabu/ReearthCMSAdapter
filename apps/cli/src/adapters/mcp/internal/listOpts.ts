import type { Bbox, ListOpts } from '@hw/reearth-api-server';

/**
 * Input shape accepted by toListOpts. Matches zod's inferred output
 * where every optional property carries `| undefined` explicitly.
 *
 * @internal
 */
export interface ListOptsInput {
  limit?: number | undefined;
  offset?: number | undefined;
  bbox?: [number, number, number, number] | undefined;
  near?: { lng: number; lat: number; radius: number } | undefined;
  sort?: { field: string; order?: 'asc' | 'desc' | undefined } | undefined;
}

/**
 * Build a Core ListOpts from the zod-parsed tool arguments. Undefined
 * keys are skipped so the result satisfies exactOptionalPropertyTypes.
 *
 * @internal
 */
export function toListOpts(input: ListOptsInput): ListOpts {
  const opts: ListOpts = {};
  if (input.limit !== undefined) opts.limit = input.limit;
  if (input.offset !== undefined) opts.offset = input.offset;
  if (input.bbox !== undefined) {
    // Copy into a fresh tuple so the readonly Bbox contract is preserved.
    const bbox: Bbox = [input.bbox[0], input.bbox[1], input.bbox[2], input.bbox[3]];
    opts.bbox = bbox;
  }
  if (input.near !== undefined) opts.near = input.near;
  if (input.sort !== undefined) {
    opts.sort =
      input.sort.order !== undefined
        ? { field: input.sort.field, order: input.sort.order }
        : { field: input.sort.field };
  }
  return opts;
}
