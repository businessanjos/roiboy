import { test, expect, type Page } from "../playwright-fixture";

/**
 * Verifies /setores loads correctly per role and never gets stuck on the
 * loading spinner. Failure modes covered:
 *  - Page stays loading > 15s (timeout fallback should appear or sectors render)
 *  - Health banner reports an error
 *  - Timeout fallback "A página demorou demais para carregar" is shown
 *  - No sector cards render for a non-admin with provisioned access
 *
 * Credentials per role are read from env vars. When a role's credentials are
 * not provided, the test for that role is skipped (not failed) so the suite
 * can run in environments where only some accounts are available.
 *
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
  // The app redirects unauthenticated users to /auth (or shows a login screen).
  // We navigate to /setores first so an auth redirect, if any, kicks in.
  await page.goto("/setores", { waitUntil: "domcontentloaded" });

  // Detect login form. We accept either a /auth path or visible email+password inputs.
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

  const needsLogin =
    page.url().includes("/auth") ||
    page.url().includes("/login") ||
    (await emailInput.isVisible().catch(() => false));

  if (!needsLogin) return;

  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Click the most likely submit button. Fallback to pressing Enter.
  const submit = page
    .getByRole("button", { name: /entrar|login|acessar|sign in/i })
    .first();
  if (await submit.isVisible().catch(() => false)) {
    await submit.click();
  } else {
    await passwordInput.press("Enter");
  }

  // Wait for navigation away from /auth into the app shell.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 20_000,
  });
}

async function assertSectorsLoadsCleanly(page: Page) {
  await page.goto("/setores", { waitUntil: "domcontentloaded" });

  // The Sectors page renders a heading once mounted (loading or not). We wait
  // for either the sector cards container OR the timeout-fallback heading.
  const timeoutFallback = page.getByText(/A página demorou demais para carregar/i);
  const sectorsHeading = page.getByRole("heading", {
    name: /selecione (uma )?(área|areas?|setor)/i,
  });

  // Generous wait so we exercise the real timeout (10s) plus a small buffer.
  await Promise.race([
    sectorsHeading.waitFor({ state: "visible", timeout: 15_000 }).catch(() => null),
    timeoutFallback.waitFor({ state: "visible", timeout: 15_000 }).catch(() => null),
  ]);

  // 1) The 10s timeout fallback must NOT be visible — that's a regression.
  await expect(
    timeoutFallback,
    "Page hit the 10s loading timeout fallback — /setores is stuck loading."
  ).toBeHidden();

  // 2) Health banner errors must NOT appear.
  const healthError = page.locator(
    '[data-testid="sectors-health-error"], [role="alert"]:has-text("erro")'
  );
  if (await healthError.first().isVisible().catch(() => false)) {
    const msg = await healthError.first().innerText();
    throw new Error(`Sectors health banner reported an error: ${msg}`);
  }

  // 3) The page must show its main heading (UI rendered, not a blank shell).
  await expect(
    sectorsHeading,
    "Sectors page heading never rendered — UI did not mount."
  ).toBeVisible({ timeout: 5_000 });

  // 4) At least one sector card OR an explicit "no access" empty-state must
  //    be visible. A blank grid with no message is a failure.
  const sectorCard = page.locator('[data-sector-card], a[href^="/setor/"], button[data-sector-id]').first();
  const emptyState = page.getByText(/nenhum setor|sem acesso|fale com.*admin/i).first();

  const cardVisible = await sectorCard.isVisible().catch(() => false);
  const emptyVisible = await emptyState.isVisible().catch(() => false);

  expect(
    cardVisible || emptyVisible,
    "Sectors page rendered but shows neither sector cards nor an empty-state message."
  ).toBe(true);
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
