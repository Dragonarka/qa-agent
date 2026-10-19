import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { printReportSummary, runFlow, writeReport, type Flow } from '@qa-agent/core';

import { resolveAdapter } from '../adapter-registry.js';
import { findDirUpward, loadEnvironmentConfig } from '../config-loader.js';

export interface RunCommandOptions {
  env: string;
  flow: string;
  out?: string;
  headless?: boolean;
}

interface FlowModule {
  default?: Flow;
  flow?: Flow;
}

async function loadFlow(flowPath: string): Promise<Flow> {
  const absolutePath = path.resolve(process.cwd(), flowPath);
  const mod = (await import(pathToFileURL(absolutePath).href)) as FlowModule;
  const flow = mod.default ?? mod.flow;
  if (!flow) {
    throw new Error(
      `${absolutePath} does not export a Flow. Export it as "export default defineFlow(...)".`,
    );
  }
  return flow;
}

export async function runCommand(options: RunCommandOptions): Promise<number> {
  const environmentsDir = await findDirUpward(process.cwd(), 'environments');
  const repoRoot = path.dirname(environmentsDir);

  const env = await loadEnvironmentConfig(environmentsDir, options.env);
  if (options.headless !== undefined) {
    env.headless = options.headless;
  }

  const flow = await loadFlow(options.flow);
  const adapter = resolveAdapter(env);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const flowSlug = flow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const evidenceDir =
    options.out ?? path.join(repoRoot, '.qa-agent', 'evidence', `${timestamp}-${flowSlug}`);

  const report = await runFlow({ flow, adapter, env, evidenceDir: path.resolve(evidenceDir) });

  await writeReport(report);
  printReportSummary(report);

  return report.status === 'passed' ? 0 : 1;
}
