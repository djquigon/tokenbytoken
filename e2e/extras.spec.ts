// End-to-end tests for the Phase 2 extras: settings, glossary terms, "Is this real?", the
// lanes, the Detailed network steps and example patterns, simulated picks, the exercises, the reply text
// toggle, the real-speed replay, and the first-visit tour. Most run on /sample, which never calls the API.

import { expect, test, type Page } from '@playwright/test';
import { finishAnimations, goToChapter, lastStep } from './navigation';

const walkthrough = (page: Page) => page.locator('.walkthrough');
const stepCount = (page: Page) => page.locator('.step-count');

async function openSample(page: Page) {
  await page.goto('/sample');
  await expect(walkthrough(page).getByRole('button', { name: 'Next step' })).toBeVisible();
}

test('legacy playback settings cannot restore autoplay or navigation shortcuts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tbt:prefs:v1', JSON.stringify({
    v: 2, autoplay: true, speed: 2, shortcuts: true, keys: { next: 'n' },
  })));
  await page.goto('/sample');
  await page.getByText('Settings', { exact: true }).click();
  await expect(page.getByRole('group', { name: /autoplay|shortcuts|speed/i })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await walkthrough(page).getByRole('button', { name: 'Next step' }).focus();
  await page.keyboard.press('n');
  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(/^Step 1 of \d+$/);
  await page.keyboard.press('?');
  await expect(page.getByRole('region', { name: 'Keyboard shortcuts' })).toHaveCount(0);
  await expect(walkthrough(page).getByRole('button', { name: /^(Play|Pause|Replay)$/ })).toHaveCount(0);
});

