// End-to-end walkthrough tests (docs/PLAN.md Phase 2 acceptance), against a production build with OpenAI
// replaced by e2e/mock-openai.mts.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const REPLY_START = 'Sunlight contains all colors';

const chat = (page: Page) => page.locator('#main');
const walkthrough = (page: Page) => page.locator('.walkthrough');
const stepCount = (page: Page) => page.locator('.step-count');

async function askAndWait(page: Page) {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'I understand' }).click();
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('Why is the sky blue?');
  await box.press('Enter');
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await expect(page.getByRole('button', { name: /Play the walkthrough|Start the walkthrough/ })).toBeVisible();
}

async function axeSerious(page: Page) {
  // Colors are measured as rendered, so let the step's entrance fade finish first.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any[0]?.message ?? ''})`).join('; ')}`);
}

test('the walkthrough is offered after a reply, and skipping it unlocks the composer', async ({ page }) => {
  await askAndWait(page);
  await expect(walkthrough(page).getByText('How this reply was made')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your message' }).fill('A follow-up');
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();

  await walkthrough(page).getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  // The draft typed while locked is kept.
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveValue('A follow-up');
  // Focus lands on the player, not on the page.
  await expect(walkthrough(page).getByRole('button', { name: 'Replay' })).toBeFocused();
});

test('works from the keyboard alone: play, pause, steps, chapters, and the shortcut list', async ({ page }) => {
  await askAndWait(page);
  await page.getByRole('button', { name: /Play the walkthrough/ }).focus();
  await page.keyboard.press('Enter');
  const pause = walkthrough(page).getByRole('button', { name: 'Pause' });
  await expect(pause).toBeFocused();
  await page.keyboard.press('k');
  await expect(walkthrough(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(walkthrough(page).getByRole('heading', { level: 2 })).toHaveText('Text becomes tokens');
  await page.keyboard.press('End');
  await expect(walkthrough(page).locator('.caption-title')).toHaveText('How the reply ended');
  await page.keyboard.press('Home');
  await expect(stepCount(page)).toHaveText(/^Step 1 of \d+$/);

  await page.keyboard.press('?');
  await expect(page.getByRole('region', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Keyboard shortcuts' })).toHaveCount(0);
});

test('a token card opens from the reply, closes with Escape, and returns focus', async ({ page }) => {
  await askAndWait(page);
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('End');
  const tape = walkthrough(page).getByRole('list', { name: /The whole reply as tokens/ });
  const first = tape.getByRole('button').first();
  await first.click();
  const card = walkthrough(page).getByRole('region', { name: /Token card/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('list', { name: /top options OpenAI returned/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(first).toBeFocused();
});

test('reduced motion turns playback into steps the viewer moves through', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await askAndWait(page);
  await page.getByRole('button', { name: 'Start the walkthrough' }).click();
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  // The clock never runs: nothing advances on its own.
  await page.waitForTimeout(1_500);
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  await walkthrough(page).getByRole('button', { name: 'Next', exact: true }).click();
  await expect(stepCount(page)).toHaveText(/^Step 3 of \d+$/);
  await expect(walkthrough(page).getByRole('group', { name: 'Speed' })).toHaveCount(0);
});

test('replays offline, without calling the API', async ({ page, context }) => {
  await askAndWait(page);
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) calls.push(r.url());
  });
  await context.setOffline(true);
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  const total = Number((await stepCount(page).innerText()).match(/of (\d+)/)?.[1]);
  for (let i = 1; i < total; i += 1) await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await expect(stepCount(page)).toHaveText(`Step ${total} of ${total}`);
  await chat(page).getByRole('button', { name: 'Explain this reply' }).click();
  await expect(walkthrough(page)).toBeVisible();
  expect(calls).toEqual([]);
  await context.setOffline(false);
});

test('narrow screens show one pane at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chat');
  await page.getByRole('button', { name: 'I understand' }).click();
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('Why is the sky blue?');
  await box.press('Enter');
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await expect(walkthrough(page)).toBeHidden();

  await page.getByRole('button', { name: /How it works/ }).first().click();
  await expect(walkthrough(page)).toBeVisible();
  await expect(chat(page)).toBeHidden();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(chat(page)).toBeVisible();
});

test('the walkthrough shows numbers only as labeled values', async ({ page }) => {
  await askAndWait(page);
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await walkthrough(page).getByRole('button', { name: 'Detailed' }).click();
  await page.keyboard.press('Home');
  const total = Number((await stepCount(page).innerText()).match(/of (\d+)/)?.[1]);
  const unlabeled: string[] = [];
  for (let i = 1; i <= total; i += 1) {
    const found = await walkthrough(page).evaluate((root) => {
      // UI chrome that may hold digits: the player (step count, speeds), and the live-region text, which
      // spells each label out. Method descriptions state their own rule.
      const allowed = '[data-kind], [data-method], [data-control], .player, .offer, [aria-live]';
      const out: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent ?? '';
        if (/\d/.test(text) && !n.parentElement?.closest(allowed)) out.push(text.trim());
      }
      return out;
    });
    unlabeled.push(...found.map((t) => `step ${i}: ${t}`));
    if (i < total) await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  }
  expect(unlabeled).toEqual([]);
});

test('the walkthrough has no serious accessibility violations', async ({ page }) => {
  await askAndWait(page);
  expect(await axeSerious(page)).toEqual([]);
  await walkthrough(page).getByRole('button', { name: /Play the walkthrough/ }).click();
  await walkthrough(page).getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  expect(await axeSerious(page)).toEqual([]);
  await walkthrough(page).getByRole('button', { name: 'Read as text' }).click();
  await expect(walkthrough(page).getByRole('heading', { name: 'What gets sent', level: 3 })).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);
});
