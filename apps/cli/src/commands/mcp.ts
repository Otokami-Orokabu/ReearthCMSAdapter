import type { Command } from 'commander';
import { startMcpServer } from '../adapters/mcp/index.js';

/**
 * reearth-cms mcp
 *
 * Start the MCP server on stdio. Intended to be launched by an MCP
 * client via a config entry. The adapter writes only JSON-RPC frames
 * to stdout; human-readable logs go to stderr.
 */
export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start an MCP server on stdio (for Claude Code, Cursor, etc.)')
    .action(async () => {
      await startMcpServer();
    });
}
