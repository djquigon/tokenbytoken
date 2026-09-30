import { expect, test } from '@playwright/test';

test('home page shows the project name and links to the chat', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Token by Token' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ask your own question' })).toHaveAttribute('href', '/chat');
});

test('privacy page cites OpenAI’s data controls', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'data controls page' })).toHaveAttribute('href', /developers\.openai\.com/);
});

test('pages send security headers', async ({ request }) => {
  const res = await request.get('/chat');
  expect(res.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
});

test('the chat API only accepts same-origin JSON POSTs', async ({ request, baseURL }) => {
  expect((await request.get('/api/chat')).status()).toBe(405);
  const crossSite = await request.post('/api/chat', { headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, data: '{}' });
  expect(crossSite.status()).toBe(403);
  const notJson = await request.post('/api/chat', { headers: { origin: baseURL ?? '', 'content-type': 'text/plain' }, data: '{}' });
  expect(notJson.status()).toBe(400);
});

test('the Phase 0 spike is gone', async ({ request }) => {
  expect((await request.get('/spike')).status()).toBe(404);
  expect((await request.get('/api/spike/stream')).status()).toBe(404);
});
