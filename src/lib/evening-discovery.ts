import { matchesCatalogMood, type CatalogMood } from "./catalog-moods";

export const EVENING_MOODS = [
  {
    id: "popcorn",
    ru: "Переключиться",
    en: "Escape the everyday",
    note: "Приключения, комедии и экшен",
    noteEn: "Adventure, comedy and action",
  },
  {
    id: "mind",
    ru: "За гранью",
    en: "Beyond the ordinary",
    note: "Фантастика и загадки",
    noteEn: "Sci-fi and mystery",
  },
  {
    id: "tears",
    ru: "Почувствовать",
    en: "Feel something",
    note: "Истории с эмоциями",
    noteEn: "Stories with emotion",
  },
  {
    id: "grip",
    ru: "На одном дыхании",
    en: "Stay on the edge",
    note: "Триллеры и напряжение",
    noteEn: "Thrillers and suspense",
  },
] as const;

type DiscoveryFilm = {
  id: number;
  title: string;
  genre: string;
  mood?: string | null;
  rating: number;
  ratingCount: number;
};
/** Same explicit editorial/genre rules as the catalog. Never substitutes unrelated titles. */
export function eveningCandidates<T extends DiscoveryFilm>(
  films: readonly T[],
  mood: CatalogMood,
): T[] {
  return films
    .filter((film) => matchesCatalogMood(film, mood))
    .sort(
      (a, b) =>
        b.rating - a.rating || b.ratingCount - a.ratingCount || a.id - b.id,
    );
}
export function eveningCatalogUrl(mood: CatalogMood) {
  return mood === "all"
    ? "/catalog"
    : `/catalog?mood=${encodeURIComponent(mood)}`;
}
