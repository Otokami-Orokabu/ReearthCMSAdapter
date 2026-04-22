/**
 * Smoke test for @hw/reearth-api-server against a real Re:Earth CMS.
 *
 * Reads config from `apps/server/.env` (via `--env-file`).
 * Exercises both the Public API (read) and Integration API (write) paths.
 *
 * Run:
 *   npm run -w @hw/reearth-api-server smoke
 *
 * CMS_MODEL supports two formats:
 *   - single:  CMS_MODEL=move_lob
 *   - array:   CMS_MODEL=[move_lob,hazzrd_reports]
 *
 * If the create phase fails because the first model does not have a `title`
 * field of type `text`, edit the CREATE_PAYLOAD constant below.
 */
import { createClient, type ClientConfig, type CmsPayload } from '../src/index.js';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing or empty env var: ${key}`);
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Parse a CMS_MODEL env value into a list of model identifiers.
 * Accepts either `foo` (single) or `[foo,bar,baz]` (bracketed array).
 */
function parseModels(raw: string): string[] {
  const trimmed = raw.trim();
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1)
    : trimmed;
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const CREATE_PAYLOAD: CmsPayload = {
  title: { type: 'text', value: `smoke test ${new Date().toISOString()}` },
};

async function main(): Promise<void> {
  const baseUrl = requireEnv('CMS_BASE_URL');
  const workspace = requireEnv('CMS_WORKSPACE');
  const project = requireEnv('CMS_PROJECT');
  const integrationToken = requireEnv('CMS_INTEGRATION_TOKEN');
  const publicToken = optionalEnv('CMS_PUBLIC_TOKEN');
  const models = parseModels(requireEnv('CMS_MODEL'));
  if (models.length === 0) throw new Error('CMS_MODEL must contain at least one model');

  const config: ClientConfig = {
    baseUrl,
    workspace,
    project,
    integrationToken,
    ...(publicToken !== undefined ? { publicToken } : {}),
  };

  const client = createClient(config);

  console.log('==================================================');
  console.log('[A] listItems via Public API (all models)');
  console.log(`    models: ${models.join(', ')}`);
  console.log('==================================================');
  const countsBefore: Record<string, number> = {};
  for (const model of models) {
    const items = await client.listItems<Record<string, unknown>>(model);
    countsBefore[model] = items.length;
    console.log(`  [${model}] count: ${items.length}`);
    if (items.length > 0) {
      console.log(`    first item:`);
      console.log(indent(JSON.stringify(items[0], null, 2), 6));
    }
  }

  // Create phase targets the FIRST model in the list
  const writeTarget = models[0];
  if (writeTarget === undefined) throw new Error('unreachable');

  console.log('');
  console.log('==================================================');
  console.log('[B] createItem via Integration API');
  console.log(`    model:   ${writeTarget}`);
  console.log(`    payload: ${JSON.stringify(CREATE_PAYLOAD)}`);
  console.log('==================================================');
  const created = await client.createItem<Record<string, unknown>>(writeTarget, CREATE_PAYLOAD);
  console.log('  created item:');
  console.log(indent(JSON.stringify(created, null, 2), 4));

  console.log('');
  console.log('==================================================');
  console.log('[C] listItems again to verify delta');
  console.log('==================================================');
  for (const model of models) {
    const items = await client.listItems<Record<string, unknown>>(model);
    const before = countsBefore[model] ?? 0;
    const delta = items.length - before;
    console.log(`  [${model}] count: ${items.length} (delta: ${delta >= 0 ? '+' : ''}${delta})`);
  }

  console.log('');
  console.log('[smoke] DONE — all phases succeeded.');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => pad + line)
    .join('\n');
}

main().catch((err: unknown) => {
  console.error('\n[smoke] FAILED');
  console.error(err);
  process.exit(1);
});
