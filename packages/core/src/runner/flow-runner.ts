import type { EnvironmentAdapter, EnvironmentConfig } from '../adapters/types.js';
import { EvidenceCollector } from '../evidence/evidence-collector.js';
import type { Flow, StepResult } from '../flow/types.js';
import type { CleanupResult, Report } from '../reporter/types.js';
import { createStagehand } from '../stagehand/client.js';

export interface RunFlowOptions {
  flow: Flow;
  adapter: EnvironmentAdapter;
  env: EnvironmentConfig;
  evidenceDir: string;
}

export async function runFlow(options: RunFlowOptions): Promise<Report> {
  const { flow, adapter, env, evidenceDir } = options;
  const startedAt = new Date();

  const evidence = new EvidenceCollector(evidenceDir, flow.name);
  await evidence.ensureDir();

  const { stagehand, page } = await createStagehand({ headless: env.headless });
  const steps: StepResult[] = [];
  const vars: Record<string, unknown> = {};
  let cleanup: CleanupResult = { ran: false, ok: false };
  let session: Awaited<ReturnType<EnvironmentAdapter['setup']>> | undefined;

  let flowFailed = false;

  try {
    try {
      session = await adapter.setup({ env, stagehand, page });
    } catch (error) {
      steps.push({
        name: 'environment setup',
        status: 'failed',
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      });
      flowFailed = true;
    }

    for (const step of flow.steps) {
      const stepStartedAt = Date.now();

      if (flowFailed) {
        steps.push({ name: step.name, status: 'skipped', durationMs: 0 });
        continue;
      }

      try {
        // flowFailed is false here, which only happens once adapter.setup()
        // has resolved successfully, so session is guaranteed to be set.
        await step.run({ page, stagehand, baseUrl: session!.baseUrl, vars });
        const screenshotPath = await evidence.captureScreenshot(page, step.name);
        steps.push({
          name: step.name,
          status: 'passed',
          durationMs: Date.now() - stepStartedAt,
          screenshotPath,
        });
      } catch (error) {
        const screenshotPath = await evidence
          .captureScreenshot(page, `${step.name}-failure`)
          .catch(() => undefined);
        steps.push({
          name: step.name,
          status: 'failed',
          durationMs: Date.now() - stepStartedAt,
          error: error instanceof Error ? error.message : String(error),
          screenshotPath,
        });
        flowFailed = true;
      }
    }
  } finally {
    if (session) {
      try {
        await session.cleanup();
        cleanup = { ran: true, ok: true, note: session.cleanupNote };
      } catch (error) {
        cleanup = {
          ran: true,
          ok: false,
          note: session.cleanupNote,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    await stagehand.close();
  }

  const finishedAt = new Date();
  const status: Report['status'] = steps.every((s) => s.status === 'passed') ? 'passed' : 'failed';

  return {
    flowName: flow.name,
    environment: env.name,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    status,
    steps,
    cleanup,
    evidenceDir,
  };
}
