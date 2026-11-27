import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reverseGeocode,
  parseGeocodedCity,
  validCoordinates,
} from "../src/lib/geolocation";
import {
  loadShowtimes,
  localDate,
  validShowDate,
  ShowtimesInputError,
} from "../src/lib/showtimes";
import { POST as locationPost } from "../src/app/api/location/route";
import { GET as showtimesGet } from "../src/app/api/showtimes/route";

test("city geocoder supports settlements beyond offline index, rounds coordinates, ignores non-city results", async () => {
  let called = "";
  const city = await reverseGeocode(48.856613, 2.352222, async (url) => {
    called = url;
    return {
      address: { city: "Париж", state: "Иль-де-Франс", country: "Франция" },
    };
  });
  assert.equal(city?.city, "Париж");
  const url = new URL(called);
  assert.equal(url.origin, "https://nominatim.openstreetmap.org");
  assert.equal(url.searchParams.get("lat"), "48.86");
  assert.equal(url.searchParams.get("lon"), "2.35");
  assert.equal(url.searchParams.get("zoom"), "10");
  assert.equal(parseGeocodedCity({ address: { state: "Область" } }), null);
  assert.equal(
    parseGeocodedCity({ address: { city: "<script>", town: "Кунгур" } })?.city,
    "Кунгур",
  );
  assert(!validCoordinates(91, 0));
  assert(!validCoordinates("55", 37));
  assert(!validCoordinates(55, Infinity));
});
const now = new Date("2026-11-22T05:00:00Z");
const locations = [
  { slug: "ekb", name: "Екатеринбург", timezone: "Asia/Yekaterinburg" },
];
function provider(options: { empty?: boolean; more?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    get: async (href: string): Promise<unknown> => {
      calls.push(href);
      const url = new URL(href);
      assert.equal(url.origin, "https://kudago.com");
      if (url.pathname.endsWith("/locations/")) return locations;
      if (url.pathname.endsWith("/movie-showings/"))
        return {
          next: options.more ? "https://evil.test/follow-me" : null,
          results: options.empty
            ? []
            : [
                {
                  id: 1,
                  movie: { id: 9 },
                  place: { id: 20 },
                  datetime: Date.parse("2026-11-22T06:00:00Z") / 1000,
                  price: "от 350 ₽",
                  three_d: true,
                },
                {
                  id: 2,
                  movie: { id: 9 },
                  place: { id: 20 },
                  datetime: Date.parse("2026-11-22T19:00:00Z") / 1000,
                },
                {
                  id: 3,
                  movie: { id: 9 },
                  place: { id: 20 },
                  datetime: Date.parse("2026-11-22T04:00:00Z") / 1000,
                },
              ],
        };
      if (url.pathname.endsWith("/movies/"))
        return { results: [{ id: 9, title: "<b>Фильм</b>" }] };
      if (url.pathname.endsWith("/places/"))
        return {
          results: [{ id: 20, title: "Кинотеатр", address: "Улица, 10" }],
        };
      throw new Error("Unexpected URL");
    },
  };
}
test("real showing adapter joins bounded movie/place references, honors city timezone and drops past/next-day slots", async () => {
  const fake = provider(),
    data = await loadShowtimes("Екатеринбург", "", fake.get, now);
  assert.equal(data.date, "2026-11-22");
  assert.equal(data.timezone, "Asia/Yekaterinburg");
  assert.equal(data.showings.length, 1);
  assert.deepEqual(data.showings[0], {
    id: 1,
    movieId: 9,
    movie: "Фильм",
    cinema: "Кинотеатр",
    address: "Улица, 10",
    startsAt: "2026-11-22T06:00:00.000Z",
    price: "от 350 ₽",
    format: "3D",
    url: "https://kudago.com/ekb/movie/9/",
  });
  const query = new URL(
    fake.calls.find((url) => url.includes("/movie-showings/"))!,
  ).searchParams;
  assert.equal(
    Number(query.get("actual_until")),
    Date.parse("2026-11-22T19:00:00Z") / 1000 - 1,
  );
  assert.equal(
    data.truncated,
    true,
    "Dropped incomplete/out-of-range records are disclosed",
  );
});
test("uncovered city stays uncovered, empty schedule stays empty, next URLs cannot become SSRF", async () => {
  const fake = provider();
  const missing = await loadShowtimes("Каменск-Уральский", "", fake.get, now);
  assert.equal(missing.status, "unsupported");
  assert.deepEqual(missing.showings, []);
  assert.equal(fake.calls.length, 1);
  const empty = provider({ empty: true });
  assert.equal(
    (await loadShowtimes("Екатеринбург", "", empty.get, now)).showings.length,
    0,
  );
  assert.equal(empty.calls.length, 2);
  const pages = provider({ more: true }),
    partial = await loadShowtimes("Екатеринбург", "", pages.get, now);
  assert.equal(
    pages.calls.filter((url) => url.includes("/movie-showings/")).length,
    2,
  );
  assert.equal(partial.truncated, true);
  assert.equal(partial.showings.length, 1);
  assert(pages.calls.every((url) => url.startsWith("https://kudago.com/")));
});
test("bad dates, locations, provider errors never become fabricated empty success", async () => {
  assert.equal(
    localDate(new Date("2026-11-22T20:00:00Z"), "Asia/Yekaterinburg"),
    "2026-11-23",
  );
  assert(validShowDate("2026-11-28", "2026-11-22"));
  assert(!validShowDate("2026-11-29", "2026-11-22"));
  assert(!validShowDate("2026-02-30", "2026-02-28"));
  await assert.rejects(
    loadShowtimes("Москва", "2026-02-30", provider().get, now),
    ShowtimesInputError,
  );
  await assert.rejects(
    loadShowtimes("<script>", "", provider().get, now),
    ShowtimesInputError,
  );
  await assert.rejects(
    loadShowtimes(
      "Екатеринбург",
      "",
      async () => {
        throw new Error("offline");
      },
      now,
    ),
    /offline/,
  );
  await assert.rejects(
    loadShowtimes(
      "Екатеринбург",
      "",
      async (url) =>
        url.includes("/locations/") ? locations : { unexpected: [] },
      now,
    ),
    /Invalid provider/,
  );
});
test("location API validates same origin and accuracy before any upstream call; no-store and throttle", async (context) => {
  let count = 0;
  context.mock.method(globalThis, "fetch", async (url: unknown) => {
    count++;
    assert.match(
      String(url),
      /^https:\/\/nominatim\.openstreetmap\.org\/reverse\?/,
    );
    return Response.json({ address: { town: "Кунгур", country: "Россия" } });
  });
  context.mock.method(Date, "now", () => 100000);
  const request = (body: unknown, origin = "https://app.test") =>
    new Request("https://app.test/api/location", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await locationPost(
        request(
          { latitude: 55, longitude: 37, accuracy: 100 },
          "https://evil.test",
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await locationPost(
        request({ latitude: NaN, longitude: 37, accuracy: 100 }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await locationPost(
        request({ latitude: 55, longitude: 37, accuracy: 50000 }),
      )
    ).status,
    400,
  );
  assert.equal(count, 0);
  const good = await locationPost(
    request({ latitude: 55, longitude: 37, accuracy: 100 }),
  );
  assert.equal(good.status, 200);
  assert.equal((await good.json()).city, "Кунгур");
  assert.equal(good.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (
      await locationPost(
        request({ latitude: 55, longitude: 37, accuracy: 100 }),
      )
    ).status,
    429,
  );
  assert.equal(count, 1);
});
test("showtimes endpoint rejects malformed query without querying providers", async () => {
  assert.equal(
    (
      await showtimesGet(
        new Request("https://app.test/api/showtimes?city=%3Cscript%3E"),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await showtimesGet(
        new Request("https://app.test/api/showtimes?city=Москва&date=evil"),
      )
    ).status,
    400,
  );
});

test("showings accept numeric references as well as object IDs", async () => {
  const fake = provider();
  const get = async (url: string) => {
    const body = await fake.get(url);
    if (url.includes("/movie-showings/")) {
      const data = body as { results: Record<string, unknown>[] };
      for (const row of data.results) {
        row.movie = 9;
        row.place = 20;
      }
    }
    return body;
  };
  assert.equal(
    (await loadShowtimes("Екатеринбург", "", get, now)).showings.length,
    1,
  );
});

test("malformed locations fail honestly; an unknown timezone never fabricates Moscow showings", async () => {
  await assert.rejects(
    loadShowtimes("Москва", "", async () => [], now),
    /Invalid provider location list/,
  );
  const data = await loadShowtimes(
    "Екатеринбург",
    "",
    async (url) => {
      assert(
        url.includes("/locations/"),
        "Do not request showings for an invalid timezone",
      );
      return [
        ...locations.map((row) => ({ ...row, timezone: "invalid/timezone" })),
        { slug: "msk", name: "Москва", timezone: "Europe/Moscow" },
      ];
    },
    now,
  );
  assert.equal(data.status, "unsupported");
  assert.deepEqual(data.showings, []);
});
