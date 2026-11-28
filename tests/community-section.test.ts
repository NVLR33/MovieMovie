import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DailyGame from "../src/components/daily-game";
const question = {
  id: "community-unit",
  date: "2026-11-22",
  movieId: 1,
  title: "<script>Test</script>",
  options: ["2001", "2002", "2003", "2004"],
  correct: "2001",
};
test("standalone daily quiz keeps its navigation and accessible four-option preview", () => {
  const html = renderToStaticMarkup(
    createElement(DailyGame, { question, go: () => {} }),
  );
  assert.match(html, /daily-game-more/);
  assert.equal((html.match(/class="daily-game-option"/g) || []).length, 4);
  assert.match(html, /role="status"/);
  assert.match(html, /&lt;script&gt;Test&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test("embedded daily quiz leaves a single card-level CTA to the parent without removing the question or no-XP note", () => {
  const html = renderToStaticMarkup(
    createElement(DailyGame, { question, go: () => {}, showMore: false }),
  );
  assert.doesNotMatch(html, /daily-game-more/);
  assert.match(html, /<fieldset/);
  assert.match(html, /Разминка без XP/);
  assert.equal((html.match(/class="daily-game-option"/g) || []).length, 4);
});
