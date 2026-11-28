export const CINEMA_YEAR_CHAPTERS = [
  { title: "Пролог", note: "Это было кино", icon: "intro" },
  { title: "Время", note: "Часы в других мирах", icon: "time" },
  { title: "Истории", note: "Твоя коллекция впечатлений", icon: "watches" },
  { title: "Жанры", note: "Что тебя увлекало", icon: "genres" },
  { title: "Оценки", note: "Твой зрительский почерк", icon: "ratings" },
  { title: "Выбор года", note: "Материал с высшей оценкой", icon: "best" },
  { title: "Ритм года", note: "Двенадцать месяцев в кино", icon: "months" },
  { title: "Челленджи", note: "Завершённые задания", icon: "challenges" },
  { title: "Титры", note: "Карточка твоего киногода", icon: "final" },
] as const;
export function cinemaYears(current: number) {
  return Array.from(
    { length: Math.max(0, current - 1999) },
    (_, index) => current - index,
  );
}
export function cinemaYearStep(step: number) {
  return Number.isFinite(step)
    ? Math.max(0, Math.min(CINEMA_YEAR_CHAPTERS.length - 1, Math.floor(step)))
    : 0;
}
export function cinemaYearCard(
  step: number,
): "summary" | "time" | "genre" | "movie" | "achievements" {
  switch (cinemaYearStep(step)) {
    case 1:
      return "time";
    case 3:
      return "genre";
    case 5:
      return "movie";
    case 7:
      return "achievements";
    default:
      return "summary";
  }
}
