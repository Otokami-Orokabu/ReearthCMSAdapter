import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * `reearth-cms delete <id> [--yes]`
 *
 * Deletes an item via the Integration API. Destructive operation — prompts
 * for confirmation unless `--yes` is passed.
 */
export function registerDeleteCommand(program: Command): void {
  program
    .command('delete')
    .description('Delete an item by id (Integration API)')
    .argument('<id>', 'Item id')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (id: string, options: { yes?: boolean }) => {
      if (options.yes !== true) {
        const answer = await promptYesNo(`Delete item ${id}? [y/N] `);
        if (!answer) {
          process.stdout.write('aborted.\n');
          return;
        }
      }
      const client = createClient(loadConfig());
      await client.deleteItem(id);
      process.stdout.write(`deleted ${id}\n`);
    });
}

/**
 * Minimal stdin prompt. Resolves to `true` on "y"/"Y"/"yes", `false` otherwise.
 * Avoids bringing in an interactive-prompt library for this single use.
 */
async function promptYesNo(question: string): Promise<boolean> {
  process.stdout.write(question);
  return new Promise<boolean>((resolve) => {
    const onData = (chunk: Buffer): void => {
      const input = chunk.toString('utf8').trim().toLowerCase();
      process.stdin.off('data', onData);
      process.stdin.pause();
      resolve(input === 'y' || input === 'yes');
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
