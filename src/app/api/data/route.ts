import { NextResponse } from 'next/server';
import { eq, or, and } from 'drizzle-orm';
import { getUser, publicUser } from '@/lib/auth';
import { collabLists, collabItems, movieClub, challenges, challengeProgress } from '@/db/schema';
import { getOverview, getTitleMinutes, db, users, watches, ratings, comments, bookmarks, friendships, notifications, gameScores, desc } from '@/lib/data';
import { messages } from '@/db/schema';
import type { Film } from '@/lib/data';

// [API:DATA] Live application state plus temporal features.
function consecutiveDays(dates:Date[]){const unique=[...new Set(dates.map(d=>new Date(d).toISOString().slice(0,10)))].sort().reverse();if(!unique.length)return 0;let streak=1;for(let i=1;i<unique.length;i++){const gap=(new Date(unique[i-1]).getTime()-new Date(unique[i]).getTime())/86400000;if(gap!==1)break;streak++;}return streak;}

// [DATA:CINE_DAY] Themed film day based on calendar date
function getCineDay():{label:string;filter?:string;icon:string}{
  const d=new Date();const m=d.getMonth()+1;const day=d.getDate();
  if(m===1&&day===1)return {label:'Фильмы про Новый год',filter:'Приключения',icon:'🎆'};
  if(m===2&&day===14)return {label:'Романтические истории',filter:'Драма',icon:'💕'};
  if(m===5&&day===4)return {label:'Да пребудет с тобой сила — Star Wars Day',filter:'Фантастика',icon:'⚔️'};
  if(m===10&&day===31)return {label:'Хоррор-марафон',filter:'Детектив',icon:'🎃'};
  if(m===12&&day>=20)return {label:'Новогоднее кино',filter:'Приключения',icon:'🎄'};
  const weekday=d.getDay();
  if(weekday===1)return {label:'Понедельник — Фантастика',filter:'Фантастика',icon:'🚀'};
  if(weekday===3)return {label:'Среда — Анимация',filter:'Анимация',icon:'🎨'};
  if(weekday===5)return {label:'Пятница — Боевик',filter:'Боевик',icon:'💥'};
  return {label:'Кино на каждый день',icon:'🎬'};
}

// [DATA:ON_THIS_DAY] Retrospective memories
function getOnThisDay(myWatches:{movieId:number;watchedAt:Date}[],myRatings:{movieId:number;value:number}[],films:Film[],friendEvents:{message:string;createdAt:Date}[]):{text:string;icon:string}[]{
  const today=new Date();const todayMD=`${today.getMonth()+1}-${today.getDate()}`;const items:{text:string;icon:string}[]=[];
  
  for(const w of myWatches){
    const wd=new Date(w.watchedAt);const wMD=`${wd.getMonth()+1}-${wd.getDate()}`;
    if(wMD===todayMD && wd.getFullYear()<today.getFullYear()){
      const diff=today.getFullYear()-wd.getFullYear();const film=films.find(f=>f.id===w.movieId);
      const rating=myRatings.find(r=>r.movieId===w.movieId);
      if(film)items.push({text:`${diff===1?'Ровно год':diff+' года/лет'} назад ты посмотрел(а) «${film.title}»${rating?' и поставил(а) '+rating.value+'/10':''}`,icon:'📅'});
    }
  }
  
  for(const f of films){
    const age=today.getFullYear()-f.year;
    if(age >= 5 && age % 5 === 0) {
       items.push({text:`В этом году ${age} лет исполняется истории «${f.title}»! Самое время вспомнить.`,icon:'🎂'});
    }
  }
  
  if (items.length === 0 && myWatches.length > 3) {
     const randomOldWatch = myWatches[myWatches.length - 1]; // Oldest watch
     const film = films.find(f=>f.id===randomOldWatch.movieId);
     const wd = new Date(randomOldWatch.watchedAt);
     if (film) {
       items.push({text:`А помнишь? ${wd.toLocaleDateString('ru-RU')} ты открыл(а) для себя «${film.title}». Может, стоит освежить память?`, icon:'🕰️'});
     }
  }

  if (items.length < 2 && friendEvents.length > 0) {
      items.push({text: friendEvents[0].message, icon: '👋'});
  }

  return items.slice(0,3);
}

