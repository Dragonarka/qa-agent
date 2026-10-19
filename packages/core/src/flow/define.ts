import type { Flow, Step, StepContext } from './types.js';

export function defineFlow(flow: Flow): Flow {
  if (!flow.name.trim()) {
    throw new Error('defineFlow: flow.name must be a non-empty string');
  }
  if (flow.steps.length === 0) {
    throw new Error(`defineFlow: flow "${flow.name}" has no steps`);
  }
  return flow;
}

export function navigate(url: string): Step {
  return {
    name: `navigate to ${url}`,
    async run({ page }: StepContext) {
      await page.goto(url);
    },
  };
}

export function fill(selector: string, value: string, label?: string): Step {
  return {
    name: label ?? `fill "${selector}"`,
    async run({ page }: StepContext) {
      await page.locator(selector).fill(value);
    },
  };
}

export function click(selector: string, label?: string): Step {
  return {
    name: label ?? `click "${selector}"`,
    async run({ page }: StepContext) {
      await page.locator(selector).click();
    },
  };
}

export function expectVisible(selector: string, label?: string, timeoutMs = 5000): Step {
  return {
    name: label ?? `expect "${selector}" visible`,
    async run({ page }: StepContext) {
      await page.waitForSelector(selector, { state: 'visible', timeout: timeoutMs });
    },
  };
}

export function expectText(selector: string, expected: string, label?: string): Step {
  return {
    name: label ?? `expect "${selector}" to contain "${expected}"`,
    async run({ page }: StepContext) {
      const actual = await page.locator(selector).textContent();
      if (!actual.includes(expected)) {
        throw new Error(`expected "${selector}" text to contain "${expected}", got "${actual}"`);
      }
    },
  };
}

export function screenshot(label: string): Step {
  return {
    name: `screenshot: ${label}`,
    async run() {
      // The runner captures a screenshot after every step automatically.
      // This step exists purely to label a moment in the report as
      // intentionally significant (e.g. "post-login state").
    },
  };
}

export function custom(name: string, run: (ctx: StepContext) => Promise<void>): Step {
  return { name, run };
}

/**
 * LLM-assisted step builder — the "where AI enters the script" extension
 * point Stagehand provides. Calls `stagehand.act()`, which requires the
 * Stagehand instance to be configured with an LLM provider (e.g.
 * ANTHROPIC_API_KEY). Not used by the bundled example flow, which is
 * intentionally deterministic so it runs with zero API keys and zero
 * network access. See README "Stagehand, not browser-use" for the
 * rationale on where AI steps belong versus deterministic ones.
 */
export function aiAct(instruction: string): Step {
  return {
    name: `ai-act: ${instruction}`,
    async run({ stagehand }: StepContext) {
      await stagehand.act(instruction);
    },
  };
}
