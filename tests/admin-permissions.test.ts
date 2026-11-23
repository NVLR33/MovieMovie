import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionsFor, sessionIsCurrent } from '../src/lib/permissions';
for (const role of ['visitor', 'vip', 'moderator', 'admin']) {
  for (const isEditor of [false, true]) {
    test(`${role}, editor=${isEditor}: independent and least-privilege capabilities`, () => {
      const p = permissionsFor({ role, isEditor });
      assert.equal(p.create, isEditor || ['admin', 'moderator'].includes(role));
      assert.equal(p.manageUsers, role === 'admin');
      assert.equal(p.edit, ['admin', 'moderator'].includes(role));
      assert.equal(p.moderate, p.edit);
      assert.equal(p.curate, p.manageUsers);
      assert.equal(p.audit, p.manageUsers);
      assert.equal(p.access, p.create);
      for (const value of Object.values(
        permissionsFor({ role, isEditor, isSuspended: true }),
      ))
        assert.equal(value, false);
    });
  }
}
test('guests have no staff/editor capabilities', () => {
  for (const value of Object.values(permissionsFor(null)))
    assert.equal(value, false);
});
test('session revocation is permanent, legacy sessions are accepted only at version zero', () => {
  assert.equal(sessionIsCurrent({}, undefined), true);
  assert.equal(sessionIsCurrent({ sessionVersion: 0 }, 0), true);
  assert.equal(sessionIsCurrent({ sessionVersion: 1 }, undefined), false);
  assert.equal(sessionIsCurrent({ sessionVersion: 1 }, 0), false);
  assert.equal(sessionIsCurrent({ sessionVersion: 1 }, 1), true);
  assert.equal(sessionIsCurrent({ sessionVersion: 1 }, '1'), false);
  assert.equal(
    sessionIsCurrent({ sessionVersion: 1, isSuspended: true }, 1),
    false,
  );
  assert.equal(sessionIsCurrent({ sessionVersion: 2 }, 1), false);
});
