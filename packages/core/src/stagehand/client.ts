import { Stagehand, type Page } from '@browserbasehq/stagehand';

export interface StagehandClientOptions {
  headless?: boolean;
}

export interface StagehandSession {
  stagehand: Stagehand;
  page: Page;
}

/**
 * Creates a local Stagehand instance without configuring an LLM provider.
 * This is intentional: deterministic steps (navigate/fill/click/expect) work
 * with zero API keys, and only the `aiAct`-style steps (see flow/define.ts)
 * require a model to be configured. Flows that need AI-assisted steps
 * should construct Stagehand with model credentials themselves — out of
 * scope for the bundled example, which must run with no network access.
 */
export async function createStagehand(options: StagehandClientOptions = {}): Promise<StagehandSession> {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    localBrowserLaunchOptions: { headless: options.headless ?? true },
  });
  await stagehand.init();

  const page = stagehand.context.pages()[0] ?? (await stagehand.context.newPage());
  return { stagehand, page };
}
