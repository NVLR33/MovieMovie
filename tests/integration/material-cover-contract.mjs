import assert from 'node:assert/strict';

/** Cross-section contract: navigation and section composition are tested by callers. */
export async function assertMaterialCovers(page, scope = 'body') {
  const result = await page.locator(scope).evaluate((root) => {
    const issues = [];
    let count = 0;
    for (const cover of root.querySelectorAll('[data-material-cover]')) {
      const r = cover.getBoundingClientRect();
      if (!r.width || !r.height || !cover.checkVisibility()) continue;
      count++;
      const name = cover.className;
      const style = getComputedStyle(cover);
      if (Math.abs(cover.offsetHeight - cover.offsetWidth * 1.5) > 2)
        issues.push(
          `${name}: noncatalog aspect ratio ${cover.offsetWidth}x${cover.offsetHeight}`,
        );
      const poster = cover.querySelector('.cinema-poster');
      if (!poster) {
        issues.push(`${name}: missing shared fallback/image`);
        continue;
      }
      const border = parseFloat(style.borderTopWidth);
      if (
        Math.abs(poster.offsetWidth - cover.clientWidth) > 1 ||
        Math.abs(poster.offsetHeight - cover.clientHeight) > 1
      )
        issues.push(`${name}: artwork does not fill the cover`);
      if (border !== (cover.closest('.film-card') ? 0 : 2))
        issues.push(`${name}: wrong border ownership`);
      if (cover.querySelector('a'))
        issues.push(`${name}: cover introduced nested navigation`);
      for (const chip of cover.querySelectorAll('.cover-score, .cover-age')) {
        if (!chip.checkVisibility()) continue;
        const s = getComputedStyle(chip);
        if (
          chip.offsetLeft < 0 ||
          chip.offsetLeft + chip.offsetWidth > cover.clientWidth ||
          chip.offsetTop < 0 ||
          chip.offsetTop + chip.offsetHeight > cover.clientHeight
        )
          issues.push(`${name}: chip outside artwork`);
        if (chip.offsetLeft > 9)
          issues.push(`${name}: chip not aligned to catalog left edge`);
        if (s.backgroundColor !== 'rgba(24, 27, 35, 0.94)')
          issues.push(`${name}: inconsistent badge background`);
        if (chip.matches('.cover-score') && chip.offsetTop > 9)
          issues.push(`${name}: rating not at top left`);
        if (
          chip.matches('.cover-age') &&
          cover.clientHeight - chip.offsetTop - chip.offsetHeight > 9
        )
          issues.push(`${name}: age not at bottom left`);
      }
    }
    return { count, issues };
  });
  assert(result.count > 0, `No shared covers in ${scope}`);
  assert.deepEqual(result.issues, [], `Catalog cover contract in ${scope}`);
}
