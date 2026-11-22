import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserStorage, copyText } from '../src/lib/browser-preferences';
test('optional browser preferences and clipboard tolerate unavailable or denied capabilities', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage denied'); } });
    assert.equal(browserStorage.getItem('theme'),null);
    assert.doesNotThrow(()=>browserStorage.setItem('theme','dark'));
    assert.equal(await copyText('test'),false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis,'localStorage',descriptor);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