// [DATA:SEASON] Season pass configuration
function getCurrentSeason():{name:string;icon:string;missions:{desc:string;filter?:string;target:number}[];frame:string}{
  const m=new Date().getMonth()+1;
  if(m>=12||m<=2)return {name:'Зимний Season Pass',icon:'❄️',missions:[{desc:'3 новогодних фильма',filter:'Приключения',target:3},{desc:'2 аниме',filter:'Аниме',target:2},{desc:'1 фильм 90-х',target:1}],frame:'snowflake'};
  if(m<=5)return {name:'Весенний Season Pass',icon:'🌸',missions:[{desc:'3 драмы',filter:'Драма',target:3},{desc:'2 комедии',filter:'Комедия',target:2},{desc:'1 фантастика',filter:'Фантастика',target:1}],frame:'bloom'};
  if(m<=8)return {name:'Летний Season Pass',icon:'☀️',missions:[{desc:'4 боевика',filter:'Боевик',target:4},{desc:'2 анимации',filter:'Анимация',target:2},{desc:'2 фантастики',filter:'Фантастика',target:2}],frame:'sun'};
  return {name:'Осенний Season Pass',icon:'🍂',missions:[{desc:'3 детектива',filter:'Детектив',target:3},{desc:'2 биографии',filter:'Биография',target:2},{desc:'1 фэнтези',filter:'Фэнтези',target:1}],frame:'autumn'};
}

