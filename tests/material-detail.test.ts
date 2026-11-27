import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  DetailDescription,
  DetailTags,
  detailTitleStyle,
} from "../src/components/material-detail-parts";

test("long material titles get smaller ceilings without truncating text", () => {
  const maximum = (n: number) =>
    Number.parseInt(
      (detailTitleStyle("Я".repeat(n)) as Record<string, string>)[
        "--detail-title-max"
      ],
    );
  assert.equal(maximum(20), 38);
  assert.equal(maximum(60), 34);
  assert.equal(maximum(90), 30);
  assert.equal(maximum(150), 27);
});
test("description is initially clamped and safely escaped; empty descriptions add no space", () => {
  assert.equal(
    renderToStaticMarkup(createElement(DetailDescription, { text: "  " })),
    "",
  );
  const html = renderToStaticMarkup(
    createElement(DetailDescription, { text: "<script>alert(1)</script>" }),
  );
  assert.match(html, /detail-synopsis-clamped/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
test("tags deduplicate genres/studios and hide overflow behind a labelled disclosure", () => {
  const html = renderToStaticMarkup(
    createElement(DetailTags, {
      genre: "Драма, Драма, Комедия, Аниме, История, Детектив",
      studio: "Студия",
      go: () => {},
    }),
  );
  assert.equal((html.match(/>Драма<\/button>/g) || []).length, 1);
  assert.equal((html.match(/hidden=""/g) || []).length, 2);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Ещё 2/);
});
test("material header keeps unrelated actions out and seasons out of the lower page", () => {
  const source = readFileSync("src/components/movie-go-app.tsx", "utf8");
  const detail = source.slice(
    source.indexOf("function MovieDetailContent("),
    source.indexOf("function MovieDetailContent(") + 23000,
  );
  assert.doesNotMatch(
    detail,
    /CinemaSearchLink|Мнения сообщества ·|Кинозал<\/button>/,
  );
  assert.match(detail, /detail-library-actions/);
  assert.match(detail, /Открыть комментарии/);
  const series = readFileSync("src/components/series-panel.tsx", "utf8");
  assert.match(series, /aria-haspopup="dialog"/);
  assert.match(series, /element.showModal\(\)/);
  assert.match(series, /Несохранённые изменения редактора/);
});
