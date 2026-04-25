import { test, expect, type Page } from "../playwright-fixture";

/**
 * Verifies /setores loads correctly per role and never gets stuck in the
 * loading state. All assertions rely exclusively on stable data-testid
 * selectors added to the page (no text/role lookups), so the test does not
 * break when copy or layout changes.
 *
 * Selectors used (all defined in src/pages/Sectors.tsx and
 * src/components/sectors/SectorsHealthBanner.tsx):
 *   - [data-testid="sectors-page"]              → page mounted
 *   - [data-testid="sectors-grid"]              → grid container
 *   - [data-testid="sector-card"]               → one per visible sector
 *   - [data-testid="sectors-empty-state"]       → no sectors for this user
 *   - [data-testid="sectors-timeout-fallback"]  → 10s loading timeout fired
 *   - [data-testid="sectors-health-banner"]     → diagnostic banner
 *   - [data-testid="sectors-health-error"]      → banner is reporting an error
 *
 * Credentials per role come from env vars; missing creds → test.skip().
 *   E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD
 *   E2E_LEADER_EMAIL / E2E_LEADER_PASSWORD
 *   E2E_MENTOR_EMAIL / E2E_MENTOR_PASSWORD
 */

type Role = "admin" | "leader" | "mentor";

const ROLES: { role: Role; emailEnv: string; passwordEnv: string }[] = [
  { role: "admin", emailEnv: "E2E_ADMIN_EMAIL", passwordEnv: "E2E_ADMIN_PASSWORD" },
  { role: "leader", emailEnv: "E2E_LEADER_EMAIL", passwordEnv: "E2E_LEADER_PASSWORD" },
  { role: "mentor", emailEnv: "E2E_MENTOR_EMAIL", passwordEnv: "E2E_MENTOR_PASSWORD" },
];

async function loginIfNeeded(page: Page, email: string, password: string) {
  await page.goto("/setores", { waitUntil: "domcontentloaded" });

  // Login is detected by the presence of email+password inputs OR an /auth URL.
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  const onAuthRoute = /\/auth|\/login/.test(page.url());
  const formVisible = await emailInput.isVisible().catch(() => false);
  if (!onAuthRoute && !formVisible) return;

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await passwordInput.press("Enter");

  await page.waitForURL((url) => !/\/auth|\/login/.test(url.pathname), {
    timeout: 20_000,
  });
}

async function assertSectorsLoadsCleanly(page: Page) {
  await page.goto("/setores", { waitUntil: "domcontentloaded" });

  const pageRoot = page.getByTestId("sectors-page");
  const timeoutFallback = page.getByTestId("sectors-timeout-fallback");
  const grid = page.getByTestId("sectors-grid");
  const emptyState = page.getByTestId("sectors-empty-state");
  const healthError = page.getByTestId("sectors-health-error");
  const sectorCards = page.getByTestId("sector-card");

  // Wait until the page either fully renders OR explicitly hits the 10s
  // timeout fallback. We give it a small buffer over the 10s app threshold.
  await Promise.race([
    pageRoot.waitFor({ state: "visible", timeout: 15_000 }).catch(() => null),
    timeoutFallback.waitFor({ state: "visible", timeout: 15_000 }).catch(() => null),
  ]);

  // 1) Timeout fallback must NOT be visible.
  await expect(
    timeoutFallback,
    "Page hit the 10s loading timeout — /setores is stuck loading."
  ).toBeHidden();

  // 2) Health banner must not be in error state.
  await expect(
    healthError,
    "Sectors health banner is reporting an error."
  ).toBeHidden();

  // 3) The page shell must be mounted.
  await expect(
    pageRoot,
    "Sectors page never mounted — UI did not render."
  ).toBeVisible();

  // 4) Either at least one sector card OR the explicit empty-state must be
  //    visible. A blank grid with no message is a failure.
  const cardCount = await sectorCards.count();
  if (cardCount === 0) {
    await expect(
      emptyState,
      "Sectors grid rendered with zero cards and no empty-state message."
    ).toBeVisible();
  } else {
    await expect(grid).toBeVisible();
    expect(cardCount).toBeGreaterThan(0);
  }
}

test.describe("/setores loads cleanly per role", () => {
  for (const { role, emailEnv, passwordEnv } of ROLES) {
    test(`role: ${role}`, async ({ page }) => {
      const email = process.env[emailEnv];
      const password = process.env[passwordEnv];

      test.skip(
        !email || !password,
        `Missing credentials for "${role}" (set ${emailEnv} and ${passwordEnv}).`
      );

      await loginIfNeeded(page, email!, password!);
      await assertSectorsLoadsCleanly(page);
    });
  }
});
