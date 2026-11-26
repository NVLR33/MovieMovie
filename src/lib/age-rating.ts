export type AgeRatingTone =
  'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'unknown';

/** Age classifications have their own scale; they do not inherit the movie's score. */
export function ageRatingTone(value?: string | null): AgeRatingTone {
  const age = String(value || '').trim();
  if (!/^\d{1,2}\+$/.test(age)) return 'unknown';
  const number = Number(age.slice(0, -1));
  if (number > 21) return 'unknown';
  return number <= 6
    ? 'green'
    : number <= 12
      ? 'blue'
      : number <= 15
        ? 'yellow'
        : number <= 17
          ? 'orange'
          : 'red';
}
