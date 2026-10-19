import { pathToFileURL } from 'node:url';
import path from 'node:path';

import type { AuthenticatedSession, EnvironmentAdapter, EnvironmentContext } from './types.js';

export interface LocalFixtureAdapterOptions {
  /** Path to a static HTML fixture, resolved relative to the environment config file's directory. */
  fixturePath: string;
}

/**
 * The runnable, no-credentials example adapter. It opens a local static
 * HTML file directly (file:// URL) — there is no real backend, no real
 * auth provider, and no real test user. This is deliberately the
 * simplest possible EnvironmentAdapter so the example flow can run
 * end-to-end without network access or API keys.
 *
 * Because the fixture has no backend or persistent state, `cleanup()`
 * only clears client-side browser storage as a demonstration of the
 * cleanup hook firing — it is NOT standing in for "deleting a test
 * user." Adapters backed by a real environment (see
 * ClerkTestUserAdapter) perform real deletion via that environment's
 * API during cleanup.
 */
export class LocalFixtureAdapter implements EnvironmentAdapter {
  readonly name = 'local-fixture';

  async setup(ctx: EnvironmentContext): Promise<AuthenticatedSession> {
    const options = ctx.env.adapterOptions as LocalFixtureAdapterOptions | undefined;
    if (!options?.fixturePath) {
      throw new Error('LocalFixtureAdapter requires adapterOptions.fixturePath');
    }

    const absoluteFixturePath = path.resolve(ctx.env.configDir, options.fixturePath);
    const fixtureUrl = pathToFileURL(absoluteFixturePath).href;

    const { page, stagehand } = ctx;
    await page.goto(fixtureUrl);

    return {
      baseUrl: fixtureUrl,
      cleanupNote:
        'fixture has no backend/database — cleanup only clears browser storage, not a real test user',
      async cleanup() {
        // Passed as a string, not a closure, so this evaluates in the page's
        // own browser context without requiring "dom" lib types here —
        // core stays typecheckable by consumers that only target Node.
        await page.evaluate('window.localStorage.clear(); window.sessionStorage.clear();');
        await stagehand.context.clearCookies();
      },
    };
  }
}
