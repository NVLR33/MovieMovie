import iso from 'i18n-iso-countries';
import ru from 'i18n-iso-countries/langs/ru.json';
import en from 'i18n-iso-countries/langs/en.json';
iso.registerLocale(ru); iso.registerLocale(en);

const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
const aliases: Record<string, string> = {
  'сша': 'US', 'usa': 'US', 'u.s.a.': 'US', 'соединенные штаты': 'US', 'великобритания': 'GB', 'англия': 'GB', 'uk': 'GB',
  'россия': 'RU', 'рф': 'RU', 'южная корея': 'KR', 'республика корея': 'KR', 'северная корея': 'KP',
  'китай': 'CN', 'кнр': 'CN', 'гонконг': 'HK', 'оаэ': 'AE', 'чехия': 'CZ', 'турция': 'TR',
};
export function countryCode(value: string): string | null {
  const text = normalize(value);
  if (!text) return null;
  if (aliases[text]) return aliases[text];
  const upper = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && iso.isValid(upper)) return upper;
  return iso.getAlpha2Code(value.trim(), 'ru') || iso.getAlpha2Code(value.trim(), 'en') || (/^[A-Z]{3}$/.test(upper) ? iso.alpha3ToAlpha2(upper) : undefined) || null;
}
export function parseFilmCountries(raw: string | null | undefined) {
  const codes = new Set<string>(), unknown = new Set<string>();
  for (const token of (raw || '').split(/[,;|/]+/).map(s => s.trim()).filter(Boolean)) {
    const code = countryCode(token);
    if (code) { codes.add(code); continue; }
    const parts = token.split(/\s+(?:и|and|&)\s+/i);
    const resolved = parts.map(countryCode);
    if (parts.length > 1 && resolved.every(Boolean)) for (const part of resolved) codes.add(part!);
    else unknown.add(token);
  }
  return { codes: [...codes], unknown: [...unknown] };
}
export function countryName(code: string, english = false) { return iso.getName(code, english ? 'en' : 'ru') || code; }
export function allCountryCodes() { return Object.keys(iso.getAlpha2Codes()); }
export function cinemaDensity(count: number) {
  return count <= 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 12 ? 3 : 4;
}
export function buildCountryIndex<T extends { id: number; country: string | null }>(films: readonly T[]) {
  const byCountry = new Map<string, T[]>(), unmapped: T[] = [], unknownTokens = new Set<string>();
  const seen = new Set<number>();
  for (const film of films) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);
    const { codes, unknown } = parseFilmCountries(film.country);
    for (const token of unknown) unknownTokens.add(token);
    if (!codes.length) unmapped.push(film);
    for (const code of codes) {
      const entries = byCountry.get(code) || []; entries.push(film); byCountry.set(code, entries);
    }
  }
  return { byCountry, unmapped, unknownTokens: [...unknownTokens] };
}
