import { expect, test } from '@playwright/test';

test('steps animate on arrival and wait indefinitely for navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/sample');
  const view = page.locator('.walkthrough');
  const count = view.locator('.step-count');
  const progress = () => view.evaluate((el) => Number((el as HTMLElement).style.getPropertyValue('--p')));
  await expect(count).toHaveText(/^Step 1 of /);
  await expect.poll(progress).toBeGreaterThan(0);
  await expect.poll(progress).toBe(1);
  await page.waitForTimeout(2_000);
  await expect(count).toHaveText(/^Step 1 of /);
  await expect(view.getByRole('button', { name: 'Previous step' })).toBeDisabled();
  await view.getByRole('button', { name: 'Next step' }).click();
  expect(await progress()).toBeLessThan(1);
  await expect.poll(progress).toBe(1);
  await expect(count).toHaveText(/^Step 2 of /);
  await view.getByRole('button', { name: 'Previous step' }).click();
  expect(await progress()).toBeLessThan(1);
  await expect(count).toHaveText(/^Step 1 of /);
  await expect(view.getByRole('button', { name: /^(Play|Pause|Replay)$/ })).toHaveCount(0);
  await expect(view.getByRole('group', { name: 'Speed' })).toHaveCount(0);
  const timeline = view.getByRole('navigation', { name: 'Chapters' });
  await expect(timeline).toBeVisible();
  await timeline.getByRole('button', { name: /Text becomes tokens/ }).click();
  await expect(view.getByRole('heading', { level: 2 })).toHaveText('Text becomes tokens');
  await expect(timeline.getByRole('button', { name: /Text becomes tokens/ })).toHaveAttribute('aria-current', 'step');
  await expect.poll(progress).toBe(1);
  const position = await count.innerText();
  await page.waitForTimeout(2_000);
  await expect(count).toHaveText(position);
  for (const name of ['Previous step', 'Next step', 'Previous section', 'Next section']) {
    const button = view.getByRole('button', { name, exact: true });
    await expect(button).toHaveClass('btn btn-icon');
    await expect(button).toHaveText('');
  }
  const controls = view.getByRole('group', { name: 'Walkthrough controls' });
  await controls.screenshot({ path: 'test-results/restored-controls-desktop.png' });
  await page.screenshot({ path: 'test-results/manual-navigation-desktop.png' });
});

test('reduced motion reveals a step immediately and phone controls fit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/sample');
  await page.getByRole('button', { name: 'How it works', exact: true }).click();
  const view = page.locator('.walkthrough');
  await view.getByRole('button', { name: 'Next step' }).click();
  await expect(view.locator('.stage')).toHaveAttribute('data-step-mode', 'true');
  expect(await view.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--p'))).toBe('1.0000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/manual-navigation-mobile.png' });
});
