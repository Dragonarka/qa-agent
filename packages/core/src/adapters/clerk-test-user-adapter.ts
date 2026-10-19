import type { Page } from '@browserbasehq/stagehand';

import type { AuthenticatedSession, EnvironmentAdapter, EnvironmentContext } from './types.js';

export interface ClerkTestUserAdapterOptions {
  /** Clerk Backend API secret key for the target instance (test/staging only — never production). */
  secretKey: string;
  /** Base URL of the app under test, e.g. "http://localhost:3000". */
  baseUrl: string;
  /** Email domain used to generate disposable test addresses. Defaults to "qa-agent.test". */
  emailDomain?: string;
  /** Path the sign-in ticket is appended to. Defaults to "/sign-in". */
  signInPath?: string;
  /**
   * Selector or predicate the adapter waits on after following the sign-in
   * ticket, to confirm the session actually landed signed-in before
   * handing control to the flow. Required because "sign-in succeeded" is
   * app-specific (a dashboard element, a redirect URL, etc).
   */
  waitForSignedIn: (page: Page) => Promise<void>;
}

interface ClerkUser {
  id: string;
}

interface ClerkSignInToken {
  token: string;
}

const CLERK_API_BASE = 'https://api.clerk.com/v1';

/**
 * Generalized version of the pattern used during trip-brain's Phase 4
 * verification: create a throwaway user via Clerk's Backend API, mint a
 * sign-in token, and drive the browser through the resulting sign-in
 * ticket URL instead of a real login form (no password typing, no
 * email/SMS code round-trip).
 *
 * This is implemented against Clerk's real Backend API request/response
 * shapes, but it is NOT exercised by this repo's verification — doing so
 * would require a real Clerk instance and secret key. It exists as the
 * concrete reference for "how would the trip-brain Clerk pattern plug
 * into EnvironmentAdapter" per the v0 scope. Treat it as reviewed-but-
 * untested until it's run against a real Clerk test instance.
 *
 * Generalizes two things that were hardcoded in the original ad-hoc
 * trip-brain script: the base URL / sign-in path (any app), and the
 * "did sign-in actually land" check (`waitForSignedIn`, since that's
 * necessarily app-specific).
 */
export class ClerkTestUserAdapter implements EnvironmentAdapter {
  readonly name = 'clerk-test-user';

  constructor(private readonly options: ClerkTestUserAdapterOptions) {}

  async setup(ctx: EnvironmentContext): Promise<AuthenticatedSession> {
    const user = await this.createTestUser();
    const ticketUrl = await this.buildSignInTicketUrl(user.id);

    const { page } = ctx;
    await page.goto(ticketUrl);
    await this.options.waitForSignedIn(page);

    return {
      baseUrl: this.options.baseUrl,
      cleanupNote: `deletes Clerk test user ${user.id} via Backend API`,
      cleanup: async () => {
        await this.deleteTestUser(user.id);
      },
    };
  }

  private async createTestUser(): Promise<ClerkUser> {
    const domain = this.options.emailDomain ?? 'qa-agent.test';
    const localPart = `qa-agent+${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const response = await fetch(`${CLERK_API_BASE}/users`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({
        email_address: [`${localPart}@${domain}`],
        skip_password_requirement: true,
        skip_password_checks: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Clerk: failed to create test user (${response.status})`);
    }

    return (await response.json()) as ClerkUser;
  }

  private async buildSignInTicketUrl(userId: string): Promise<string> {
    const response = await fetch(`${CLERK_API_BASE}/sign_in_tokens`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      throw new Error(`Clerk: failed to create sign-in token (${response.status})`);
    }

    const signInToken = (await response.json()) as ClerkSignInToken;
    const signInPath = this.options.signInPath ?? '/sign-in';
    return `${this.options.baseUrl}${signInPath}?__clerk_ticket=${signInToken.token}`;
  }

  private async deleteTestUser(userId: string): Promise<void> {
    const response = await fetch(`${CLERK_API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Clerk: failed to delete test user ${userId} (${response.status})`);
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.options.secretKey}`,
      'Content-Type': 'application/json',
    };
  }
}
