import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { attachListOptions, buildListOpts, type ParsedListOptions } from '../optParsers.js';

/**
 * reearth-cms list <model> [--all] [--limit N] [--bbox ...] [--sort field[:order]] [--json]
 *
 * Lists items for a CMS model. Default reads the Public API (published
 * items); --all reads the Integration API (drafts + published). Filter
 * / sort / slice options come from attachListOptions.
 */
export function registerListCommand(program: Command): void {
  const cmd = program
    .command('list')
    .description('List items for a CMS model (Public API by default; --all = Integration)')
    .argument('<model>', 'Model key (e.g. hazzrd_reports)');
  attachListOptions(cmd, 'items')
    .option(
      '--all',
      'Include drafts (uses Integration API instead of Public API)',
    )
    .option('--json', 'Output full items as JSON')
    .action(
      async (
        model: string,
        options: ParsedListOptions & { all?: boolean; json?: boolean },
      ) => {
        const client = createClient(loadConfig());
        const listOpts = buildListOpts(options);
        const items =
          options.all === true
            ? await client.listAllItems<Record<string, unknown>>(model, listOpts)
            : await client.listItems<Record<string, unknown>>(model, listOpts);

        if (options.json === true) {
          process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
          return;
        }

        if (items.length === 0) {
          process.stdout.write('(no items)\n');
          return;
        }

        for (const item of items) {
          const id = typeof item.id === 'string' ? item.id : '?';
          const title =
            typeof item.title === 'string' && item.title.length > 0
              ? item.title
              : '(no title)';
          process.stdout.write(`${id}\t${title}\n`);
        }
      },
    );
}
