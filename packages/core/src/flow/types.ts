import type { Page, Stagehand } from '@browserbasehq/stagehand';

export interface StepContext {
  page: Page;
  /** The underlying Stagehand instance — only needed for AI-assisted steps (aiAct/aiExtract/aiObserve). */
  stagehand: Stagehand;
  baseUrl: string;
  vars: Record<string, unknown>;
}

export type StepStatus = 'passed' | 'failed' | 'skipped';

export interface StepResult {
  name: string;
  status: StepStatus;
  durationMs: number;
  error?: string;
  screenshotPath?: string;
}

export interface Step {
  name: string;
  run(ctx: StepContext): Promise<void>;
}

export interface Flow {
  name: string;
  description?: string;
  steps: Step[];
}
