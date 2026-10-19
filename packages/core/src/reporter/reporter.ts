import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Report } from './types.js';

export async function writeReport(report: Report): Promise<string> {
  const reportPath = path.join(report.evidenceDir, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return reportPath;
}

export function printReportSummary(report: Report): void {
  const icon = report.status === 'passed' ? 'PASS' : 'FAIL';
  console.log(`\n[${icon}] ${report.flowName} (env: ${report.environment})`);
  console.log(`  duration: ${report.durationMs}ms`);

  for (const step of report.steps) {
    const stepIcon = step.status === 'passed' ? '✓' : step.status === 'failed' ? '✗' : '-';
    console.log(`  ${stepIcon} ${step.name} (${step.durationMs}ms)`);
    if (step.error) {
      console.log(`      error: ${step.error}`);
    }
    if (step.screenshotPath) {
      console.log(`      evidence: ${step.screenshotPath}`);
    }
  }

  console.log(
    `  cleanup: ${report.cleanup.ran ? (report.cleanup.ok ? 'ok' : 'FAILED') : 'did not run'}`,
  );
  if (report.cleanup.note) {
    console.log(`      note: ${report.cleanup.note}`);
  }
  if (report.cleanup.error) {
    console.log(`      error: ${report.cleanup.error}`);
  }
  console.log(`  evidence dir: ${report.evidenceDir}\n`);
}
