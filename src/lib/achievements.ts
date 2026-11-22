// Metadata is shared by the API and UI so each tier has a single source of truth.
export const achievementDefs = [
  { id: 'watch', icon: '🎬', name: 'Первый кадр', description: 'Отмечай просмотренные истории', targets: [1, 10, 30, 100], unit: 'просмотров', category: 'Просмотры' },
  { id: 'hundred', icon: '💯', name: 'Сотня историй', description: 'Посмотри 100 материалов', targets: [25, 50, 100, 250], unit: 'просмотров', category: 'Просмотры' },
  { id: 'binge', icon: '🔁', name: 'Марафонец', description: 'Смотри кино в разные дни', targets: [2, 7, 30, 100], unit: 'активных дней', category: 'Просмотры' },
  { id: 'night', icon: '🌙', name: 'Ночной сеанс', description: 'Смотри истории после 20:00', targets: [1, 5, 20, 50], unit: 'ночных сеансов', category: 'Просмотры' },
  { id: 'hours', icon: '⏳', name: 'Повелитель времени', description: 'Проводи часы в другом мире', targets: [3, 25, 100, 500], unit: 'часов', category: 'Просмотры' },
  { id: 'weekend', icon: '📅', name: 'Уикенд-синефил', description: 'Посмотри 5 фильмов за выходные', targets: [1, 5, 20, 50], unit: 'выходных сеансов', category: 'Просмотры' },
  { id: 'explorer', icon: '🪐', name: 'Исследователь', description: 'Открывай уникальные истории', targets: [3, 15, 40, 100], unit: 'уникальных историй', category: 'Просмотры' },
  { id: 'speed', icon: '⚡', name: 'Скоростной просмотр', description: 'Посмотри 3 материала за один день', targets: [1, 5, 15, 50], unit: 'таких дней', category: 'Просмотры' },
  { id: 'anime', icon: '🌸', name: 'Путь аниме', description: 'Открывай мир японской анимации', targets: [1, 10, 30, 100], unit: 'аниме', category: 'Жанры' },
  { id: 'cartoon', icon: '🎨', name: 'Мультяшник', description: 'Смотри мультфильмы и мультсериалы', targets: [1, 5, 20, 50], unit: 'мультфильмов', category: 'Жанры' },
  { id: 'series', icon: '📺', name: 'Любитель сериалов', description: 'Смотри сериалы', targets: [1, 5, 15, 50], unit: 'сериалов', category: 'Жанры' },
  { id: 'genre_all', icon: '🎭', name: 'Всеядный зритель', description: 'Посмотри что-то из каждой категории', targets: [1, 2, 4, 6], unit: 'категорий', category: 'Жанры' },
  { id: 'thriller', icon: '😱', name: 'Адреналиновый наркоман', description: 'Смотри триллеры и хорроры', targets: [1, 5, 15, 50], unit: 'триллеров', category: 'Жанры' },
  { id: 'scifi', icon: '🚀', name: 'Космический путешественник', description: 'Открывай фантастические миры', targets: [1, 5, 15, 50], unit: 'фантастик', category: 'Жанры' },
  { id: 'drama', icon: '🎭', name: 'Чувствительная душа', description: 'Переживай драматические истории', targets: [1, 5, 20, 50], unit: 'драм', category: 'Жанры' },
  { id: 'action', icon: '💥', name: 'Экшен-машина', description: 'Смотри боевики и экшены', targets: [1, 5, 15, 50], unit: 'боевиков', category: 'Жанры' },
  { id: 'ratings', icon: '⭐', name: 'Кинокритик', description: 'Делись своими оценками', targets: [1, 10, 30, 100], unit: 'оценок', category: 'Критика' },
  { id: 'perfectionist', icon: '🏆', name: 'Перфекционист', description: 'Поставь несколько оценок 10/10', targets: [1, 3, 10, 25], unit: 'оценок 10/10', category: 'Критика' },
  { id: 'harsh', icon: '🔥', name: 'Суровый критик', description: 'Поставь низкую оценку — быть честным важно', targets: [1, 3, 10, 25], unit: 'низких оценок', category: 'Критика' },
  { id: 'voice', icon: '💬', name: 'Голос зала', description: 'Оставляй комментарии и отзывы', targets: [1, 10, 30, 100], unit: 'комментариев', category: 'Критика' },
  { id: 'popular_comment', icon: '❤️', name: 'Народный любимец', description: 'Получи лайки на комментарии', targets: [1, 10, 50, 200], unit: 'лайков', category: 'Критика' },
  { id: 'social', icon: '🤝', name: 'Душа компании', description: 'Заводи новых друзей', targets: [1, 5, 20, 50], unit: 'друзей', category: 'Социальное' },
  { id: 'collector', icon: '💎', name: 'Коллекционер желаемого', description: 'Добавляй истории, которые хочешь посмотреть позже', targets: [1, 10, 30, 100], unit: 'в желаемом', category: 'Социальное' },
  { id: 'ambassador', icon: '📢', name: 'Посол кино', description: 'Делись рекомендациями с друзьями', targets: [1, 5, 20, 50], unit: 'рекомендаций', category: 'Социальное' },
  { id: 'chatty', icon: '💌', name: 'Болтун', description: 'Общайся с друзьями в чате', targets: [5, 25, 100, 500], unit: 'сообщений', category: 'Социальное' },
  { id: 'player', icon: '🎮', name: 'Игрок', description: 'Играй в кино-игры', targets: [1, 10, 50, 100], unit: 'игр', category: 'Игры' },
  { id: 'champion', icon: '🥇', name: 'Чемпион', description: 'Набирай высокие очки в играх', targets: [1, 5, 20, 50], unit: 'игр с 5/5', category: 'Игры' },
  { id: 'allgames', icon: '🎯', name: 'Коллекционер игр', description: 'Попробуй все игровые режимы', targets: [4, 8, 12, 16], unit: 'режимов', category: 'Игры' },
  { id: 'master', icon: '👑', name: 'Легенда экрана', description: 'Зарабатывай XP в киновселенной', targets: [500, 2000, 5000, 15000], unit: 'XP', category: 'Прогрессия' },
  { id: 'level10', icon: '🔟', name: 'Ветеран', description: 'Достигни 10 уровня', targets: [5, 10, 20, 40], unit: 'уровень', category: 'Прогрессия' },
  { id: 'challenges_done', icon: '🎯', name: 'Мастер испытаний', description: 'Выполни ежемесячные челленджи', targets: [1, 5, 15, 30], unit: 'челленджей', category: 'Прогрессия' },
  { id: 'archaeologist', icon: '🏺', name: 'Археолог', description: 'Посмотри разные фильмы, выпущенные до 1960 года. Повторные просмотры не учитываются.', targets: [1, 5, 20, 50], unit: 'фильмов до 1960 года', category: 'Просмотры' },
  { id: 'serial_completion', icon: '📚', name: 'Серийный маньяк', description: 'Оцени каждый сезон и каждый эпизод сериала минимум с 10 эпизодами. Полноту списка подтверждает редактор. Засчитанные сериалы сохраняются навсегда.', targets: [1, 3, 5, 10], unit: 'полностью оценённых сериалов', category: 'Критика' },
] as const;

export const ACHIEVEMENT_TIERS = ['Бронза', 'Серебро', 'Золото', 'Платина'] as const;

export type AchievementId = (typeof achievementDefs)[number]['id'];
export type AchievementProgress = Record<AchievementId, number>;
