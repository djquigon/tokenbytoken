// End-to-end chat tests against a production build, with OpenAI replaced by e2e/mock-openai.mts.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const REPLY_START = 'Sunlight contains all colors';

async function openChat(page: Page) {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeEnabled();
}

/** The chat pane (the walkthrough beside it quotes the reply too). */
const chat = (page: Page) => page.locator('#main');

/** The app's error notice (Next.js has its own role="alert" route announcer). */
const errorNotice = (page: Page) => page.locator('[data-error-code]');

async function send(page: Page, text: string) {
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill(text);
  await box.press('Enter');
}

test('the privacy notice comes before the first message', async ({ page }) => {
  await page.goto('/chat');
  await expect(page.getByRole('heading', { name: 'Before you send a message' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeDisabled();
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('textbox', { name: 'Your message' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Before you send a message' })).toHaveCount(0);
});

test('before the first reply, the walkthrough panel lists its four steps with their labels', async ({ page }) => {
  await page.goto('/chat');
  const panel = page.getByRole('complementary', { name: 'How it works' });
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText(['Your message', 'Text becomes tokens', 'Next-token choices', 'The reply is built']);
  await expect(panel.getByRole('listitem')).toHaveCount(4);
  await expect(panel.locator('.prov-badge[data-kind="example"]')).toHaveCount(1);
});

test('send → stream → inspect → follow-up re-sends the signed reply', async ({ page }) => {
  await openChat(page);
  await send(page, 'Why is the sky blue?');
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  // Each message is headed by who wrote it; the reply's label is spelled out. (Chrome puts a space before
  // the screen-reader-only part of each name.)
  await expect(chat(page).getByRole('heading', { name: /^You\s*, message 1$/ })).toBeVisible();
  await expect(chat(page).getByRole('heading', { name: /^Assistant\s*, reply 1, Recorded\s*, reported by OpenAI$/ })).toBeVisible();

  await page.getByRole('button', { name: 'Inspect data' }).click();
  const inspector = page.locator('.inspector');
  await expect(inspector.getByText('Tokens in the reply')).toBeVisible();
  await inspector.getByText('Tokens in the reply').click();
  await expect(inspector.locator('table.tokens tbody tr')).toHaveCount(38);
  await inspector.getByText("Checks: this app's counts vs. OpenAI's").click();
  await expect(inspector.getByText('Explained difference').first()).toBeVisible();

  // Sending stays locked until the walkthrough is watched or skipped; Skip is one click from the composer.
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
  await chat(page).getByRole('button', { name: 'Skip walkthrough' }).click();
  await send(page, 'And why is it red at sunset?');
  await expect(page.locator('.turn')).toHaveCount(2);
  await expect(page.locator('.turn').nth(1).getByText(REPLY_START)).toBeVisible();
  await page.locator('.turn').nth(1).getByRole('button', { name: 'Inspect data' }).click();
  await page.locator('.turn').nth(1).getByText('What this app sent').click();
  // The second request carried the first question, the signed first reply, and the new question.
  const included = page.locator('.turn').nth(1).locator('tr', { hasText: 'Messages included' });
  await expect(included).toContainText(/msg_\w+, msg_\w+, msg_\w+/);
});

test('Stop ends the reply, keeps what arrived, and Try again sends a new request', async ({ page }) => {
  await openChat(page);
  await send(page, 'SLOW please');
  await expect(chat(page).locator('.msg-assistant').getByText('Sunlight').first()).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText("Stopped. This partial reply won't be sent back")).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('.turn')).toHaveCount(1);
});

test('an OpenAI rate limit shows its notice and can be retried', async ({ page }) => {
  await openChat(page);
  await send(page, 'FAIL_429');
  const alert = errorNotice(page);
  await expect(alert).toContainText('OpenAI is limiting requests right now');
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('the spending cap shows its own notice without a retry', async ({ page }) => {
  await openChat(page);
  await send(page, 'QUOTA');
  const alert = errorNotice(page);
  await expect(alert).toContainText('This site has reached its OpenAI spending limit');
  await expect(alert.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('flagged input is never sent to the model', async ({ page }) => {
  await openChat(page);
  await send(page, 'FLAG_ME');
  await expect(errorNotice(page)).toContainText("This message wasn't sent");
});

test('a stream cut off upstream is reported and keeps its partial text', async ({ page }) => {
  await openChat(page);
  await send(page, 'CUTOFF');
  await expect(errorNotice(page)).toContainText('The reply was cut off');
  await expect(chat(page).locator('.msg-assistant').getByText('Sunlight').first()).toBeVisible();
});

test('text without alternatives is labeled, never filled in', async ({ page }) => {
  await openChat(page);
  await send(page, 'UNICODE');
  await expect(chat(page).locator('.msg-assistant').getByText('你好')).toBeVisible();
  await page.getByRole('button', { name: 'Inspect data' }).click();
  await page.locator('.inspector').getByText('Tokens in the reply').click();
  await expect(page.getByText('OpenAI returned no alternatives for these characters.').first()).toBeVisible();
});

test('the conversation survives a reload and can be cleared', async ({ page }) => {
  await openChat(page);
  await send(page, 'Why is the sky blue?');
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await page.reload();
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await page.getByRole('button', { name: 'Clear conversation' }).click();
  await expect(page.locator('.turn')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.turn')).toHaveCount(0);
});

test('the chat has no serious accessibility violations', async ({ page }) => {
  await openChat(page);
  await send(page, 'Why is the sky blue?');
  await expect(chat(page).getByText(REPLY_START)).toBeVisible();
  await page.getByRole('button', { name: 'Inspect data' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
