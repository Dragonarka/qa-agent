import { click, defineFlow, expectText, expectVisible, fill, screenshot } from '@qa-agent/core';

/**
 * Runs against the "local-fixture" environment (environments/local.json),
 * which opens fixtures/login-fixture.html directly — no network access,
 * no API keys, no real backend. It demonstrates the full flow mechanics
 * (fill/click/assert/screenshot) and the always-runs cleanup hook, not a
 * real authentication flow; the real EnvironmentAdapter does that part
 * (see ClerkTestUserAdapter in @qa-agent/core for how a real app's
 * sign-in bootstrap plugs in).
 *
 * Invoke via:
 *   pnpm --filter @qa-agent/cli start -- run --env local --flow ../../flows/example-login.ts
 */
export default defineFlow({
  name: 'example-login',
  description: 'Fill the fixture login form and verify the welcome state appears',
  steps: [
    fill('#username', 'qa-agent', 'enter username'),
    fill('#password', 'super-secret', 'enter password'),
    click('#submit', 'submit login form'),
    expectVisible('#welcome', 'welcome message is visible'),
    expectText('#welcome', 'Welcome, qa-agent!', 'welcome message greets the test user'),
    screenshot('post-login'),
  ],
});
