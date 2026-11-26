export const CITY_STORAGE_KEY = 'mg_city_v1';
/** Small offline suggestion index, not a reverse geocoder. A proposal always needs confirmation. */
export const CITY_CHOICES = [
  { name: 'Москва', lat: 55.7558, lon: 37.6173 },
  { name: 'Санкт-Петербург', lat: 59.9343, lon: 30.3351 },
  { name: 'Каменск-Уральский', lat: 56.4149, lon: 61.9187 },
  { name: 'Екатеринбург', lat: 56.8389, lon: 60.6057 },
  { name: 'Нижний Тагил', lat: 57.9194, lon: 59.965 },
  { name: 'Челябинск', lat: 55.1644, lon: 61.4368 },
  { name: 'Тюмень', lat: 57.1522, lon: 65.5272 },
  { name: 'Пермь', lat: 58.0105, lon: 56.2502 },
  { name: 'Казань', lat: 55.7961, lon: 49.1064 },
  { name: 'Уфа', lat: 54.7388, lon: 55.9721 },
  { name: 'Новосибирск', lat: 55.0084, lon: 82.9357 },
  { name: 'Омск', lat: 54.9885, lon: 73.3242 },
  { name: 'Красноярск', lat: 56.0153, lon: 92.8932 },
  { name: 'Самара', lat: 53.1959, lon: 50.1002 },
  { name: 'Нижний Новгород', lat: 56.3269, lon: 44.0059 },
  { name: 'Воронеж', lat: 51.6608, lon: 39.2003 },
  { name: 'Волгоград', lat: 48.708, lon: 44.5133 },
  { name: 'Ростов-на-Дону', lat: 47.2357, lon: 39.7015 },
  { name: 'Краснодар', lat: 45.0355, lon: 38.9753 },
  { name: 'Сочи', lat: 43.5855, lon: 39.7231 },
  { name: 'Калининград', lat: 54.7104, lon: 20.4522 },
  { name: 'Иркутск', lat: 52.2869, lon: 104.305 },
  { name: 'Хабаровск', lat: 48.4802, lon: 135.0719 },
  { name: 'Владивосток', lat: 43.1155, lon: 131.8855 },
] as const;
export function normalizeCity(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 160 ||
    /[\p{Cc}\p{Cf}]/u.test(value)
  )
    return '';
  const city = value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return city.length >= 2 &&
    city.length <= 80 &&
    /^[\p{L}\p{N} .,'()\-]+$/u.test(city) &&
    /\p{L}.*\p{L}/u.test(city)
    ? city
    : '';
}
export function savedCity(raw: string | null): string {
  if (!raw) return '';
  try {
    return normalizeCity(JSON.parse(raw).city);
  } catch {
    return '';
  }
}
export function nearbyCity(
  lat: number,
  lon: number,
  accuracy: number,
): string | null {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(accuracy) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    accuracy < 0 ||
    accuracy > 20000
  )
    return null;
  const rad = (n: number) => (n * Math.PI) / 180;
  const distance = (city: (typeof CITY_CHOICES)[number]) => {
    const a =
      Math.sin(rad(city.lat - lat) / 2) ** 2 +
      Math.cos(rad(lat)) *
        Math.cos(rad(city.lat)) *
        Math.sin(rad(city.lon - lon) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  };
  const ranked = CITY_CHOICES.map((city) => ({
    city,
    distance: distance(city),
  })).sort((a, b) => a.distance - b.distance);
  return ranked[0].distance <= 40 ? ranked[0].city.name : null;
}
/** Outbound search, not an assertion that a film is currently screening. */
export function cinemaSearchUrl(city: string, title?: string): string | null {
  const valid = normalizeCity(city);
  if (!valid) return null;
  const url = new URL('https://yandex.ru/search/');
  url.searchParams.set(
    'text',
    [valid, title?.slice(0, 200), 'кинотеатры афиша сеансы сегодня']
      .filter(Boolean)
      .join(' '),
  );
  return url.href;
}