export async function GET(){
  try {
    const films=await getOverview(); const me=await getUser();
    const [people,allWatches,allRatings,allComments,allBookmarks,allFriends,allNotifications,allScores,allLists,allCollabItems,activeClubs,allChallenges,allChallengeProgress]=await Promise.all([
      db.select().from(users),db.select().from(watches).orderBy(desc(watches.watchedAt)),db.select().from(ratings),db.select().from(comments).orderBy(desc(comments.createdAt)),db.select().from(bookmarks),db.select().from(friendships),db.select().from(notifications).orderBy(desc(notifications.createdAt)),db.select().from(gameScores),
      db.select().from(collabLists).orderBy(desc(collabLists.createdAt)),
      db.select().from(collabItems),
      db.select().from(movieClub).where(eq(movieClub.active, true)),
      db.select().from(challenges),
      db.select().from(challengeProgress)
    ]);
    const names=Object.fromEntries(people.map(p=>[p.id,{id:p.id,username:p.username,avatar:p.avatar,role:p.role,xp:p.xp,createdAt:p.createdAt}]));

    let friendsActivity: {id:number;username:string;avatar:string|null;watches:number;minutes:number;lastWatch:string|null;commonFilms:number}[] = [];
    let unreadMessages = 0;
    let onThisDay:{text:string;icon:string}[] = [];
    let monthlySummary:{watches:number;minutes:number;topGenre:string;avgRating:string;achievements:number}|null = null;
    const currentMonth=new Date().getMonth()+1;
    const myChallenges = allChallenges.map(c=>{
      const prog=me?allChallengeProgress.find(p=>p.challengeId===c.id&&p.userId===me.id):null;
      return {...c,progress:prog?.progress||0,completed:prog?.completed||false,current:c.month===currentMonth};
    });

    if (me) {
      const acceptedFriends = allFriends.filter(f => f.status === 'accepted' && (f.fromId === me.id || f.toId === me.id));
      const friendIds = acceptedFriends.map(f => f.fromId === me.id ? f.toId : f.fromId);
      const myWatches = allWatches.filter(w=>w.userId===me.id);
      const myRatings = allRatings.filter(r=>r.userId===me.id);
      const myWatchedIds = new Set(myWatches.map(w => w.movieId));

      friendsActivity = friendIds.map(fid => {
        const person = names[fid];
        const fWatches = allWatches.filter(w => w.userId === fid);
        const fMinutes = fWatches.reduce((n, w) => n + (films.find(f => f.id === w.movieId) ? getTitleMinutes(films.find(f => f.id === w.movieId)!) : 0), 0);
        const lastWatch = fWatches.length ? fWatches[0].watchedAt : null;
        const commonFilms = new Set(fWatches.filter(w => myWatchedIds.has(w.movieId)).map(w => w.movieId)).size;
        return { id: fid, username: person?.username || 'User', avatar: person?.avatar || null, watches: fWatches.length, minutes: fMinutes, lastWatch: lastWatch ? new Date(lastWatch).toISOString() : null, commonFilms };
      });

      const unreadMsgs = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.toId, me.id), eq(messages.read, false)));
      unreadMessages = unreadMsgs.length;

      onThisDay = getOnThisDay(myWatches, myRatings, films, allNotifications.filter(n=>n.userId===me.id).map(n=>({message:n.message,createdAt:n.createdAt})));

      // Monthly summary for previous month
      const prevMonth=currentMonth===1?12:currentMonth-1;
      const prevYear=currentMonth===1?new Date().getFullYear()-1:new Date().getFullYear();
      const prevWatches=myWatches.filter(w=>{const d=new Date(w.watchedAt);return d.getMonth()+1===prevMonth&&d.getFullYear()===prevYear;});
      if(prevWatches.length){
        const pMins=prevWatches.reduce((n,w)=>n+(films.find(f=>f.id===w.movieId)?.duration||0),0);
        const gm=new Map<string,number>();prevWatches.forEach(w=>{const f=films.find(x=>x.id===w.movieId);if(f)f.genre.split(',').forEach(g=>gm.set(g.trim(),(gm.get(g.trim())||0)+1))});
        const topG=[...gm.entries()].sort((a,b)=>b[1]-a[1])[0];
        const pRatings=myRatings.filter(r=>prevWatches.some(w=>w.movieId===r.movieId));
        const avgR=pRatings.length?(pRatings.reduce((n,r)=>n+r.value,0)/pRatings.length).toFixed(1):'—';
        monthlySummary={watches:prevWatches.length,minutes:pMins,topGenre:topG?topG[0]:'—',avgRating:avgR,achievements:0};
      }
    }

    const cineDay=getCineDay();
    const season=getCurrentSeason();

    return NextResponse.json({films,user:publicUser(me),people:Object.values(names),watches:me?allWatches.filter(w=>w.userId===me.id):[],ratings:me?allRatings.filter(r=>r.userId===me.id):[],comments:allComments.map(c=>({...c,author:names[c.userId]})),bookmarks:me?allBookmarks.filter(b=>b.userId===me.id):[],friends:me?allFriends.filter(f=>f.fromId===me.id||f.toId===me.id):[],notifications:me?allNotifications.filter(n=>n.userId===me.id):[],scores:me?allScores.filter(s=>s.userId===me.id):[],leaderboard:people.map(p=>({id:p.id,username:p.username,avatar:p.avatar,role:p.role,xp:p.xp,watches:allWatches.filter(w=>w.userId===p.id).length,minutes:allWatches.filter(w=>w.userId===p.id).reduce((n,w)=>n+(films.find(f=>f.id===w.movieId)?getTitleMinutes(films.find(f=>f.id===w.movieId)!):0),0),streak:consecutiveDays(allWatches.filter(w=>w.userId===p.id).map(w=>w.watchedAt)),ratings:allRatings.filter(r=>r.userId===p.id).length,gameScore:allScores.filter(s=>s.userId===p.id).reduce((a,s)=>a+s.score,0)})),friendsActivity,unreadMessages,lists:allLists.map(l=>({...l,items:allCollabItems.filter(i=>i.listId===l.id).map(i=>({...i,film:films.find(f=>f.id===i.movieId)}))})),club:activeClubs.length?activeClubs[0]:null,onThisDay,cineDay,monthlySummary,challenges:myChallenges,season});
  }catch(e){console.error(e);return NextResponse.json({error:'Не удалось загрузить данные'},{status:500});}
}
