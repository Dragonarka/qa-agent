import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@browserbasehq/stagehand';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export class EvidenceCollector {
  private stepIndex = 0;

  constructor(
    private readonly evidenceDir: string,
    private readonly flowName: string,
  ) {}

  async ensureDir(): Promise<void> {
    await mkdir(this.evidenceDir, { recursive: true });
  }

  async captureScreenshot(page: Page, stepName: string): Promise<string> {
    this.stepIndex += 1;
    const fileName = `${String(this.stepIndex).padStart(2, '0')}-${slugify(stepName)}.png`;
    const absolutePath = path.join(this.evidenceDir, fileName);
    await page.screenshot({ path: absolutePath });
    return absolutePath;
  }

  get flowSlug(): string {
    return slugify(this.flowName);
  }
}