test('glossary terms show their definition on hover and focus, and Escape dismisses it', async ({ page }) => {
  await page.goto('/sample');
  const term = walkthrough(page).locator('.caption').getByRole('button', { name: 'tokens' }).first();
  await term.hover();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Token:' });
  await expect(tip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();
  await term.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(term).toBeFocused();
});

test('“Is this real?” lists the kinds of values each step shows, with sources at Detailed depth', async ({ page }) => {
  await openSample(page);
  await walkthrough(page).getByRole('button', { name: 'Is this real?' }).click();
  const panel = walkthrough(page).getByRole('region', { name: 'Is this real?' });
  await expect(panel).toContainText('Real, from this conversation (Recorded)');
  await expect(panel).toContainText('Worked out by this app from real values (Calculated)');
  await goToChapter(page, /Inside the network/);
  await expect(panel).toContainText('Teaching drawings');
  await walkthrough(page).getByRole('button', { name: 'Detailed', exact: true }).click();
  const detailed = walkthrough(page).getByRole('region', { name: 'How do we know this?' });
  await expect(detailed.getByRole('table')).toBeVisible();
  await expect(detailed.getByRole('cell', { name: 'Example' }).first()).toBeVisible();
});

test('the lanes: a ticker at Simple depth, three lanes at Detailed', async ({ page }) => {
  await openSample(page);
  await expect(walkthrough(page).locator('.lane-ticker [aria-current="true"]')).toContainText('OpenAI');
  await goToChapter(page, /What gets sent/);
  await expect(walkthrough(page).locator('.lane-ticker [aria-current="true"]')).toContainText('This app');
  await walkthrough(page).getByRole('button', { name: 'Detailed', exact: true }).click();
  const lanes = walkthrough(page).getByRole('group', { name: 'Where each part happens' });
  await expect(lanes.locator('.lane')).toHaveCount(3);
  await expect(lanes.locator('.lane[aria-current="true"]')).toContainText('This app');
  await expect(lanes).toContainText('Moderation check');
});

test('Detailed depth adds the position and feed-forward steps; attention shows other example patterns', async ({ page }) => {
  await openSample(page);
  await walkthrough(page).getByRole('button', { name: 'Detailed', exact: true }).click();
  await goToChapter(page, /Inside the network/);
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('Each token becomes a list of numbers');
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('Where each token sits');
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('Attention: drawing on earlier text');
  await walkthrough(page).getByRole('button', { name: 'Show another example pattern' }).click();
  await expect(walkthrough(page).locator('.stage figcaption')).toContainText('earlier copies of the same token');
  await walkthrough(page).getByRole('button', { name: 'Show another example pattern' }).click();
  await expect(walkthrough(page).locator('.stage figcaption')).toContainText('followed its earlier copy');
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('Each position on its own');
});

test('simulated picks add up to twenty and are marked as simulated', async ({ page }) => {
  await openSample(page);
  await goToChapter(page, /A weighted random pick/);
  await walkthrough(page).getByRole('button', { name: 'What if the temperature were different?' }).click();
  const dive = walkthrough(page).getByRole('region', { name: 'What if the temperature were different?' });
  await dive.getByRole('button', { name: /Simulate 20 picks/ }).click();
  await expect(dive.getByRole('columnheader', { name: 'Simulated picks' })).toBeVisible();
  await expect(dive.getByRole('status').filter({ hasText: 'Simulated on this page' })).toBeVisible();
  const counts = await dive.locator('tbody tr td:last-child .datum-value').allInnerTexts();
  const total = counts.reduce((n, c) => n + Number(c), 0);
  expect(total).toBeLessThanOrEqual(20);
  expect(total).toBeGreaterThan(0);
  await expect(dive.locator('tbody td:last-child [data-whatif="true"]').first()).toBeVisible();
});

test('guess the likely option, then see the real options', async ({ page }) => {
  await openSample(page);
  await goToChapter(page, /The options for the next token/);
  await walkthrough(page).getByRole('button', { name: 'Guess the likely option' }).click();
  const dive = walkthrough(page).getByRole('region', { name: 'Guess the likely option' });
  await dive.getByRole('group', { name: 'Which option did the model score highest?' }).getByRole('button').first().click();
  await expect(dive.getByRole('status')).toContainText('The model picked');
  await expect(dive.getByRole('list', { name: /top options OpenAI returned/ })).toBeVisible();
});

test('the real-or-example check scores all seven items', async ({ page }) => {
  await openSample(page);
  await lastStep(page);
  await walkthrough(page).getByRole('button', { name: 'Real or example? A quick check' }).click();
  const dive = walkthrough(page).getByRole('region', { name: 'Real or example? A quick check' });
  for (let i = 0; i < 7; i += 1) await dive.getByRole('button', { name: 'Real data' }).first().click();
  await expect(dive.getByText(/You sorted \d of 7 correctly/)).toBeVisible();
  await expect(dive.getByText('Not quite.').first()).toBeVisible();
});

test('the end step shows the reply formatted or as written', async ({ page }) => {
  await openSample(page);
  // In the two-turn sample, the reply's end step comes just before the follow-up chapter.
  await goToChapter(page, /next message/);
  await walkthrough(page).getByRole('button', { name: 'Previous step' }).click();
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('How the reply ended');
  await expect(walkthrough(page).getByRole('region', { name: 'The reply, formatted' })).toBeVisible();
  await walkthrough(page).getByRole('button', { name: 'As written' }).click();
  await expect(walkthrough(page).locator('.reply-text pre')).toContainText('sunset');
});

test('the real-speed replay shows the reply as it arrived', async ({ page }) => {
  await openSample(page);
  await lastStep(page);
  await walkthrough(page).getByRole('button', { name: 'How long did it take?' }).click();
  const dive = walkthrough(page).getByRole('region', { name: 'How long did it take?' });
  await dive.getByRole('button', { name: 'Replay at the speed it arrived' }).click();
  await expect(dive.locator('.real-speed-text')).not.toBeEmpty();
  await expect(dive.getByRole('button', { name: 'Replay again' })).toBeVisible({ timeout: 15_000 });
  await expect(dive.locator('.real-speed-text')).toContainText('sunset');
});

test('the first visit shows a tour; skipping hides it for good, and Settings brings it back', async ({ page }) => {
  await page.goto('/chat');
  const tour = page.getByRole('region', { name: 'Ask a real AI model' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('region', { name: 'Then see how it was made' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip the tour' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tour')).toBeHidden();
  await page.getByText('Settings', { exact: true }).click();
  await page.getByRole('button', { name: 'Show the chat page tour again' }).click();
  await expect(page.getByRole('region', { name: 'Ask a real AI model' })).toBeVisible();
});

test('the new panels have no serious accessibility violations', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  const serious = async () => {
    await finishAnimations(page);
    const results = await new AxeBuilder({ page }).analyze();
    return results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`);
  };
  await openSample(page);
  await walkthrough(page).getByRole('button', { name: 'Detailed', exact: true }).click();
  await walkthrough(page).getByRole('button', { name: 'How do we know this?' }).click();
  await goToChapter(page, /A weighted random pick/);
  await walkthrough(page).getByRole('button', { name: 'What if the temperature were different?' }).click();
  await page.getByRole('button', { name: /Simulate 20 picks/ }).click();
  expect(await serious()).toEqual([]);
  await page.getByText('Settings', { exact: true }).click();
  expect(await serious()).toEqual([]);
  await page.goto('/chat');
  await expect(page.getByRole('region', { name: 'Ask a real AI model' })).toBeVisible();
  expect(await serious()).toEqual([]);
});
