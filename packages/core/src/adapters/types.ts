import type { Page, Stagehand } from '@browserbasehq/stagehand';

export interface EnvironmentConfig {
  name: string;
  adapter: string;
  baseUrl?: string;
  headless?: boolean;
  adapterOptions?: Record<string, unknown>;
  /** Absolute path to the directory the environment config file was loaded from. */
  configDir: string;
}

export interface EnvironmentContext {
  env: EnvironmentConfig;
  stagehand: Stagehand;
  page: Page;
}

export interface AuthenticatedSession {
  baseUrl: string;
  /**
   * Must be idempotent. The FlowRunner always calls this in a `finally`
   * block, whether the flow passed, failed, or threw before completing a
   * single step — adapters cannot opt out of cleanup running.
   */
  cleanup(): Promise<void>;
  /** Human-readable note surfaced in the report, e.g. what cleanup did or why there was nothing to clean up. */
  cleanupNote?: string;
}

export interface EnvironmentAdapter {
  readonly name: string;
  setup(ctx: EnvironmentContext): Promise<AuthenticatedSession>;
}
