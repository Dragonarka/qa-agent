import { LocalFixtureAdapter, type EnvironmentAdapter, type EnvironmentConfig } from '@qa-agent/core';

/**
 * Adapters wired into the generic `qa-agent run` CLI, keyed by the
 * `adapter` field in an environment config JSON file.
 *
 * Only adapters fully describable in plain JSON belong here.
 * ClerkTestUserAdapter (see @qa-agent/core) deliberately is NOT
 * registered: real-world adapters often need a callback (e.g.
 * "how do I know sign-in actually landed") that doesn't serialize to
 * JSON. Use it as a library from a small custom script instead — see
 * README "Adding a new environment adapter".
 */
const registry: Record<string, (env: EnvironmentConfig) => EnvironmentAdapter> = {
  'local-fixture': () => new LocalFixtureAdapter(),
};

export function resolveAdapter(env: EnvironmentConfig): EnvironmentAdapter {
  const factory = registry[env.adapter];
  if (!factory) {
    const available = Object.keys(registry).join(', ');
    throw new Error(`Unknown adapter "${env.adapter}". Registered adapters: ${available}`);
  }
  return factory(env);
}
