import assert from "node:assert/strict";
import { test } from "node:test";
import { titleCollection } from "../src/lib/user-titles";
import { titleStudioView } from "../src/lib/profile-identity";
const zero = {
  watches: 0,
  marvel: 0,
  marvelTotal: 0,
  festival: 0,
  spoilers: 0,
};
test("title studio filters the server collection without changing ownership or selection", () => {
  const collection = titleCollection(
    { ...zero, watches: 5 },
    ["arthouse_king"],
    "arthouse_king",
  );
  const before = JSON.stringify(collection);
  const all = titleStudioView(collection, "all"),
    unlocked = titleStudioView(collection, "unlocked"),
    locked = titleStudioView(collection, "locked");
  assert.equal(all.total, 10);
  assert.equal(all.unlocked, 3);
  assert.equal(all.locked, 7);
  assert.deepEqual(
    unlocked.options.map((o) => o.id),
    ["beginner", "seeker", "arthouse_king"],
  );
  assert(locked.options.every((o) => !o.unlocked));
  assert.equal(all.next?.id, "frame_master");
  assert.equal(JSON.stringify(collection), before);
});
test("next viewer title ignores permanently earned special titles and completed ranks", () => {
  const collection = titleCollection(
    zero,
    ["seeker", "screen_legend", "marvel_advocate"],
    null,
  );
  for (const filter of ["all", "unlocked", "locked"] as const)
    assert.equal(titleStudioView(collection, filter).next?.id, "frame_master");
});
test("completed viewer progression has no invented next reward", () => {
  const collection = titleCollection({ ...zero, watches: 500 }, [], "none");
  const view = titleStudioView(collection, "locked");
  assert.equal(view.next, null);
  assert.equal(view.unlocked, 7);
  assert.equal(view.options.length, 3);
  assert.equal(collection.active, null);
});
test("a completed collection has an honest empty locked filter", () => {
  const collection = titleCollection(
    {
      ...zero,
      watches: 500,
      marvel: 3,
      marvelTotal: 3,
      festival: 50,
      spoilers: 10,
    },
    [],
    null,
  );
  const view = titleStudioView(collection, "locked");
  assert.equal(view.locked, 0);
  assert.equal(view.unlocked, 10);
  assert.deepEqual(view.options, []);
});
