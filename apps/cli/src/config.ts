import type { ClientConfig } from '@hw/reearth-api-server';

/**
 * Build a {@link ClientConfig} from process.env.
 *
 * Single SoT for env → config conversion inside the CLI. All subcommands
 * ({@link commands/list}, future `mcp`, `serve`, etc.) share this path so
 * that the env contract is defined once.
 *
 * Throws with a user-friendly message when required vars are missing; the
 * CLI entry catches and prints the message without a stack trace.
 */
export function loadConfig(): ClientConfig {
  const baseUrl = requireEnv('CMS_BASE_URL');
  const workspace = requireEnv('CMS_WORKSPACE');
  const project = requireEnv('CMS_PROJECT');
  const integrationToken = requireEnv('CMS_INTEGRATION_TOKEN');
  const publicToken = optionalEnv('CMS_PUBLIC_TOKEN');

  return {
    baseUrl,
    workspace,
    project,
    integrationToken,
    ...(publicToken !== undefined ? { publicToken } : {}),
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    throw new ConfigError(
      `Missing env var: ${key}. Set it in apps/server/.env (copy from .env.example).`,
    );
  }
  return v;
}

function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === '' ? undefined : v;
}

/**
 * Distinguishable error class so CLI entry can render it plainly.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
