import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getUser } from '@/lib/auth';
import { db } from '@/db';
import { collabLists, collabItems, watchRooms } from '@/db/schema';
import { users, movies, watches, ratings, comments, reactions, bookmarks, friendships, notifications, gameScores } from '@/db/schema';

// [API:ACTIONS] Authenticated mutations with role and ownership checks.
export async function POST(req:NextRequest){
  const user=await getUser();if(!user)return NextResponse.json({error:'Войдите в аккаунт, чтобы продолжить'},{status:401});
  try {
    const body=await req.json();const action=String(body.action||'');const movieId=Number(body.movieId);let result:unknown={ok:true};
    const filmActions=['watch','rate','bookmark','comment'];
    if(filmActions.includes(action)){const [film]=await db.select({id:movies.id}).from(movies).where(eq(movies.id,movieId)).limit(1);if(!film)throw Error('Материал не найден');}
    if(action==='watch'){await db.insert(watches).values({userId:user.id,movieId});await db.update(users).set({xp:(user.xp||0)+35}).where(eq(users.id,user.id));}
    else if(action==='rate'){const value=Number(body.value);if(!Number.isFinite(value)||value<0.5||value>10||value*2%1!==0)throw Error('Оценка должна быть от 0.5 до 10 с шагом 0.5');await db.insert(ratings).values({userId:user.id,movieId,value}).onConflictDoUpdate({target:[ratings.userId,ratings.movieId],set:{value}});await db.update(users).set({xp:(user.xp||0)+10}).where(eq(users.id,user.id));}
    else if(action==='bookmark'){const [saved]=await db.select().from(bookmarks).where(and(eq(bookmarks.userId,user.id),eq(bookmarks.movieId,movieId)));if(saved)await db.delete(bookmarks).where(eq(bookmarks.id,saved.id));else await db.insert(bookmarks).values({userId:user.id,movieId});result={ok:true,saved:!saved};}
    else if(action==='comment'){const text=String(body.text||'').trim().slice(0,2000);if(text.length<2)throw Error('Напишите комментарий');let parentId:number|null=null;if(body.parentId){const [parent]=await db.select().from(comments).where(eq(comments.id,Number(body.parentId)));if(!parent||parent.movieId!==movieId)throw Error('Комментарий не найден');parentId=parent.id;if(parent.userId!==user.id)await db.insert(notifications).values({userId:parent.userId,actorId:user.id,message:`${user.username} ответил(а) на ваш комментарий`,link:`/movie/${movieId}`});}await db.insert(comments).values({userId:user.id,movieId,parentId,body:text});await db.update(users).set({xp:(user.xp||0)+15}).where(eq(users.id,user.id));}
    else if(action==='react'){const commentId=Number(body.commentId);const [comment]=await db.select().from(comments).where(eq(comments.id,commentId));if(!comment)throw Error('Комментарий не найден');const [existing]=await db.select().from(reactions).where(and(eq(reactions.commentId,commentId),eq(reactions.userId,user.id)));if(existing){await db.delete(reactions).where(eq(reactions.id,existing.id));await db.update(comments).set({likes:sql`greatest(0, ${comments.likes} - 1)`}).where(eq(comments.id,commentId));}else{await db.insert(reactions).values({userId:user.id,commentId});await db.update(comments).set({likes:sql`${comments.likes} + 1`}).where(eq(comments.id,commentId));if(comment.userId!==user.id)await db.insert(notifications).values({userId:comment.userId,actorId:user.id,message:`${user.username} понравился ваш комментарий`,link:`/movie/${comment.movieId}`});}}
    else if(action==='friend'){const target=Number(body.userId);if(target===user.id)throw Error('Нельзя добавить себя');const [other]=await db.select().from(users).where(eq(users.id,target));if(!other)throw Error('Пользователь не найден');const [existing]=await db.select().from(friendships).where(and(eq(friendships.fromId,user.id),eq(friendships.toId,target)));if(existing)throw Error('Заявка уже отправлена');await db.insert(friendships).values({fromId:user.id,toId:target,status:'pending'});await db.insert(notifications).values({userId:target,actorId:user.id,message:`${user.username} приглашает вас в друзья`,link:'/friends'});}
    else if(action==='friendAccept'){const [request]=await db.select().from(friendships).where(eq(friendships.id,Number(body.id)));if(!request||request.toId!==user.id)throw Error('Заявка не найдена');await db.update(friendships).set({status:'accepted'}).where(eq(friendships.id,request.id));await db.insert(notifications).values({userId:request.fromId,actorId:user.id,message:`${user.username} принял(а) вашу заявку`,link:'/friends'});}
    else if(action==='notifyRead'){await db.update(notifications).set({read:true}).where(eq(notifications.userId,user.id));}
    else if(action==='profile'){const patch:Partial<typeof users.$inferInsert>={};if(typeof body.bio==='string')patch.bio=body.bio.slice(0,240);if(typeof body.username==='string'){const name=body.username.trim();if(name.length<3||name.length>24)throw Error('Имя: от 3 до 24 символов');const [taken]=await db.select().from(users).where(eq(users.username,name));if(taken&&taken.id!==user.id)throw Error('Имя занято');patch.username=name;}if(['dark','light','pink','purple','yellow'].includes(body.theme))patch.theme=body.theme;if(['ru','en'].includes(body.language))patch.language=body.language;if(Number(body.headerStyle)>=1&&Number(body.headerStyle)<=5){const style=Number(body.headerStyle);if((style===4&&(user.xp||0)<1000)||(style===5&&(user.xp||0)<2000))throw Error('Этот стиль откроется с новым уровнем');patch.headerStyle=style;}const frameCost:Record<string,number>={none:0,gold:500,neon:1500,violet:2500,sakura:800,fire:1200,ice:1800,rainbow:3000,cyberpunk:2000,blood:1600,emerald:900,sunset:1100,diamond:3500,galaxy:2800,glitch:2200,anime:1400};if(typeof body.avatarFrame==='string'&&body.avatarFrame in frameCost){if((user.xp||0)<frameCost[body.avatarFrame])throw Error(`Нужно ${frameCost[body.avatarFrame]} XP`);patch.avatarFrame=body.avatarFrame;}if(typeof body.headerFrame==='string'&&body.headerFrame in frameCost){if((user.xp||0)<frameCost[body.headerFrame])throw Error(`Нужно ${frameCost[body.headerFrame]} XP`);patch.headerFrame=body.headerFrame;}
      const effectCost:Record<string,number>={none:0,particles:600,rain:800,fireflies:1000,snow:700,stars:900,aurora:1500,matrix:2000,cinema:1200,spotlight:1400};if(typeof body.profileEffect==='string'&&body.profileEffect in effectCost){if((user.xp||0)<effectCost[body.profileEffect])throw Error(`Нужно ${effectCost[body.profileEffect]} XP`);patch.profileEffect=body.profileEffect;}
      const nameEffects=['none','glow','typewriter','gradient','shake','rainbow','neon-flicker','fire-text','ice-text','glitch-text'];if(typeof body.nameEffect==='string'&&nameEffects.includes(body.nameEffect)){const neCost:Record<string,number>={none:0,glow:300,typewriter:400,gradient:500,shake:600,rainbow:1000,['neon-flicker']:800,['fire-text']:1200,['ice-text']:1100,['glitch-text']:1500};if((user.xp||0)<(neCost[body.nameEffect]||0))throw Error(`Нужно ${neCost[body.nameEffect]||0} XP`);patch.nameEffect=body.nameEffect;}
      const nameColors=['default','gold','rose','cyan','lime','orange','purple-pink','fire-gradient','ocean-gradient','aurora-gradient'];if(typeof body.nameColor==='string'&&nameColors.includes(body.nameColor)){const ncCost:Record<string,number>={default:0,gold:200,rose:200,cyan:300,lime:300,orange:400,['purple-pink']:600,['fire-gradient']:800,['ocean-gradient']:900,['aurora-gradient']:1200};if((user.xp||0)<(ncCost[body.nameColor]||0))throw Error(`Нужно ${ncCost[body.nameColor]||0} XP`);patch.nameColor=body.nameColor;}if(typeof body.tileOrder==='string')patch.tileOrder=body.tileOrder.slice(0,150);await db.update(users).set(patch).where(eq(users.id,user.id));}
    else if(action==='game'){const score=Number(body.score);const game=String(body.game||'').slice(0,50);if(!Number.isInteger(score)||score<0||score>100||!game)throw Error('Некорректный результат');await db.insert(gameScores).values({userId:user.id,game,score});await db.update(users).set({xp:(user.xp||0)+Math.min(score*10,100)}).where(eq(users.id,user.id));}
    else if(action==='share'){const target=Number(body.userId);const [film]=await db.select().from(movies).where(eq(movies.id,movieId));if(!film)throw Error('Материал не найден');const [friend]=await db.select().from(users).where(eq(users.id,target));if(!friend)throw Error('Пользователь не найден');await db.insert(notifications).values({userId:target,actorId:user.id,message:`${user.username} рекомендует вам «${film.title}»`,link:`/movie/${movieId}`});}
    else if(action==='movieSave'){if(!['admin','moderator'].includes(user.role))return NextResponse.json({error:'Недостаточно прав'},{status:403});const title=String(body.title||'').trim(),description=String(body.description||'').trim();if(!title||!description||!body.poster||!body.category)throw Error('Заполните название, описание, категорию и обложку');const input={title:title.slice(0,150),originalTitle:String(body.originalTitle||''),description:description.slice(0,3000),category:String(body.category),genre:String(body.genre||''),year:Number(body.year)||2024,duration:Number(body.duration)||90,poster:String(body.poster),backdrop:String(body.backdrop||''),watchUrl:String(body.watchUrl||''),director:String(body.director||''),country:String(body.country||'')};if(body.id){await db.update(movies).set(input).where(eq(movies.id,Number(body.id)));}else{await db.insert(movies).values(input);} }
    
    else if(action==='questComplete'){
      const questId=String(body.questId);
      const xpReward=Number(body.xp);
      let quests: Record<string, boolean> = {};
      try{quests=JSON.parse(user.quests||'{}')}catch{}
      const today = new Date().toISOString().slice(0,10);
      if(user.lastQuestDate!==today){quests={};}
      if(!quests[questId]){
        quests[questId]=true;
        await db.update(users).set({quests:JSON.stringify(quests), lastQuestDate:today, xp:(user.xp||0)+xpReward}).where(eq(users.id,user.id));
      }
    }
    else if(action==='createList'){
      const title=String(body.title).trim();
      if(title) await db.insert(collabLists).values({title, ownerId:user.id});
    }
    else if(action==='addToList'){
      const listId=Number(body.listId);
      const [existing]=await db.select().from(collabItems).where(and(eq(collabItems.listId,listId),eq(collabItems.movieId,movieId)));
      if(!existing) await db.insert(collabItems).values({listId, movieId, addedById:user.id});
    }
    else if(action==='voteList'){
      const itemId=Number(body.itemId);
      await db.update(collabItems).set({votes:sql`${collabItems.votes} + 1`}).where(eq(collabItems.id,itemId));
    }
    else if(action==='movieDelete'){if(user.role!=='admin')return NextResponse.json({error:'Недостаточно прав'},{status:403});const id=Number(body.id);const movieComments=await db.select({id:comments.id}).from(comments).where(eq(comments.movieId,id));for(const c of movieComments)await db.delete(reactions).where(eq(reactions.commentId,c.id));await db.delete(comments).where(eq(comments.movieId,id));await db.delete(ratings).where(eq(ratings.movieId,id));await db.delete(watches).where(eq(watches.movieId,id));await db.delete(bookmarks).where(eq(bookmarks.movieId,id));await db.delete(movies).where(eq(movies.id,id));}
    else if(action==='role'){if(user.role!=='admin')return NextResponse.json({error:'Недостаточно прав'},{status:403});const role=String(body.role);if(!['visitor','vip','moderator','admin'].includes(role))throw Error('Неверная роль');if(Number(body.userId)===user.id)throw Error('Нельзя изменить свою роль');await db.update(users).set({role}).where(eq(users.id,Number(body.userId)));}
    else throw Error('Неизвестное действие');
    return NextResponse.json(result);
  }catch(e){console.error(e);return NextResponse.json({error:e instanceof Error?e.message:'Ошибка сервера'},{status:400});}
}
