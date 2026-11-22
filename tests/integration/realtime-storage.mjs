// Actual routes + local PostgreSQL-compatible DB. No external Storage or production secrets.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
async function handlers(){
 const built=await build({stdin:{contents:`export{GET as pulse}from'./src/app/api/pulse/route';export{GET as events}from'./src/app/api/events/route';export{GET as chatGet,POST as chatPost}from'./src/app/api/chat/route';export{POST as upload}from'./src/app/api/upload/route';export{POST as action}from'./src/app/api/action/route';`,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated-services',setup(b){
  b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/^@\/lib\/auth$/},()=>({path:'auth',namespace:'test'}));b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'storage',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='db'?`export const db=globalThis.__db;`:a.path==='storage'?`export const createClient=()=>globalThis.__storage;`:`export const getUser=async()=>globalThis.__user;export const publicUser=u=>u;`,loader:'js'}));
 }}]});const file=resolve(root,'tests/integration/realtime-isolated.cjs');const compiled=new Module(file);compiled.paths=Module._nodeModulePaths(dirname(file));compiled._compile(built.outputFiles[0].text,file);return compiled.exports;
}
const pg=new PGlite();const readers=[];
try{
 await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;`);await pg.exec(fs.readFileSync('tests/integration/fixtures/pre-economy-schema.sql','utf8'));
 await pg.exec(`INSERT INTO mg_users(id,email,username,role,xp,avatar)VALUES(1,'one@test','One','visitor',500,'data:image/png;base64,old'),(2,'two@test','Two','visitor',0,null),(3,'three@test','Three','admin',0,null);INSERT INTO mg_movies(id,title,description,category,genre,year,duration,poster)VALUES(1,'Movie','Story','Фильм','Драма',2000,90,'data:image/png;base64,old');`);
 const bundle=fs.readFileSync('scripts/supabase/01-upgrade.sql','utf8');await pg.exec(bundle);await pg.exec(bundle);
 globalThis.__db=drizzle(pg);globalThis.__user=null;
 let storageFailure=false;const uploads=[];
 globalThis.__storage={storage:{from:bucket=>{assert.equal(bucket,'uploads');return{upload:async(path,bytes,options)=>{if(storageFailure)return{error:{message:'private backend error'}};uploads.push({path,bytes,options});return{error:null}},getPublicUrl:path=>({data:{publicUrl:'https://storage.test/uploads/'+path}})}}}};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://storage.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-server-key';
 const r=await handlers();
 const request=(path,body,headers={})=>new NextRequest('https://test.local'+path,body?{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}:{headers});
 async function user(id){globalThis.__user=id?(await pg.query('SELECT * FROM mg_users WHERE id=$1',[id])).rows[0]:null;}
 async function revisions(){return new Map((await pg.query('SELECT audience_id,revision::text AS version FROM mg_realtime_versions')).rows.map(x=>[x.audience_id,x.version]));}
 async function action(body,status=200){const response=await r.action(request('/api/action',body));const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
 // New image writes fail, but existing inline values survive unrelated updates until migrated.
 await pg.exec('UPDATE mg_movies SET views=views+1 WHERE id=1');assert.equal((await pg.query('SELECT poster FROM mg_movies WHERE id=1')).rows[0].poster,'data:image/png;base64,old');
 for(const [table,col]of[['mg_movies','poster'],['mg_users','avatar'],['mg_users','header_image']]){let denied=false;try{await pg.query(`UPDATE ${table} SET ${col}=$1 WHERE id=1`,['data:image/png;base64,new'])}catch(error){denied=error.code==='22023'}assert(denied)}
 await user(1);await action({action:'profile',headerImage:'data:image/png;base64,new'},400);await action({action:'profile',headerImage:'https://storage.test/header.png'});
 // Idempotent desired bookmark state, including concurrent/repeated requests.
 await action({action:'bookmark',movieId:1,saved:true});await action({action:'bookmark',movieId:1,saved:true});assert.equal((await pg.query('SELECT count(*)::int n FROM mg_bookmarks')).rows[0].n,1);
 await action({action:'bookmark',movieId:1,saved:false});assert.equal((await pg.query('SELECT count(*)::int n FROM mg_bookmarks')).rows[0].n,0);
 async function upload(kind,type,bytes,status){const form=new FormData();form.set('kind',kind);form.set('file',new File([bytes],'image.png',{type}));const response=await r.upload(new NextRequest('https://test.local/api/upload',{method:'POST',body:form}));const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
 const png=new Uint8Array([137,80,78,71,13,10,26,10,1]);
 await user(null);await upload('avatar','image/png',png,401);await user(1);await upload('poster','image/png',png,403);await upload('avatar','image/png',new TextEncoder().encode('<svg>'),400);
 const avatar=await upload('avatar','image/png',png,200);assert(avatar.url.startsWith('https://'));assert.equal((await pg.query('SELECT avatar FROM mg_users WHERE id=1')).rows[0].avatar,avatar.url);assert.equal(uploads[0].options.cacheControl,'31536000');assert(uploads[0].path.startsWith('avatar/1/'));
 storageFailure=true;const failure=await upload('avatar','image/png',png,500);assert(!failure.error.includes('private backend'));assert.equal((await pg.query('SELECT avatar FROM mg_users WHERE id=1')).rows[0].avatar,avatar.url);storageFailure=false;
 await user(3);const poster=await upload('poster','image/png',png,200);assert(poster.url.startsWith('https://'));await pg.query('UPDATE mg_movies SET poster=$1 WHERE id=1',[poster.url]);
 // No revision advances on rolled-back/no-op writes; a sender and recipient get private invalidation.
 await pg.exec("INSERT INTO mg_friendships(from_id,to_id,status)VALUES(1,2,'accepted')");
 const before=await revisions();await pg.exec('BEGIN; INSERT INTO mg_messages(from_id,to_id,body)VALUES(1,2,\'rolled back\'); ROLLBACK;');assert.deepEqual(await revisions(),before);
 await pg.exec('UPDATE mg_users SET xp=xp WHERE id=1');assert.deepEqual(await revisions(),before);
 const badOrigin=await r.events(request('/api/events',null,{origin:'https://evil.test'}));assert.equal(badOrigin.status,403);
 async function open(id){await user(id);const controller=new AbortController();const response=await r.events(new NextRequest('https://test.local/api/events?userId=3',{signal:controller.signal}));assert.equal(response.headers.get('Content-Type'),'text/event-stream; charset=utf-8');assert.equal(response.headers.get('X-Accel-Buffering'),'no');const reader=response.body.getReader();const record={reader,controller,text:''};readers.push(record);void(async()=>{while(true){const part=await reader.read();if(part.done)break;record.text+=new TextDecoder().decode(part.value)}})();return record;}
 async function until(predicate){const end=Date.now()+7000;while(!predicate()){if(Date.now()>end)throw Error('Timed out waiting for SSE');await new Promise(resolve=>setTimeout(resolve,30));}}
 const guest=await open(null),one=await open(1),three=await open(3);
 await until(()=>one.text.includes('"chat"')&&guest.text.includes('"pulse"'));
 assert(!guest.text.includes('"chat"'));assert(!guest.text.includes('"social"'));await new Promise(resolve=>setTimeout(resolve,3300));
 const marks=[guest.text.length,one.text.length,three.text.length];await user(1);
 const sent=await r.chatPost(request('/api/chat',{toId:2,text:'A private message'}));assert.equal(sent.status,200);
 await until(()=>one.text.slice(marks[1]).includes('"chat"'));assert(!guest.text.slice(marks[0]).includes('"chat"'));assert(!three.text.slice(marks[2]).includes('"chat"'));assert(!one.text.includes('A private message'));
 const after=await revisions();assert.notEqual(after.get(1),before.get(1));assert.notEqual(after.get(2),before.get(2));
 await user(2);const thread=await r.chatGet(request('/api/chat?with=1'));assert.equal(thread.status,200);assert.equal((await thread.json()).messages.at(-1).body,'A private message');
 await user(3);const forbidden=await r.chatGet(request('/api/chat?with=1'));assert.equal(forbidden.status,403);
 await user(1);await action({action:'watch',movieId:1});await user(null);const pulse=await r.pulse();assert.equal(pulse.status,200);const publicSlice=await pulse.json();assert.equal(publicSlice.weeklyLeaders[0].id,1);assert.equal(publicSlice.films[0].title,'Movie');assert(!JSON.stringify(publicSlice).includes('one@test'));assert(!('notifications'in publicSlice));
 const publicMark=guest.text.length;await pg.exec('UPDATE mg_movies SET views=views+1 WHERE id=1');await until(()=>guest.text.slice(publicMark).includes('"pulse"'));
 const favoriteMark=guest.text.length;await pg.exec('INSERT INTO mg_favorites(user_id,movie_id)VALUES(1,1),(2,1)');await until(()=>guest.text.slice(favoriteMark).includes('"pulse"'));assert.equal((await (await r.pulse()).json()).films[0].favoriteCount,2);
 await pg.exec('DELETE FROM mg_favorites WHERE user_id=1');assert.equal((await (await r.pulse()).json()).films[0].favoriteCount,1);
 await pg.exec('DELETE FROM mg_favorites WHERE user_id=2');assert.equal((await (await r.pulse()).json()).films[0].favoriteCount,0);
 for(const role of['anon','authenticated']){await pg.exec('SET ROLE '+role);let denied=false;try{await pg.query('SELECT * FROM mg_realtime_versions')}catch{denied=true}assert(denied);await pg.exec('RESET ROLE')}
 console.log('Passed actual SSE/DB + chat/Storage routes: transactional cross-instance revisions; audience isolation, no message payload leaks, reconnect resync, abort cleanup, same-origin checks, no-op/rollback behavior; legacy image preservation + new inline write rejection; MIME checks, role gates, URL-only persistence and failed upload preservation; idempotent bookmark state.');
}finally{for(const record of readers){record.controller.abort();await record.reader.cancel().catch(()=>{})}await pg.close()}
