import test from 'node:test';
import assert from 'node:assert/strict';
import {
  keyboardOccludesNavigation,
  mobileTabFor,
} from '../src/lib/mobile-experience';
test('bottom navigation selects catalogue for material details and More for secondary destinations', () => {
  for (const page of ['home', 'catalog', 'games', 'profile'])
    assert.equal(mobileTabFor(page), page);
  assert.equal(mobileTabFor('movie'), 'catalog');
  for (const page of [
    'watchlist',
    'favorites',
    'chat',
    'admin',
    'world',
    'viewuser',
    'room',
  ])
    assert.equal(mobileTabFor(page), 'more');
});
test('software keyboard detection requires text entry and substantial viewport reduction, not pinch zoom or browser chrome', () => {
  assert.equal(
    keyboardOccludesNavigation({ baseline: 844, height: 530, editable: true }),
    true,
  );
  assert.equal(
    keyboardOccludesNavigation({ baseline: 844, height: 530, editable: false }),
    false,
  );
  assert.equal(
    keyboardOccludesNavigation({ baseline: 844, height: 760, editable: true }),
    false,
  );
  assert.equal(
    keyboardOccludesNavigation({
      baseline: 844,
      height: 530,
      editable: true,
      scale: 2,
    }),
    false,
  );
  assert.equal(
    keyboardOccludesNavigation({ baseline: 390, height: 230, editable: true }),
    true,
  );
});
