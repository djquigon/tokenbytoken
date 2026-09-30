// End-to-end tests for the landing page, the sample conversation, the live strip, and the deep dives.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function axeSerious(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
}

const walkthrough = (page: Page) => page.locator('.walkthrough');

/** Two frames of the rain, half a second apart: identical when it holds still. */
async function rainMoves(page: Page) {
  const frame = () => page.locator('.rain-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  const before = await frame();
  await page.waitForTimeout(500);
  return (await frame()) !== before;
}

test('the landing page offers both ways in, and has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Replay a sample conversation' })).toHaveAttribute('href', '/sample');
  // The rain fills the page behind solid cards.
  await expect(page.locator('.rain-canvas')).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);
});

test('Settings stops the rain from the landing page (WCAG 2.2.2)', async ({ page }) => {
  await page.goto('/');
  expect(await rainMoves(page)).toBe(true);
  await page.getByText('Settings').click();
  await page.getByRole('group', { name: /Visual effects/ }).getByRole('button', { name: 'Off' }).click();
  await page.keyboard.press('Escape');
  expect(await rainMoves(page)).toBe(false);
  // The choice is saved, so the rain stays still on the next visit.
  await page.reload();
  expect(await rainMoves(page)).toBe(false);
});

test('under reduced motion the rain holds still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.rain-canvas')).toBeVisible();
  expect(await rainMoves(page)).toBe(false);
});

test('the sample conversation replays both turns without calling the API', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) calls.push(r.url());
  });
  await page.goto('/sample');
  await expect(page.getByText('A recorded sample conversation')).toBeVisible();
  await expect(page.locator('.turn')).toHaveCount(2);
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveCount(0);
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(walkthrough(page).getByRole('heading', { level: 2 })).toHaveText('Your next message: the chat so far is sent again');
  expect(await axeSerious(page)).toEqual([]);
  expect(calls).toEqual([]);
});

test('the live strip shows recorded events while a reply streams, and can be hidden', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'I understand' }).click();
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('SLOW please');
  await box.press('Enter');
  const strip = page.getByRole('region', { name: /Live view/ });
  await expect(strip.getByText('Request sent')).toBeVisible();
  await expect(strip.getByText(/First text after/)).toBeVisible();
  await expect(strip.getByText(/Tokens so far/)).toBeVisible();
  await expect(strip.getByRole('list', { name: 'The newest tokens, as they arrive' })).toBeVisible();
  await strip.getByRole('button', { name: 'Hide live view' }).click();
  await expect(strip).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop' }).click();
});

test('the temperature what-if recomputes on the page, keeps focus at its limits, and closes with Escape', async ({ page }) => {
  await page.goto('/sample');
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await walkthrough(page).getByRole('button', { name: 'A weighted random pick' }).click();
  const open = walkthrough(page).getByRole('button', { name: 'What if the temperature were different?' });
  await open.click();
  const dive = walkthrough(page).getByRole('region', { name: 'What if the temperature were different?' });
  await expect(dive.getByRole('table')).toBeVisible();
  const lower = dive.getByRole('button', { name: 'Lower the temperature' });
  // It starts at 0.5; five steps of 0.1 reach zero, where the button reports itself unavailable but keeps focus.
  for (let i = 0; i < 5; i += 1) await lower.click();
  await expect(lower).toBeFocused();
  await expect(lower).toHaveAttribute('aria-disabled', 'true');
  await expect(dive.getByRole('cell', { name: 'every time' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dive).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('the fluent-answers deep dive shows the recorded wrong answer, labeled', async ({ page }) => {
  await page.goto('/sample');
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('End');
  await walkthrough(page).getByRole('button', { name: 'Why fluent answers can be wrong' }).click();
  const dive = walkthrough(page).getByRole('region', { name: 'Why fluent answers can be wrong' });
  await expect(dive).toContainText('bookkeeper');
  await expect(dive).toContainText('The right answer is');
  await expect(dive.locator('[data-kind="calculated"]').first()).toBeVisible();
  await expect(dive.getByRole('list', { name: /top options OpenAI returned/ })).toBeVisible();
});
