import assert from "node:assert/strict";
import { test } from "node:test";
import {
  noticeDay,
  noticeHref,
  noticeKind,
  noticeTime,
  orderedNotices,
} from "../src/lib/notifications";
test("notification navigation permits only known local routes including queries and fragments", () => {
  for (const href of [
    "/movie/12",
    "/admin?tab=suggestions",
    "/catalog?suggestions=mine",
    "/friends",
    "/movie/1#comments",
  ])
    assert.equal(noticeHref(href), href);
  for (const href of [
    "javascript:alert(1)",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/movie/1\n",
    "/unknown",
    "/movie/9999999999999",
    null,
    12,
    "/%2f%2fevil.test",
  ])
    assert.equal(noticeHref(href), null);
});
test("legacy event classification never determines permissions or navigation", () => {
  assert.equal(
    noticeKind({ message: "Вам понравился комментарий", link: "/movie/1" }),
    "comment",
  );
  assert.equal(
    noticeKind({ message: "Киноман приглашает в друзья", link: "/friends" }),
    "friend",
  );
  assert.equal(
    noticeKind({
      message: "Автор предложил(а) «Фильм»",
      link: "/admin?tab=suggestions",
    }),
    "suggestion",
  );
  assert.equal(
    noticeKind({ message: "Автор рекомендует фильм", link: "/movie/1" }),
    "recommendation",
  );
  assert.equal(noticeKind({ message: "Новое событие", link: null }), "system");
});
test("notices sort newest-first with deterministic ID ties without changing the source", () => {
  const base = { message: "Тест", link: null, read: false },
    data = [
      { ...base, id: 1, createdAt: "bad" },
      { ...base, id: 2, createdAt: "2026-11-22T10:00:00Z" },
      { ...base, id: 3, createdAt: "2026-11-22T10:00:00Z" },
    ];
  assert.deepEqual(
    orderedNotices(data).map((n) => n.id),
    [3, 2, 1],
  );
  assert.deepEqual(
    data.map((n) => n.id),
    [1, 2, 3],
  );
});
test("day groups use local calendar dates, including the year boundary and invalid dates", () => {
  const now = new Date(2026, 0, 1, 1);
  assert.equal(noticeDay(new Date(2026, 0, 1, 0).toISOString(), now), "today");
  assert.equal(
    noticeDay(new Date(2025, 11, 31, 23).toISOString(), now),
    "yesterday",
  );
  assert.equal(noticeDay(new Date(2025, 11, 30).toISOString(), now), "earlier");
  assert.equal(noticeDay("invalid", now), "earlier");
});
test("relative times are readable and tolerate invalid or future provider timestamps", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  assert.equal(noticeTime("2026-11-22T11:59:50Z", now), "Только что");
  assert.equal(noticeTime("2026-11-22T11:58:00Z", now, true), "2 minutes ago");
  assert.equal(noticeTime("2026-11-22T10:00:00Z", now, true), "2 hours ago");
  assert.equal(noticeTime("2027-01-01", now, true), "Just now");
  assert.equal(noticeTime("bad", now), "Дата неизвестна");
  assert.match(noticeTime("2025-01-01", now, true), /2025/);
});
