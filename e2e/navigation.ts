import { expect, type Page } from '@playwright/test';

/** Wait for CSS-variable reveals as well as ordinary entrance animations before measuring contrast. */
export async function finishAnimations(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>('.walkthrough')].every((el) => {
      const progress = el.style.getPropertyValue('--p');
      return !progress || Number(progress) >= 1;
    }) && document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
}

/** Traverse using the same section buttons available to a reader. */
export async function goToChapter(page: Page, name: RegExp) {
  const view = page.locator('.walkthrough');
  const previous = view.getByRole('button', { name: 'Previous section', exact: true });
  await expect(previous).toBeVisible();
  for (let i = 0; i < 20 && await previous.isEnabled(); i += 1) await previous.click();
  const heading = view.getByRole('heading', { level: 2 });
  for (let i = 0; i < 20; i += 1) {
    if (name.test(await heading.innerText())) return;
    const next = view.getByRole('button', { name: 'Next section', exact: true });
    if (!await next.isEnabled()) break;
    await next.click();
  }
  await expect(heading).toHaveText(name);
}

export async function lastStep(page: Page) {
  const next = page.locator('.walkthrough').getByRole('button', { name: 'Next section', exact: true });
  await expect(next).toBeVisible();
  for (let i = 0; i < 20 && await next.isEnabled(); i += 1) await next.click();
  await expect(next).toBeDisabled();
}
