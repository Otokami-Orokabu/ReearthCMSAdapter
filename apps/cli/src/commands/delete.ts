import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * reearth-cms delete <id> [--yes]
 *
 * Delete an item. Prompts for confirmation unless --yes is passed.
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
 * Minimal stdin prompt. Resolves to true on "y" / "yes" (case-insensitive),
 * false otherwise. On non-TTY stdin (pipe / CI) the call exits with code
 * 1 so the caller cannot hang waiting for input.
 */
async function promptYesNo(question: string): Promise<boolean> {
  if (process.stdin.isTTY !== true) {
    process.stderr.write(
      'error: delete requires --yes on non-interactive stdin (pipe / CI)\n',
    );
    process.exit(1);
  }
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
