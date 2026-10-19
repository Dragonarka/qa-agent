# qa-agent

A CLI/library that drives a real browser through an application flow — sign in as a test user, click through the app, verify state, clean up what it created, and report pass/fail with evidence (screenshots + a JSON report).

## Why this exists

Across other projects (`competition-platform`, `trip-brain`, …), the same verification pattern kept getting done by hand, in an ad-hoc script, inside each project: create a test user in whatever auth provider that app uses, sign in, drive the real app in a real browser, assert the DB/UI state, then delete the test user and any rows it created. The concrete case this was extracted from is trip-brain's Phase 4 verification: creating real Clerk test users via Clerk's Backend API, signing in via a sign-in-ticket URL (no password typing, no email code), driving the Next.js app, comparing state across two users, then deleting both.

`qa-agent` formalizes that pattern into something reusable across projects instead of rewriting it per project: an `EnvironmentAdapter` plugs in how a given environment's credentials/test users get bootstrapped, a `Flow` describes the app steps to drive and verify, a `FlowRunner` executes the flow and always runs cleanup, and a `Reporter` produces the pass/fail report with evidence.

## Architecture

```
packages/core/           the engine (library)
  src/flow/               Flow + Step types, defineFlow() and step builders (fill/click/expectText/...)
  src/adapters/           EnvironmentAdapter interface + two implementations (see below)
  src/runner/             FlowRunner: wires adapter.setup() -> steps -> adapter.cleanup(), always, even on failure
  src/evidence/           screenshot capture into a per-run evidence directory
  src/reporter/           Report type + JSON writer + console summary
  src/stagehand/          thin wrapper that launches a local Stagehand browser session

apps/cli/                 thin CLI (commander) that parses args/env config and calls into core

environments/             JSON env configs (environments/<name>.json), e.g. which adapter + its options
flows/                    flow definitions (.ts, default-export a Flow via defineFlow())
fixtures/                 static HTML used by the runnable example — no real backend involved
```

### Flow definitions: TS, not YAML

Flows are plain TypeScript modules that `export default defineFlow({ name, steps })`, built from typed step helpers (`navigate`, `fill`, `click`, `expectVisible`, `expectText`, `screenshot`, `custom`, `aiAct`) in `packages/core/src/flow/define.ts`. This was picked over YAML because a flow regularly needs to reference real, type-checked app-specific helpers (a page-object function, a generated selector constant, a shared assertion) — and once a flow needs an escape hatch into real code, a YAML format ends up re-inventing a small scripting language inside string fields. The trade-off: TS flows aren't editable by a non-engineer in a text box the way YAML is. For v0 (an engineer-invoked CLI/library, not yet a product for non-technical users) that trade-off favors TS.

### EnvironmentAdapter: pluggable credential/test-user bootstrapping

```ts
interface EnvironmentAdapter {
  readonly name: string;
  setup(ctx: EnvironmentContext): Promise<AuthenticatedSession>;
}

interface AuthenticatedSession {
  baseUrl: string;
  cleanup(): Promise<void>; // the FlowRunner always calls this, pass or fail
  cleanupNote?: string;
}
```

This is the actual differentiator this project is designed around: different target apps use different auth providers (Clerk, plain email/password, magic links, …), and "how do I get a signed-in browser session for a disposable test user, and how do I delete it afterward" is exactly the part that's specific per environment and currently unsolved generically by competitors. See `packages/core/src/adapters/types.ts`.

Two adapters ship:

- **`LocalFixtureAdapter`** (`adapters/local-fixture-adapter.ts`) — the adapter the runnable example actually uses. Opens a static HTML file (`fixtures/login-fixture.html`) via a `file://` URL. No network, no credentials. Its "cleanup" only clears browser storage, because the fixture has no backend or database — there is no real test user to delete, and the code says so rather than pretending otherwise.
- **`ClerkTestUserAdapter`** (`adapters/clerk-test-user-adapter.ts`) — the generalized version of the trip-brain pattern: create a user via Clerk's Backend API, mint a sign-in token, drive the browser through the resulting ticket URL, delete the user on cleanup. It's implemented against Clerk's real Backend API request/response shapes and is fully typed, but **it is not exercised by this repo's verification** — that would need a real Clerk instance and secret key. Treat it as reviewed-but-untested until it's run against a real Clerk test environment. It's intentionally not wired into the CLI's adapter registry either (see "Adding a new environment adapter" below) because it needs a callback (confirming sign-in actually landed) that doesn't serialize into JSON config.

### FlowRunner + Reporter

`runFlow()` (`packages/core/src/runner/flow-runner.ts`) does, in order: launch a local Stagehand browser session → `adapter.setup()` → run each step, capturing a screenshot after every step (and an extra one on failure) → in a `finally` block, always call `session.cleanup()` and close the browser, regardless of what happened above → return a `Report`. The CLI writes that report to `<evidenceDir>/report.json` and prints a pass/fail summary with per-step status and screenshot paths.

### Decision record: Stagehand, not browser-use, not a bespoke driver

