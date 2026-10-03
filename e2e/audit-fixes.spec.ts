import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { goToChapter } from './navigation';

test('text view contains real option tables, the temperature control, and exercises', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/sample');
  await page.getByRole('button', { name: 'How it works', exact: true }).click();
  await page.getByRole('button', { name: 'Read as text' }).click();
  const text = page.locator('.transcript');
  const table = text.getByRole('table').first();
  await expect(table.getByRole('columnheader', { name: 'Recorded option' })).toBeVisible();
  await expect(table.locator('[data-kind="recorded"]')).not.toHaveCount(0);
  await expect(table.locator('[data-kind="calculated"]')).not.toHaveCount(0);
  const slider = text.getByRole('slider', { name: 'What-if temperature' });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('0.6');
  await text.getByRole('button', { name: /Simulate .* picks/ }).click();
  await expect(text.getByText('Simulated on this page; the model wasn’t asked again.')).toBeVisible();
  await expect(text.getByRole('heading', { name: 'The input and reply' })).toBeVisible();
  await expect(text.getByRole('group', { name: 'Which option did the model score highest?' })).toBeVisible();
  await expect(text.locator('.check-list')).toBeVisible();
  await page.screenshot({ path: 'test-results/audit-transcript-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test('glossary stays inside a narrow viewport and Escape closes it without moving focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const term = page.getByRole('button', { name: 'logprobs', exact: true }).first();
  await term.focus();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  for (const width of [320, 375, 640]) {
    await page.setViewportSize({ width, height: 568 });
    await expect.poll(async () => {
      const r = await tip.boundingBox();
      return r !== null && r.x >= 0 && r.x + r.width <= width && r.y >= 0 && r.y + r.height <= 568;
    }).toBe(true);
  }
  await page.screenshot({ path: 'test-results/audit-tooltip.png' });
  await term.press('Escape');
  await expect(tip).toHaveCount(0);
  await expect(term).toBeFocused();
});

test('phone FAQ index is collapsed and desktop index remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/faq');
  const index = page.locator('#faq-questions');
  await expect(index).not.toHaveAttribute('open');
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await index.getByText('Choose a question', { exact: true }).click();
  await expect(index).toHaveAttribute('open');
  await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'How does a neural network learn?' }).click();
  await expect(page).toHaveURL(/#training$/);
  await page.locator('#training').getByRole('link', { name: 'Back to questions' }).click();
  await expect(page).toHaveURL(/#faq-questions$/);
  await index.getByText('Choose a question', { exact: true }).click();
  await page.screenshot({ path: 'test-results/audit-faq-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.faq-toc-desktop')).toBeVisible();
  await expect(index).toBeHidden();
});

test('caption and visible Example warning precede the graphic', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sample');
  await goToChapter(page, /Inside/);
  const step = page.locator('.step-view');
  expect(await step.evaluate((el) => [...el.children].map((c) => c.className))).toEqual(['caption', 'banner-examples', 'stage']);
  const caveat = step.locator('.banner-examples');
  await expect(caveat).not.toHaveAttribute('open');
  await expect(caveat.getByText(/Teaching drawing/)).toBeVisible();
  await caveat.locator('summary').click();
  await expect(caveat.locator('p')).toBeVisible();
  await page.screenshot({ path: 'test-results/audit-caption-desktop.png' });
});

for (const count of [12, null, 'absent_usage'] as const) {
  test(`hidden reasoning fallback (${count}) is labeled and unlocks the composer`, async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).split('\n').map((line) => {
        if (!line.startsWith('data: ')) return line;
        const event = JSON.parse(line.slice(6));
        if (event.type === 'end' && event.usage) event.usage = count === 'absent_usage' ? null : { ...event.usage, reasoningTokens: count };
        return `data: ${JSON.stringify(event)}`;
      }).join('\n');
      await route.fulfill({ response, body });
    });
    await page.goto('/chat');
    await page.getByRole('button', { name: 'I understand' }).click();
    const composer = page.getByRole('textbox', { name: 'Your message' });
    await composer.fill('Why is the sky blue?');
    await composer.press('Enter');
    await expect(page.getByRole('heading', { name: 'What we can show' })).toBeVisible();
    const fallback = page.locator('.walkthrough-empty');
    if (count !== 12) await expect(fallback.getByText('Hidden-token count unavailable.')).toBeVisible();
    else {
      await expect(fallback.locator('[data-kind="recorded"] .datum-value')).toHaveText('12');
      await expect(fallback.getByText(/hidden tokens \(count only\)/)).toBeVisible();
    }
    await expect(page.locator('.stage')).toHaveCount(0);
    await composer.fill('A follow-up');
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    await page.getByRole('button', { name: 'Continue chatting' }).click();
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
}
