import type { ClientConfig } from '@hw/reearth-api-server';

/**
 * Build a ClientConfig from process.env.
 *
 * @throws ConfigError with a user-friendly message when a required
 *   variable is missing. The CLI entry catches this and prints the
 *   message without a stack trace.
 */
export function loadConfig(): ClientConfig {
  return {
    baseUrl: requireEnv('CMS_BASE_URL'),
    workspace: requireEnv('CMS_WORKSPACE'),
    project: requireEnv('CMS_PROJECT'),
    integrationToken: requireEnv('CMS_INTEGRATION_TOKEN'),
  };
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    throw new ConfigError(
      `Missing env var: ${key}. Set it in .env (copy from .env.example).`,
    );
  }
  return v;
}

/** Distinguishable error class so the CLI entry can render env failures
 *  as a single line instead of a stack trace. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
