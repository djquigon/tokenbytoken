import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;
const MOCK_PORT = 3299;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // A stand-in for OpenAI that replays recorded streams; see e2e/mock-openai.mts.
      command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON e2e/mock-openai.mts`,
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_OPENAI_PORT: String(MOCK_PORT) },
    },
    {
      // Test a production build, as the Next.js testing guide recommends. These variables take precedence
      // over .env.local, so end-to-end tests never reach the real OpenAI API.
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        OPENAI_API_KEY: 'sk-e2e-mock-key-not-real',
        OPENAI_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`,
        LIMITS_STORE: 'memory',
        HISTORY_SIGNING_SECRET: 'e2e-signing-secret-that-is-at-least-32-chars',
      },
    },
  ],
});
