import type { Film } from "./data";

export const gameModes = [
  {
    id: "story",
    icon: "📖",
    name: "Угадай по сюжету",
    description: "Узнай фильм по описанию истории",
    color: "violet",
  },
  {
    id: "year",
    icon: "📅",
    name: "Год премьеры",
    description: "В каком году это вышло?",
    color: "amber",
  },
  {
    id: "director",
    icon: "🎥",
    name: "Кто режиссёр?",
    description: "Угадай автора за кадром",
    color: "blue",
  },
  {
    id: "genre",
    icon: "🎭",
    name: "Жанровый детектив",
    description: "Подбери правильный жанр",
    color: "pink",
  },
  {
    id: "poster",
    icon: "🖼️",
    name: "Угадай по постеру",
    description: "Узнай кино по обложке",
    color: "green",
  },
  {
    id: "duration",
    icon: "⏱️",
    name: "Хронометраж",
    description: "Сколько идёт эта история?",
    color: "amber",
  },
  {
    id: "country",
    icon: "🌎",
    name: "Карта кино",
    description: "Угадай страну производства",
    color: "blue",
  },
  {
    id: "original",
    icon: "🔤",
    name: "Оригинальное имя",
    description: "Как называется фильм в оригинале?",
    color: "violet",
  },
  {
    id: "category",
    icon: "🎞️",
    name: "Тип истории",
    description: "Фильм, сериал или аниме?",
    color: "pink",
  },
  {
    id: "higher",
    icon: "🏆",
    name: "Рейтинговая битва",
    description: "У кого оценка выше?",
    color: "green",
  },
  {
    id: "wordle",
    icon: "🟩",
    name: "Кино-Вордли",
    description: "Выбери название по буквенной подсказке",
    color: "green",
  },
  {
    id: "hangman",
    icon: "🔡",
    name: "Кино-Поле Чудес",
    description: "Угадай название по буквам",
    color: "amber",
  },
  {
    id: "anagram",
    icon: "🔀",
    name: "Кино-Анаграмма",
    description: "Собери буквы названия в правильном порядке",
    color: "violet",
  },
  {
    id: "truths",
    icon: "🤥",
    name: "Две правды, одна ложь",
    description: "Найди ложный факт о фильме",
    color: "pink",
  },
  {
    id: "chrono",
    icon: "⏳",
    name: "Хроно-Слайдер",
    description: "Выбери самый ранний фильм",
    color: "blue",
  },
  {
    id: "connections",
    icon: "🧩",
    name: "Кино-Связи",
    description: "Найди лишний фильм по жанру",
    color: "green",
  },
];

export type PracticeQuestion = {
  movieId: number;
  question: string;
  correct: string;
  options: string[];
  poster?: string;
};
export type PracticeMode = (typeof gameModes)[number]["id"];
function shuffled<T>(items: readonly T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const masked = (title: string) =>
  [...title]
    .map((char, i) => (/[а-яёa-z]/i.test(char) && i % 3 !== 0 ? "_" : char))
    .join("");
const letterClue = (title: string) =>
  `${[...title].length} знаков, первая буква «${title.trim()[0]}»`;
const signature = (title: string) =>
  [...title.toLocaleLowerCase()].sort().join("");
const tokens = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim().toLocaleLowerCase())
    .filter(Boolean);
