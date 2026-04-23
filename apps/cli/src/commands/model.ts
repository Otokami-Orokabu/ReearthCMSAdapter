import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * `reearth-cms model <id-or-key> [--json]`
 *
 * Fetch a single model with its schema (field definitions). Distinct from
 * `reearth-cms models` which lists all models without schema detail.
 *
 * Default output is a compact table of fields (key / type / required /
 * multiple); `--json` dumps the full CmsModelDetail.
 */
export function registerModelCommand(program: Command): void {
  program
    .command('model')
    .description('Get a single model with its schema (Integration API)')
    .argument('<id-or-key>', 'Model id (UUID) or key')
    .option('--json', 'Output as JSON')
    .action(async (idOrKey: string, options: { json?: boolean }) => {
      const client = createClient(loadConfig());
      const model = await client.getModel(idOrKey);
      if (model === null) {
        process.stderr.write(`error: model "${idOrKey}" not found\n`);
        process.exit(1);
      }

      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
        return;
      }

      process.stdout.write(`${model.name} (${model.key})\n`);
      process.stdout.write(`  id: ${model.id}\n`);
      if (model.description !== undefined) {
        process.stdout.write(`  description: ${model.description}\n`);
      }
      if (model.titleField !== undefined) {
        process.stdout.write(`  titleField: ${model.titleField}\n`);
      }
      process.stdout.write(`  fields (${String(model.fields.length)}):\n`);
      for (const f of model.fields) {
        const flags = [
          f.required ? 'required' : '',
          f.multiple ? 'multiple' : '',
        ].filter((s) => s.length > 0);
        const tag = flags.length > 0 ? ` [${flags.join(',')}]` : '';
        process.stdout.write(`    ${f.key}\t${f.type}${tag}\t${f.name}\n`);
      }
    });
}
