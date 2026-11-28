import test from "node:test";
import assert from "node:assert/strict";
import {
  sidebarLayout,
  sidebarIsCompact,
} from "../src/lib/navigation-preference";

test("sidebar preference accepts only known modes and defaults to automatic", () => {
  for (const value of [null, undefined, "", "false", "AUTO", {}, 0]) {
    assert.equal(sidebarLayout(value), "auto");
  }
  for (const value of ["auto", "expanded", "collapsed"] as const) {
    assert.equal(sidebarLayout(value), value);
  }
});
test("explicit sidebar preference overrides automatic desktop breakpoint", () => {
  assert.equal(sidebarIsCompact("auto", false), false);
  assert.equal(sidebarIsCompact("auto", true), true);
  for (const narrow of [false, true]) {
    assert.equal(sidebarIsCompact("expanded", narrow), false);
    assert.equal(sidebarIsCompact("collapsed", narrow), true);
  }
});