/** Every question has exactly four distinct answers grounded in catalog data. */
export function buildPracticeRound(
  films: readonly Film[],
  mode: string,
  random: () => number = Math.random,
): PracticeQuestion[] {
  const usable = [...new Map(films.map((f) => [f.id, f])).values()];
  if (
    new Set(usable.map((f) => f.title.trim().toLocaleLowerCase())).size < 4 ||
    !gameModes.some((g) => g.id === mode)
  )
    return [];
  const uniqueTitles = (items: readonly Film[]) => [
    ...new Map(items.map((f) => [f.title, f])).values(),
  ];
  const pool = (
    field: (f: Film) => string,
    current: Film,
    reject: (value: string) => boolean = () => false,
  ) => {
    const correct = field(current).trim();
    if (!correct) return [];
    const values = [
      ...new Map(
        usable
          .map(field)
          .map((v) => v.trim())
          .filter(
            (v) =>
              v &&
              v.toLocaleLowerCase() !== correct.toLocaleLowerCase() &&
              !reject(v),
          )
          .map((v) => [v.toLocaleLowerCase(), v]),
      ).values(),
    ];
    const rest = shuffled(values, random).slice(0, 3);
    return rest.length === 3 ? shuffled([correct, ...rest], random) : [];
  };
  const result: PracticeQuestion[] = [];
  for (const f of shuffled(usable, random)) {
    let question = "",
      correct = "",
      options: string[] = [],
      poster: string | undefined;
    switch (mode) {
      case "story": {
        if (!f.description.trim()) continue;
        question = `Какая история скрывается за описанием? «${f.description.slice(0, 160)}»`;
        correct = f.title;
        // Build exclusions once per question, not with a nested full-catalog scan per option.
        const sameClue = new Set(
          usable
            .filter(
              (x) =>
                x.description.slice(0, 160) === f.description.slice(0, 160),
            )
            .map((x) => x.title.trim().toLocaleLowerCase()),
        );
        options = pool(
          (x) => x.title,
          f,
          (value) => sameClue.has(value.toLocaleLowerCase()),
        );
        break;
      }
      case "year":
        if (!Number.isFinite(f.year) || f.year <= 0) continue;
        question = `В каком году вышло «${f.title}»?`;
        correct = String(f.year);
        options = pool((x) => String(x.year), f);
        break;
      case "director":
        question = `Кто указан режиссёром «${f.title}»?`;
        correct = f.director?.trim() || "";
        options = pool((x) => x.director || "", f);
        break;
      case "genre":
        question = `Какой жанр есть у «${f.title}»?`;
        correct = f.genre.split(",")[0].trim();
        options = pool(
          (x) => x.genre.split(",")[0].trim(),
          f,
          (v) => tokens(f.genre).includes(v.toLocaleLowerCase()),
        );
        break;
      case "poster":
        if (!f.poster) continue;
        question = "Как называется этот фильм?";
        correct = f.title;
        options = pool((x) => x.title, f);
        poster = f.poster;
        break;
      case "duration":
        if (!Number.isFinite(f.duration) || f.duration <= 0) continue;
        question = `Какой хронометраж указан у «${f.title}»?`;
        correct = `${f.duration} мин`;
        options = pool((x) => `${x.duration} мин`, f);
        break;
      case "country":
        question = `Какая страна указана в карточке «${f.title}»?`;
        correct = f.country?.trim() || "";
        options = pool((x) => x.country || "", f);
        break;
      case "original":
        question = `Как звучит оригинальное название «${f.title}»?`;
        correct = f.originalTitle?.trim() || "";
        options = pool((x) => x.originalTitle || "", f);
        break;
      case "category":
        question = `К какой категории относится «${f.title}»?`;
        correct = f.category;
        options = pool((x) => x.category, f);
        break;
      case "wordle":
        question = `Угадай название: ${letterClue(f.title)}`;
        correct = f.title;
        options = pool(
          (x) => x.title,
          f,
          (v) => letterClue(v) === letterClue(f.title),
        );
        break;
      case "hangman":
        question = `Угадай: ${masked(f.title)} (${f.category}, ${f.year})`;
        correct = f.title;
        options = pool(
          (x) => x.title,
          f,
          (v) => masked(v) === masked(f.title),
        );
        break;
      case "anagram":
        question = `Собери название: «${shuffled(f.title.split(""), random).join("")}» (${f.category})`;
        correct = f.title;
        options = pool(
          (x) => x.title,
          f,
          (v) => signature(v) === signature(f.title),
        );
        break;
      case "truths":
        if (f.year <= 0 || f.duration <= 0 || !f.category.trim()) continue;
        correct = `Год выпуска — ${f.year + 1}`;
        question = `Найди ЛОЖЬ о «${f.title}»:`;
        options = shuffled(
          [
            `Год выпуска — ${f.year}`,
            `Категория — ${f.category}`,
            `Хронометраж в карточке — ${f.duration} мин`,
            correct,
          ],
          random,
        );
        break;
      case "chrono": {
        const others = shuffled(
          uniqueTitles(
            usable.filter((x) => x.year > f.year && x.title !== f.title),
          ),
          random,
        ).slice(0, 3);
        if (others.length < 3) continue;
        question = "Какой из этих фильмов вышел раньше всех?";
        correct = f.title;
        options = shuffled(
          [f, ...others].map((x) => x.title),
          random,
        );
        break;
      }
      case "higher": {
        if (!f.ratingCount) continue;
        const others = shuffled(
          uniqueTitles(
            usable.filter(
              (x) =>
                x.ratingCount > 0 && x.rating < f.rating && x.title !== f.title,
            ),
          ),
          random,
        ).slice(0, 3);
        if (others.length < 3) continue;
        question = "Какую историю зрители каталога оценили выше?";
        correct = f.title;
        options = shuffled(
          [f, ...others].map((x) => x.title),
          random,
        );
        break;
      }
      case "connections": {
        const genre = tokens(f.genre)[0];
        if (!genre) continue;
        const matching = shuffled(
          uniqueTitles(usable.filter((x) => tokens(x.genre).includes(genre))),
          random,
        ).slice(0, 3);
        const outsider = shuffled(
          usable.filter(
            (x) =>
              !tokens(x.genre).includes(genre) &&
              !matching.some((m) => m.title === x.title),
          ),
          random,
        )[0];
        if (matching.length < 3 || !outsider) continue;
        question = `Какой фильм НЕ связан общим жанром «${f.genre.split(",")[0].trim()}»?`;
        correct = outsider.title;
        options = shuffled([...matching.map((x) => x.title), correct], random);
        break;
      }
    }
    if (correct && new Set(options).size === 4 && options.includes(correct))
      result.push({ movieId: f.id, question, correct, options, poster });
    if (result.length === 5) break;
  }
  return result.length
    ? Array.from({ length: 5 }, (_, index) => result[index % result.length])
    : [];
}
