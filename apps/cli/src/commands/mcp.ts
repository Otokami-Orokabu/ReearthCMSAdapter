import type { Command } from 'commander';
import { startMcpServer } from '../adapters/mcp.js';

/**
 * `reearth-cms mcp`
 *
 * Starts the MCP server on stdio. Intended to be launched by an MCP client
 * (Claude Code, Cursor, etc.) via a config entry such as:
 *
 * ```json
 * {
 *   "mcpServers": {
 *     "reearth-cms": {
 *       "command": "reearth-cms",
 *       "args": ["mcp"]
 *     }
 *   }
 * }
 * ```
 *
 * The adapter never writes to stdout except via the JSON-RPC transport.
 */
export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start an MCP server on stdio (for Claude Code, Cursor, etc.)')
    .action(async () => {
      await startMcpServer();
    });
}
