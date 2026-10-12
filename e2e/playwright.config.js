// Suite end-to-end del gioco nel browser: `npm run e2e` (rapida) e `npm run e2e:long` (partite lunghe).
const { defineConfig, devices } = require('@playwright/test');

const PORT = 8815;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  retries: 0,
  reporter: [['list']],
  grepInvert: process.env.E2E_LONG ? undefined : /@long/,
  outputDir: 'test-results',
  use: { baseURL: `http://127.0.0.1:${PORT}`, locale: 'it-IT', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  projects: [{ name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 411, height: 860 }, locale: 'it-IT' } }],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory ../www`,
    cwd: __dirname,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
