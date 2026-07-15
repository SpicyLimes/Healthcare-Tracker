import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. These drive the REAL app, so they need the dev stack up:
 *
 *   docker compose up -d          # from the repo root
 *   cd frontend && npx playwright test
 *
 * There is deliberately no `webServer` block: this app is not a standalone
 * static frontend — it needs Postgres and the FastAPI backend behind nginx.
 * Compose already does that correctly, so these tests attach to it rather
 * than trying to reproduce it.
 *
 * Not wired into CI. The GitHub workflow only builds and publishes images;
 * adding an e2e job would mean standing the whole stack up in the workflow.
 * These are for local verification of things unit tests structurally cannot
 * reach — the editor drawer, the real print path, popup-blocker behaviour.
 */
export default defineConfig({
  testDir: "./e2e",
  // Serial: these share one app instance and one saved reminder sheet, so
  // parallel workers would fight over the same server-side row.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:1337",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
