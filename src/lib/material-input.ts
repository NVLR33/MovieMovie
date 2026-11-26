import { playbackUrl } from './playback-source';
import { trailerUrl } from './trailers';
import { imageUrl } from './image-storage';
import { RequestError } from './request-validation';
import { parseCatalogMood } from './catalog-moods';

export const MATERIAL_CATEGORIES = ['Фильм', 'Сериал', 'Мультфильм', 'Мультсериал', 'Аниме-сериал', 'Аниме-фильм'] as const;
const text = (body: Record<string, unknown>, key: string, max: number) => {
  const value = body[key];
  if (value !== undefined && value !== null && typeof value !== 'string') throw new RequestError(`Некорректное поле: ${key}`);
  const result = (value as string | null | undefined)?.trim() || '';
  if (result.length > max) throw new RequestError(`Слишком длинное поле: ${key} (максимум ${max})`);
  return result;
};
const integer = (value: unknown, min: number, max: number, label: string) => {
  const n = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw new RequestError(label);
  return n;
};
/** One allowlisted material contract for curator creation, suggestions and approval. */
export function parseMaterialInput(body: Record<string, unknown>) {
  const title = text(body, 'title', 150), description = text(body, 'description', 3000), category = text(body, 'category', 50);
  if (title.length < 2 || !description || !body.poster || !category) throw new RequestError('Заполните название (от 2 символов), описание, категорию и обложку');
  if (!(MATERIAL_CATEGORIES as readonly string[]).includes(category)) throw new RequestError('Неизвестная категория');
  const year = integer(body.year, 1888, 2100, 'Укажите корректный год выпуска');
  const series = category.includes('сериал') || category === 'Сериал';
  const ongoing = series && body.ongoing === true;
  const endYear = series && !ongoing && body.endYear !== '' && body.endYear != null ? integer(body.endYear, year, 2100, 'Укажите корректный год окончания сериала') : null;
  const duration = integer(body.duration === undefined || body.duration === '' ? 90 : body.duration, 1, 10000, 'Некорректная длительность');
  const episodes = series && body.episodes !== '' && body.episodes != null && body.episodes !== 0 && body.episodes !== '0' ? integer(body.episodes, 1, 100000, 'Некорректное количество серий') : null;
  const ageRating = text(body, 'ageRating', 3);
  if (ageRating && (!/^\d{1,2}\+$/.test(ageRating) || Number(ageRating.slice(0, -1)) > 21)) throw new RequestError('Некорректный возрастной рейтинг');
  const watchUrl = text(body, 'watchUrl', 4096);
  if (watchUrl) {
    try { const url = new URL(watchUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error(); }
    catch { throw new RequestError('Ссылка просмотра должна начинаться с HTTP(S) и не содержать пароль'); }
  }
  let playback = '';
  try { playback = playbackUrl(text(body, 'playbackUrl', 4096)); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'Некорректный источник просмотра'); }
  let trailer = '';
  try { trailer = trailerUrl(text(body, 'trailerUrl', 4096)); } catch (error) { throw new RequestError(error instanceof Error ? error.message : 'Некорректный трейлер'); }
  const mood = text(body, 'mood', 50);
  if (mood && parseCatalogMood(mood) === 'all') throw new RequestError('Неизвестное настроение');
  return {
    title, description, category, year, endYear, ongoing, duration, episodes, ageRating: ageRating || null,
    genre: text(body, 'genre', 200), originalTitle: text(body, 'originalTitle', 200), studio: text(body, 'studio', 300),
    director: text(body, 'director', 300), cast: text(body, 'cast', 4000), country: text(body, 'country', 300),
    franchise: text(body, 'franchise', 150), festivalRecognized: body.festivalRecognized === true,
    mood: mood ? parseCatalogMood(mood)! : '', poster: imageUrl(body.poster, true), backdrop: imageUrl(body.backdrop), watchUrl, playbackUrl: playback, trailerUrl: trailer,
  };
}
export type MaterialInput = ReturnType<typeof parseMaterialInput>;
export function materialIdentity(material: { title: string; year: number; category: string }) {
  return `${material.title.trim().toLowerCase()}:${material.year}:${material.category}`;
}
