# MovieMovie

Кинокаталог и сообщество: профили, оценки и отзывы, достижения, сезоны/эпизоды,
кино-карта мира, питомец и экономика попкорна. Next.js / React / PostgreSQL / Drizzle.

## Локальный запуск

```sh
npm ci
cp .env.example .env # заполнить серверные переменные локально, не коммитить секреты
npm run dev -- --hostname 0.0.0.0
```

Нужны PostgreSQL `DATABASE_URL` и `SESSION_SECRET`. Для **пустой** БД:
`npx tsx scripts/setup-db.ts`, затем `npm run db:migrate`. Не запускайте setup-db
вместо контролируемых миграций на production. Автоматическое заполнение каталога отключено.

## База и Supabase

- [Готовый единый SQL для существующей БД](scripts/supabase/01-upgrade.sql)
- [Полная инструкция и GitHub Actions](scripts/supabase/README.md)
- [Проверка всех систем: что хранится и что меняется](docs/database-systems-audit.md)

Перед выкладкой: backup → миграции → проверки → приложение. Обычный push не меняет БД.
Пароли/ключи задаются только через env/secret-хранилище, не через исходники или чат.

## Проверки

```sh
npm test
npm run test:live   # SSE, чат, URL-only и Storage на локальных адаптерах
npm run test:suggestions # полный цикл предложений и атомарная модерация на изолированной БД
npm run test:wallet # настоящие API + изолированная локальная PGlite, без рабочей БД
npm run typecheck
npm run lint
npm run build      # требует DATABASE_URL окружения
```

## Документация функций

- [Достижения и сериалы](docs/achievements.md)
- [Кино-Эволюция и карта](docs/cinema-evolution-and-world.md)
- [Правила экономики попкорна](docs/popcorn-economy.md)
- [Оценка идей и roadmap](docs/product-roadmap.md)
- [Источник и лицензия геометрии карты](docs/world-map-attribution.md)

- [SSE, компактный интерфейс и перенос изображений](docs/live-ui-storage.md)
- [Настроения, шторка отзывов, умная шапка и микро-взаимодействия](docs/contextual-cinema-ui.md)

- [Полноценная предложка и очередь модерации](docs/movie-suggestions.md)

- [Новая админ-панель, независимый редактор, блокировки и журнал](docs/admin-workspace.md)
