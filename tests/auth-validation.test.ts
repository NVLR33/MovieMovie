import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { test } from 'node:test';
import { sessionSecret, validOAuthState, verifyTelegramLogin } from '../src/lib/auth-validation';

const token = 'test-bot-token';
const now = 1_800_000_000;
function signed(fields: Record<string, string | number> = {}) {
  const data = { id: 12345, first_name: 'Анна', username: 'anna', auth_date: now, ...fields };
  const checkString = Object.entries(data).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHash('sha256').update(token).digest();
  return { ...data, hash: createHmac('sha256', secret).update(checkString).digest('hex') };
}

test('Telegram accepts an authentic, fresh widget payload regardless of field order', () => {
  const data = signed();
  assert.equal(verifyTelegramLogin(data, token, now), true);
  assert.equal(verifyTelegramLogin(Object.fromEntries(Object.entries(data).reverse()), token, now), true);
});

test('Telegram rejects forged identity, signature, or wrong bot key', () => {
  assert.equal(verifyTelegramLogin({ ...signed(), id: 42 }, token, now), false);
  assert.equal(verifyTelegramLogin({ ...signed(), hash: 'a'.repeat(64) }, token, now), false);
  assert.equal(verifyTelegramLogin(signed(), 'another-bot', now), false);
  assert.equal(verifyTelegramLogin(signed(), '', now), false);
});

test('Telegram rejects expired and future authentication dates', () => {
  assert.equal(verifyTelegramLogin(signed({ auth_date: now - 86401 }), token, now), false);
  assert.equal(verifyTelegramLogin(signed({ auth_date: now + 61 }), token, now), false);
  assert.equal(verifyTelegramLogin(signed({ auth_date: now - 86400 }), token, now), true);
});

test('Telegram rejects malformed data without throwing', () => {
  for (const data of [null, [], 'hello', {}, { ...signed(), hash: 'xx' },
    { ...signed(), hash: 'a'.repeat(63) }, signed({ id: -1 }), signed({ id: 1.5 }),
    signed({ id: '12345' }), { ...signed(), username: {} }]) {
    assert.equal(verifyTelegramLogin(data, token, now), false);
  }
});

test('OAuth requires both matching, nonempty states', () => {
  assert.equal(validOAuthState('expected', 'expected'), true);
  for (const [saved, received] of [[undefined, null], ['expected', null],
    [undefined, 'expected'], ['expected', 'forged'], ['', '']] as const) {
    assert.equal(validOAuthState(saved, received), false);
  }
});

test('production sessions fail closed without a sufficiently strong dedicated secret', () => {
  for (const secret of [undefined, '', 'short']) {
    assert.throws(() => sessionSecret({ NODE_ENV: 'production', SESSION_SECRET: secret,
      DATABASE_URL: 'not-a-session-secret' }), /SESSION_SECRET/);
  }
  const secret = 'x'.repeat(32);
  assert.equal(sessionSecret({ NODE_ENV: 'production', SESSION_SECRET: secret }), secret);
  assert.doesNotThrow(() => sessionSecret({ NODE_ENV: 'development' }));
});
