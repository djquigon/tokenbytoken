// End-to-end walkthrough tests (docs/PLAN.md Phase 2 acceptance), against a production build with OpenAI
// replaced by e2e/mock-openai.mts.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { finishAnimations, lastStep } from './navigation';

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
  await expect(walkthrough(page).getByRole('button', { name: 'Next step' })).toBeVisible();
}

async function axeSerious(page: Page) {
  // Colors are measured as rendered, so let the step's entrance fade finish first.
  await finishAnimations(page);
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

  await walkthrough(page).getByRole('button', { name: 'Skip walkthrough', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  // The draft typed while locked is kept.
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveValue('A follow-up');
  // The skip control remains mounted, preserving focus.
  await expect(walkthrough(page).getByRole('button', { name: 'Skip walkthrough' })).toBeFocused();
});

test('navigation buttons work from the keyboard without playback shortcuts', async ({ page }) => {
  await askAndWait(page);
  const next = walkthrough(page).getByRole('button', { name: 'Next step' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  await expect(next).toBeFocused();
  await walkthrough(page).getByRole('button', { name: 'Next section' }).focus();
  await page.keyboard.press('Space');
  await expect(walkthrough(page).getByRole('heading', { level: 2 })).toHaveText('Text becomes tokens');
  await walkthrough(page).getByRole('button', { name: 'Previous section' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(stepCount(page)).toHaveText(/^Step 1 of \d+$/);
  await next.focus();
  await page.keyboard.press('k');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('?');
  await expect(stepCount(page)).toHaveText(/^Step 1 of \d+$/);
  await expect(page.getByRole('region', { name: 'Keyboard shortcuts' })).toHaveCount(0);
});

test('a token card opens from the reply, closes with Escape, and returns focus', async ({ page }) => {
  await askAndWait(page);
  await lastStep(page);
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
  await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  // The clock never runs: nothing advances on its own.
  await page.waitForTimeout(1_500);
  await expect(stepCount(page)).toHaveText(/^Step 2 of \d+$/);
  await walkthrough(page).getByRole('button', { name: 'Next step', exact: true }).click();
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

test('the walkthrough shows numbers only as labeled values, and no step scrolls sideways', async ({ page }) => {
  await askAndWait(page);
  await walkthrough(page).getByRole('button', { name: 'Detailed' }).click();
  const total = Number((await stepCount(page).innerText()).match(/of (\d+)/)?.[1]);
  const unlabeled: string[] = [];
  const sideways: number[] = [];
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
      // Nothing may push the panel wider than itself (a pick pointer once did).
      const pane = root.closest('.walkthrough-pane') ?? root;
      return { out, sideways: pane.scrollWidth > pane.clientWidth + 1 };
    });
    unlabeled.push(...found.out.map((t) => `step ${i}: ${t}`));
    if (found.sideways) sideways.push(i);
    if (i < total) await walkthrough(page).getByRole('button', { name: 'Next step' }).click();
  }
  expect(unlabeled).toEqual([]);
  expect(sideways, 'steps where the walkthrough panel scrolls sideways').toEqual([]);
});

test('the walkthrough has no serious accessibility violations', async ({ page }) => {
  await askAndWait(page);
  expect(await axeSerious(page)).toEqual([]);
  await walkthrough(page).getByRole('button', { name: 'Next section' }).click();
  await walkthrough(page).getByRole('button', { name: 'Next section' }).click();
  await walkthrough(page).getByRole('button', { name: 'Next section' }).click();
  expect(await axeSerious(page)).toEqual([]);
  await walkthrough(page).getByRole('button', { name: 'Read as text' }).click();
  await expect(walkthrough(page).getByRole('heading', { name: 'What gets sent', level: 3 })).toBeVisible();
  expect(await axeSerious(page)).toEqual([]);
});
