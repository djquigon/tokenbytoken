import { expect, test } from '@playwright/test';

test('home page shows the project name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Token by Token' })).toBeVisible();
});

// The Phase 0 spike is diagnostic only and must stay hidden unless SPIKE_ENABLED=1.
test('spike page is hidden by default', async ({ page }) => {
  const response = await page.goto('/spike');
  expect(response?.status()).toBe(404);
});

test('spike API routes are hidden by default', async ({ request }) => {
  expect((await request.get('/api/spike/stream')).status()).toBe(404);
  expect((await request.post('/api/spike/openai')).status()).toBe(404);
});
