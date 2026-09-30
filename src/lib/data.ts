import { db } from '@/db';
import { users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// [DATA:SEED] Idempotent starter library and demo accounts.
export async function ensureSeed() {
  const existing = await db.select({ id: movies.id }).from(movies).limit(1);
  if (existing.length) return;
  const entries = [
    { title:'Дюна: Часть вторая', originalTitle:'Dune: Part Two', description:'Пол Атрейдес объединяется с Чани и фременами, чтобы отомстить заговорщикам, уничтожившим его семью. Перед ним выбор между любовью всей жизни и судьбой известной ему вселенной.', category:'Фильм', genre:'Фантастика, Приключения, Драма', year:2024, duration:166, poster:'/posters/dune.jpg', backdrop:'/posters/dune-backdrop.jpg', director:'Дени Вильнёв', country:'США, Канада', watchUrl:'https://www.justwatch.com/ru/фильм/диуна-часть-вторая', featured:true, views:1248 },
    { title:'Оппенгеймер', originalTitle:'Oppenheimer', description:'История американского физика Роберта Оппенгеймера и его роли в создании атомной бомбы. Грандиозная драма о выборе, который изменил мир.', category:'Фильм', genre:'Биография, Драма, История', year:2023, duration:180, poster:'/posters/oppenheimer.jpg', director:'Кристофер Нолан', country:'США, Великобритания', watchUrl:'https://www.justwatch.com/ru/фильм/oppengeimer', views:978 },
    { title:'Интерстеллар', originalTitle:'Interstellar', description:'Когда засуха ставит человечество на грань вымирания, группа исследователей отправляется сквозь червоточину на поиски нового дома.', category:'Фильм', genre:'Фантастика, Драма, Приключения', year:2014, duration:169, poster:'/posters/interstellar.jpg', director:'Кристофер Нолан', country:'США', watchUrl:'https://www.justwatch.com/ru/фильм/interstellar', views:2650 },
    { title:'Человек-паук: Паутина вселенных', originalTitle:'Spider-Man: Across the Spider-Verse', description:'Майлз Моралес отправляется в путешествие по мультивселенной, где встречает команду Людей-пауков и должен решить, каким героем стать.', category:'Мультфильм', genre:'Анимация, Боевик, Приключения', year:2023, duration:140, poster:'/posters/spider.jpg', director:'Жуакин Душ Сантуш', country:'США', watchUrl:'https://www.justwatch.com/ru/фильм/spider-man-across-the-spider-verse', views:1045 },
    { title:'Бедные-несчастные', originalTitle:'Poor Things', description:'Невероятная история Беллы Бакстер, возвращённой к жизни эксцентричным учёным. Свободная от предрассудков, она отправляется познавать мир.', category:'Фильм', genre:'Драма, Фантастика, Комедия', year:2023, duration:141, poster:'/posters/poor-lives.jpg', director:'Йоргос Лантимос', country:'Великобритания', watchUrl:'https://www.justwatch.com/ru/фильм/poor-things', views:687 },
    { title:'Всё везде и сразу', originalTitle:'Everything Everywhere All at Once', description:'Обычная владелица прачечной оказывается единственной, кто может спасти мультивселенную от таинственной угрозы.', category:'Фильм', genre:'Фантастика, Приключения, Комедия', year:2022, duration:139, poster:'/posters/everything.jpg', director:'Дэниелы', country:'США', watchUrl:'https://www.justwatch.com/ru/фильм/everything-everywhere-all-at-once', views:1356 },
    { title:'Бэтмен', originalTitle:'The Batman', description:'На втором году борьбы с преступностью Бэтмен расследует серию загадочных убийств, выводящих его на след коррупции в Готэме.', category:'Фильм', genre:'Детектив, Боевик, Драма', year:2022, duration:176, poster:'/posters/batman.jpg', director:'Мэтт Ривз', country:'США', watchUrl:'https://www.justwatch.com/ru/фильм/the-batman', views:1750 },
    { title:'Одержимость', originalTitle:'Whiplash', description:'Молодой барабанщик мечтает стать великим и попадает под опеку дирижёра, чьи методы толкают его за пределы возможного.', category:'Фильм', genre:'Драма, Музыка', year:2014, duration:107, poster:'/posters/whiplash.jpg', director:'Дэмьен Шазелл', country:'США', watchUrl:'https://www.justwatch.com/ru/фильм/whiplash', views:889 },
    { title:'Унесённые призраками', originalTitle:'Spirited Away', description:'Десятилетняя Тихиро попадает в загадочный мир духов и должна найти способ спасти родителей и вернуться домой.', category:'Аниме-фильм', genre:'Аниме, Фэнтези, Приключения', year:2001, duration:125, poster:'/posters/spirited.jpg', director:'Хаяо Миядзаки', country:'Япония', watchUrl:'https://www.justwatch.com/ru/фильм/unesennye-prizrakami', views:1845 },
    { title:'Аркейн', originalTitle:'Arcane', description:'На фоне ожесточённого конфликта между двумя городами сёстры Вай и Джинкс оказываются по разные стороны баррикад.', category:'Мультсериал', genre:'Анимация, Фантастика, Драма', year:2021, duration:40, poster:'/posters/arcane.jpg', director:'Паскаль Шаррю', country:'США, Франция', watchUrl:'https://www.justwatch.com/ru/сериал/arcane', views:2121 },
    { title:'Атака титанов', originalTitle:'Attack on Titan', description:'Люди укрылись за огромными стенами от титанов. Эрен и его друзья вступают в борьбу за свободу человечества.', category:'Аниме-сериал', genre:'Аниме, Боевик, Фэнтези', year:2013, duration:24, poster:'/posters/attack.jpg', director:'Тэцуро Араки', country:'Япония', watchUrl:'https://www.justwatch.com/ru/сериал/attack-on-titan', views:1990 },
    { title:'Одни из нас', originalTitle:'The Last of Us', description:'Через двадцать лет после катастрофы Джоэл берётся провести Элли через руины цивилизации. Их путь изменит всё.', category:'Сериал', genre:'Драма, Фантастика, Приключения', year:2023, duration:55, poster:'/posters/last-of-us.jpg', director:'Крейг Мейзин', country:'США', watchUrl:'https://www.justwatch.com/ru/сериал/the-last-of-us', views:1443 },
  ];
  const inserted = await db.insert(movies).values(entries).returning();
  const hash = await bcrypt.hash('Demo12345!', 10);
  const people = await db.insert(users).values([
    { email:'demo@moviego.ru', username:'cinephile', passwordHash:hash, role:'admin', bio:'Коллекционирую моменты, а не вещи. Здесь моя маленькая киновселенная.', xp:2450, headerStyle:1, avatarFrame:'gold' },
    { email:'luna@moviego.ru', username:'lunafilm', passwordHash:hash, role:'vip', xp:1890, bio:'Смотрю кино между закатами.' },
    { email:'max@moviego.ru', username:'maxframes', passwordHash:hash, role:'visitor', xp:1320 },
    { email:'alice@moviego.ru', username:'aliceinfilm', passwordHash:hash, role:'visitor', xp:980 },
    { email:'neo@moviego.ru', username:'neonight', passwordHash:hash, role:'moderator', xp:760 }
  ]).returning();
  const base = Date.now();
  await db.insert(watches).values(Array.from({length:39}, (_,i) => ({ userId:people[i%5].id, movieId:inserted[(i*7)%inserted.length].id, watchedAt:new Date(base - (i%19)*86400000) })));
  await db.insert(ratings).values(inserted.flatMap((m,i) => people.slice(0,4).map((p,j) => ({userId:p.id,movieId:m.id,value:Math.min(10, Math.max(5.5, [9.5,9,9.5,9,8,8.5,8.5,9,9.5,9,8.5,8][i] + ((j%3)-1)*0.5))}))));
  await db.insert(comments).values([{userId:people[1].id,movieId:inserted[0].id,body:'Визуальный шедевр. Каждая сцена — как отдельное произведение искусства. ✨',likes:12},{userId:people[2].id,movieId:inserted[0].id,body:'Звук в кинотеатре просто невероятный. Ханс Циммер снова сделал магию!',likes:8}]);
  await db.insert(notifications).values([{userId:people[0].id,actorId:people[1].id,message:'lunafilm приглашает вас в друзья',link:'/friends'},{userId:people[0].id,actorId:people[2].id,message:'maxframes оценил вашу рецензию',link:'/profile'}]);
  await db.insert(friendships).values({fromId:people[1].id,toId:people[0].id,status:'pending'});
}

// [DATA:READ] Shared overview query for server-rendered shell.
export async function getOverview() {
  await ensureSeed();
  const [films, scores] = await Promise.all([
    db.select().from(movies).orderBy(desc(movies.createdAt)),
    db.select({movieId:ratings.movieId, average:sql<number>`round(avg(${ratings.value})::numeric, 1)`, count:sql<number>`count(*)::int`}).from(ratings).groupBy(ratings.movieId)
  ]);
  return films.map(m => ({...m, rating:Number(scores.find(s=>s.movieId===m.id)?.average || 0)}));
}
export type Film = Awaited<ReturnType<typeof getOverview>>[number];
export { db, users, movies, watches, ratings, comments, bookmarks, friendships, notifications, gameScores, eq, desc, sql };
