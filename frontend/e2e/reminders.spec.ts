import { test, expect, type Page } from "@playwright/test";

/**
 * Daily Reminders e2e.
 *
 * These cover what the unit tests structurally cannot: the editor drawer
 * actually opening, the admin gate in a real browser session, and the print
 * path opening a real tab without tripping a popup blocker.
 *
 * Requires the dev stack (`docker compose up -d`) and an admin account.
 * Credentials come from the environment so nothing lands in git:
 *
 *   E2E_ADMIN_EMAIL=you@example.com E2E_ADMIN_PASSWORD='...' npx playwright test
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASSWORD,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run these."
);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test.beforeEach(async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
});

test("admin sees Daily Reminders in the sidebar and can open the page", async ({ page }) => {
  await expect(page.getByRole("link", { name: /daily reminders/i })).toBeVisible();
  await page.getByRole("link", { name: /daily reminders/i }).click();
  await expect(page).toHaveURL(/\/reminders/);
  // The sheet renders in-app, inside the shell — not a new tab.
  await expect(page.getByText("MY DAILY MEDICATIONS")).toBeVisible();
});

test("the editor drawer opens and edits flow through to the preview", async ({ page }) => {
  await page.goto("/reminders");
  await expect(page.getByText("MY DAILY MEDICATIONS")).toBeVisible();

  await page.getByRole("button", { name: /edit this page/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Edit Daily Reminders")).toBeVisible();

  // Inputs are wrapped in <label><span>Title</span><Input/></label>, so the
  // accessible name comes from the implicit label.
  await page.getByLabel("Title", { exact: true }).fill("E2E TEST SHEET");

  // The preview is live: it updates as you type, behind the drawer.
  await expect(page.getByRole("heading", { name: /E2E TEST SHEET/i }).or(
    page.getByText("E2E TEST SHEET").first()
  )).toBeVisible();

  await page.getByRole("button", { name: /close editor/i }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the up/down reorder controls are present and bounded", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("button", { name: /edit this page/i }).click();

  const up = page.getByRole("button", { name: "Move up" });
  const down = page.getByRole("button", { name: "Move down" });
  expect(await up.count()).toBeGreaterThan(0);
  expect(await down.count()).toBeGreaterThan(0);

  // The first item's "up" is disabled — the boundary the unit tests assert
  // on moveItem(), here proven to be wired to the actual control.
  await expect(up.first()).toBeDisabled();
});

test("Print opens a new tab and does not trip the popup blocker", async ({ page, context }) => {
  await page.goto("/reminders");
  await expect(page.getByText("MY DAILY MEDICATIONS")).toBeVisible();

  // The Blob-URL + anchor-click path should yield a real popup. If this ever
  // regresses to window.open + document.write, the popup blocker eats it and
  // waitForEvent times out — which is precisely the bug this guards.
  const popupPromise = context.waitForEvent("page", { timeout: 10_000 });
  await page.getByRole("button", { name: /print daily reminders/i }).click();
  const sheet = await popupPromise;

  await expect(sheet).toHaveURL(/^blob:/);
  await expect(sheet.locator("body")).toContainText("MY DAILY MEDICATIONS");
  await sheet.close();
});

test("saving shows a transient confirmation", async ({ page }) => {
  await page.goto("/reminders");
  await expect(page.getByText("MY DAILY MEDICATIONS")).toBeVisible();

  const saveButton = page.getByRole("button", { name: /^save$/i });
  await saveButton.click();

  // The confirmation self-clears after 2.5s, which is SHORTER than Playwright's
  // 5s default expect timeout — a default-timeout assertion races the timer and
  // flakes. Assert inside the window, then assert it goes away.
  await expect(page.getByRole("button", { name: /saved/i })).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole("button", { name: /^save$/i })).toBeVisible({ timeout: 5000 });
});
