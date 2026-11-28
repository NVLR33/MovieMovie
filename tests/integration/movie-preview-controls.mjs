import assert from 'node:assert/strict';

/** Feature tests that need the full page must explicitly continue from quick view. */
export async function continueMoviePreview(page, expectedHref) {
  const dialog = page.locator('dialog.movie-quick-view');
  await dialog.waitFor();
  const link = dialog.getByRole('link', { name: 'Полная карточка', exact: true });
  const href = await link.getAttribute('href');
  assert.match(href, /^\/movie\/[1-9]\d*$/);
  if (expectedHref) assert.equal(href, expectedHref);
  await link.click();
  await page.waitForURL(url => url.pathname === href);
  await page.locator('.movie-detail-page h1').waitFor();
}
