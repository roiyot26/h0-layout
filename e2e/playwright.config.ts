import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 4173);
const base = process.env.SITE_BASE ?? '/h0-layout/';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${port}${base}`,
    trace: 'off',
  },
  webServer: {
    command: `node serve.mjs`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      PORT: String(port),
      SITE_BASE: base,
      DIST_DIR: process.env.DIST_DIR ?? new URL('../dist', import.meta.url).pathname,
    },
  },
  projects: [
    {
      name: 'facts',
      testMatch: /(facts|hiring|hiring-plants)\.spec\.ts/,
      use: { javaScriptEnabled: false, browserName: 'chromium' },
    },
    {
      name: 'smoke',
      testMatch: 'smoke.spec.ts',
      use: { javaScriptEnabled: true, browserName: 'chromium' },
    },
    {
      name: 'axe',
      testMatch: 'axe.spec.ts',
      use: { javaScriptEnabled: true, browserName: 'chromium' },
    },
  ],
});