- **Playwright** was the execution layer this whole space converged on (QA Wolf, Shiplight, and Stagehand's own earlier major versions all sit on it) — the reason to not write this against raw Selenium/Puppeteer. Note for anyone reading the code expecting a literal `playwright.Page`: the installed `@browserbasehq/stagehand` major version (3.x, at the time this was built) replaced its Playwright-backed core with its own CDP automation layer ("Understudy") exposing an equivalent `Page`/`Locator` API (`goto`, `locator().fill()/.click()`, `waitForSelector`, `screenshot`, `evaluate`) — `playwright`/`playwright-core` is still a peer dependency (used to provision/launch the actual browser binary), but `stagehand.context.pages()` returns Stagehand's own `Page`, not Playwright's. The decision below is about the trade-off Stagehand's API embodies, not about a specific internal driver.
- **Stagehand** (`@browserbasehq/stagehand`, MIT) was chosen as the wrapper because it lets a flow author pick, step by step, where deterministic code runs versus where an LLM call does — deterministic `page.goto()/.locator().fill()/.click()` for most steps, versus `stagehand.act("click the invite link")` / `stagehand.extract(...)` for "resilient" steps that tolerate the UI looking roughly right rather than needing an exact selector. That split matters specifically because environment/credential bootstrapping (the Clerk pattern above) has to be deterministic and reliable — an LLM should never be in the loop for "create this test user" — while verifying an app flow ("confirm the checklist item now shows checked") benefits from selector-resilient, AI-assisted steps. `aiAct()` in `flow/define.ts` is that extension point; the bundled example doesn't use it, by design, so it runs with zero API keys.
- **`browser-use`** (MIT, more fully autonomous, larger community) was considered and rejected for v0. It's built for open-ended "go figure out how to do this" autonomy, not developer-controlled flows with precise, auditable environment/credential handling — which is the opposite of what this tool needs for the bootstrapping half of the problem. A `browser-use`-style autonomous "research mode" (point it at an app with no flow definition and have it explore) is a plausible future mode, listed under Roadmap, not something v0 needs.

## Adding a new environment adapter

1. Implement `EnvironmentAdapter` (`packages/core/src/adapters/types.ts`): `setup(ctx)` returns `{ baseUrl, cleanup(), cleanupNote? }`.
2. If every option it needs can round-trip through JSON, register it in `apps/cli/src/adapter-registry.ts` so `environments/<name>.json` can reference it by name.
3. If it needs a callback (a function value, not JSON-serializable — e.g. "how do I know sign-in landed", the reason `ClerkTestUserAdapter` isn't in the CLI registry), use it as a library: write a small script that imports `runFlow` from `@qa-agent/core` directly, constructs the adapter with real options, and calls `runFlow({ flow, adapter, env, evidenceDir })` yourself instead of going through the generic `qa-agent run` CLI.

## Running the example

```bash
pnpm install
pnpm --filter @qa-agent/core exec playwright install chromium   # one-time browser download
pnpm --filter @qa-agent/cli start -- run --env local --flow ../../flows/example-login.ts
```

This fills in the fixture's login form, asserts the welcome message appears with the right text, screenshots each step, and writes a report to `.qa-agent/evidence/<timestamp>-example-login/` (JSON report + PNGs). Exit code is `0` on pass, `1` on fail.

## What's real vs. what's scaffold

This is an initial scaffold (analogous to how `trip-brain` started as a static base before growing a real backend over several phases) — it is not a finished product.

**Real and verified:**
- `Flow` / `Step` types, `defineFlow()`, and the step builders.
- `EnvironmentAdapter` interface and `FlowRunner` (setup → steps → cleanup-always, even on setup failure or a mid-flow step failure).
- `LocalFixtureAdapter` + the fixture — genuinely runs end-to-end, screenshots each step, writes a real JSON report, and exits non-zero on failure.
- `Reporter` (JSON report + console summary).

**Documented but not exercised:**
- `ClerkTestUserAdapter` — real Clerk Backend API shapes, fully typed, but needs a live Clerk instance + secret key to actually run. Not covered by any test in this repo.
- `aiAct()` — the Stagehand AI-assisted step extension point. Wired through to `stagehand.act()`, but needs an LLM provider configured on the Stagehand instance; no flow in this repo uses it.

**Not built at all (see Roadmap):**
- Any hosted component, dashboard, or billing.
- A second, JSON-configurable adapter beyond `local-fixture` (Clerk needs a real instance to prove out; a plain email/password adapter would be the next logical one to add against a real target app).
- Automated unit/integration tests for the engine itself (the "test" it has is the one real end-to-end run against the fixture, described above).

## Roadmap / explicitly out of scope for v0

- Hosted SaaS, dashboard, or billing.
- Multi-tenant anything.
- `browser-use`-style autonomous "research mode" (point it at an app with no flow definition, let it explore and report what it found) — plausible future mode, not v0.
- Playwright-MCP integration.
- A YAML (or other non-TS) flow format for non-engineer authoring.
- Parallel/sharded flow execution, retries, or a CI-oriented runner mode.
