import { expect, test } from '@playwright/test';

test('one response follows five chronological chapters in both visual and text views', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sample');
  const view = page.locator('.walkthrough');
  const titles = [
    'What goes into the model',
    'What happens to your message',
    'How the model builds its reply',
    'How the reply ends',
    'A closer look at your reply',
  ];
  const timeline = view.getByRole('navigation', { name: 'Chapters' });
  await expect(timeline.getByRole('button')).toHaveCount(5);
  await expect(view.getByRole('heading', { level: 2 })).toHaveText(titles[0]!);
  await expect(view.locator('.stage')).toHaveAttribute('data-stage', 'context');
  for (const title of titles) {
    await timeline.getByRole('button', { name: new RegExp(title) }).click();
    await expect(view.getByRole('heading', { level: 2 })).toHaveText(title);
  }
  await expect(view.locator('.stage')).toHaveAttribute('data-view', 'hook');
  await view.getByRole('button', { name: 'Detailed', exact: true }).click();
  await timeline.getByRole('button', { name: /What happens to your message/ }).click();
  await expect(view.locator('.chapter-subtitle')).toContainText('Input processing');
  await page.screenshot({ path: 'test-results/chapters-input-desktop.png' });
  await timeline.getByRole('button', { name: /How the model builds its reply/ }).click();
  await expect(view.locator('.chapter-subtitle')).toContainText('Output generation');
  await view.getByRole('button', { name: 'Read as text' }).click();
  await expect(view.locator('.transcript > section > h3').first()).toHaveText(titles[0]!);
  expect((await view.locator('.transcript > section > h3').allTextContents()).slice(0, 5)).toEqual(titles);
  await expect(view.locator('.transcript')).not.toContainText('Your next message:');
});
