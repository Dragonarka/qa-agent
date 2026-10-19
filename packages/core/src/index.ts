export type { Flow, Step, StepContext, StepResult, StepStatus } from './flow/types.js';
export {
  defineFlow,
  navigate,
  fill,
  click,
  expectVisible,
  expectText,
  screenshot,
  custom,
  aiAct,
} from './flow/define.js';

export type {
  AuthenticatedSession,
  EnvironmentAdapter,
  EnvironmentConfig,
  EnvironmentContext,
} from './adapters/types.js';
export { LocalFixtureAdapter } from './adapters/local-fixture-adapter.js';
export type { LocalFixtureAdapterOptions } from './adapters/local-fixture-adapter.js';
export { ClerkTestUserAdapter } from './adapters/clerk-test-user-adapter.js';
export type { ClerkTestUserAdapterOptions } from './adapters/clerk-test-user-adapter.js';

export { runFlow } from './runner/flow-runner.js';
export type { RunFlowOptions } from './runner/flow-runner.js';

export type { CleanupResult, Report } from './reporter/types.js';
export { writeReport, printReportSummary } from './reporter/reporter.js';

export { createStagehand } from './stagehand/client.js';
export type { StagehandClientOptions } from './stagehand/client.js';
