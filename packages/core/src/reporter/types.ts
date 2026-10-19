import type { StepResult } from '../flow/types.js';

export interface CleanupResult {
  ran: boolean;
  ok: boolean;
  error?: string;
  note?: string;
}

export interface Report {
  flowName: string;
  environment: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'passed' | 'failed';
  steps: StepResult[];
  cleanup: CleanupResult;
  evidenceDir: string;
}
