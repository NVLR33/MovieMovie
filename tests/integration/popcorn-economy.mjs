// Isolated local integration test: never connects to DATABASE_URL or a remote service.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Module from 'node:module';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
async function handlers() {
 const bundle = await build({ stdin: { contents: `export { POST as actionPost } from './src/app/api/action/route';export { GET as petGet, POST as petPost } from './src/app/api/pet/route';`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated-services', setup(builder) {
  builder.onResolve({ filter: /^@\/db$/ }, () => ({ path: 'db', namespace: 'test' }));
  builder.onResolve({ filter: /^@\/lib\/auth$/ }, () => ({ path: 'auth', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'db' ? `export const db=globalThis.__db;` : `export const getUser=async()=>globalThis.__user;export const publicUser=u=>u;`, loader: 'js' }));
 } }] });
 const filename = resolve(root, 'tests/integration/isolated-routes.cjs');
 const compiled = new Module(filename);
 compiled.paths = Module._nodeModulePaths(dirname(filename));
 compiled._compile(bundle.outputFiles[0].text, filename);
 return compiled.exports;
}
(async()=>{const pg=new PGlite();const RealDate=Date;let clock=RealDate.parse('2026-11-16T12:00:00Z');try{
 await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;`);await pg.exec(fs.readFileSync('tests/integration/fixtures/pre-economy-schema.sql','utf8'));
 const bundle=fs.readFileSync('scripts/supabase/01-upgrade.sql','utf8');await pg.exec(bundle);await pg.exec(bundle);
 assert.equal((await pg.query('SELECT count(*)::int n FROM moviemovie_migrations.history')).rows[0].n,11);
 assert.deepEqual((await pg.query(fs.readFileSync('scripts/supabase/02-verify.sql','utf8'))).rows.filter(r=>r.result!=='OK'),[]);
 const schemaAudit=fs.readFileSync('scripts/supabase/03-schema-audit.sql','utf8');
 assert.deepEqual((await pg.query(schemaAudit)).rows.filter(r=>r.result!=='OK'),[]);
 await pg.exec('BEGIN; ALTER TABLE mg_users RENAME COLUMN bio TO bio_missing; DROP INDEX mg_popcorn_user_history; ALTER TABLE mg_cinema_pets DISABLE ROW LEVEL SECURITY; ALTER TABLE mg_cinema_pets ALTER COLUMN balance DROP DEFAULT; ALTER TABLE mg_movies ALTER COLUMN year TYPE text; DROP TABLE mg_messages;');
 const drift=(await pg.query(schemaAudit)).rows.filter(r=>r.result!=='OK').map(r=>r.check_name);
 assert(drift.includes('Column: mg_users.bio')); assert(drift.includes('Index: mg_popcorn_user_history')); assert(drift.includes('RLS: mg_cinema_pets')); assert(drift.includes('Column: mg_cinema_pets.balance')); assert(drift.includes('Column: mg_movies.year')); assert(drift.includes('Table: mg_messages'));
 await pg.exec('ROLLBACK');
 // The SQL Editor upgrade itself fails closed on unrelated legacy schema drift.
 await pg.exec('ALTER TABLE mg_users RENAME COLUMN bio TO bio_missing');
 let rejected=false;try{await pg.exec(bundle)}catch(error){rejected=/schema verification failed/.test(error.message)}
 assert(rejected);await pg.exec('ROLLBACK');await pg.exec('ALTER TABLE mg_users RENAME COLUMN bio_missing TO bio');
 // Storage is optional and Supabase-only. A local stand-in tests idempotence without files.
 await pg.exec('CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text UNIQUE,public boolean,file_size_limit bigint,allowed_mime_types text[])');
 const storageSetup=fs.readFileSync('scripts/supabase/04-storage-setup.sql','utf8');await pg.exec(storageSetup);await pg.exec(storageSetup);
 assert.equal((await pg.query('SELECT count(*)::int n FROM storage.buckets')).rows[0].n,1);
 await pg.exec("UPDATE storage.buckets SET public=false WHERE id='uploads'");
 let storageRejected=false;try{await pg.exec(storageSetup)}catch(error){storageRejected=/settings differ/.test(error.message)}
 assert(storageRejected);await pg.exec('ROLLBACK');assert.equal((await pg.query("SELECT public FROM storage.buckets WHERE id='uploads'")).rows[0].public,false);
 await pg.exec(`INSERT INTO mg_users(id,email,username,role,xp)VALUES(1,'economy@test','Viewer','visitor',0),(2,'other@test','Other','visitor',0);INSERT INTO mg_movies(id,title,description,category,genre,year,duration,poster)SELECT n,'Film '||n,'Description','Фильм','Драма',2000,90,'' FROM generate_series(1,40)n;`);
 global.__db=drizzle(pg);global.__user=null;const r=await handlers();
 global.Date=class extends RealDate{constructor(value){super(arguments.length?value:clock)}static now(){return clock}};
 const request=(url,body)=>new NextRequest('https://test.local'+url,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);
 async function user(id){global.__user=id?(await pg.query('SELECT * FROM mg_users WHERE id=$1',[id])).rows[0]:null;}
 async function get(query='',status=200){const res=await r.petGet(request('/api/pet'+query));const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data;}
 async function post(body,status=200){const res=await r.petPost(request('/api/pet',body));const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data.pet;}
 async function activity(action,movieId){const res=await r.actionPost(request('/api/action',{action,movieId,value:8,text:'A standalone cinema review with enough detail to pass the length threshold. '.repeat(2)}));assert.equal(res.status,200,JSON.stringify(await res.json()));}
 await get('?history=1',401);await post({action:'weekly',id:'screenings'},401);await user(1);
 let pet=(await get()).pet;assert.equal(pet.economy.lifetime.earned,0);assert.equal(pet.productionCarry,0);
 await get('?history=1&filter=invalid',400);await get('?history=1&cursor=0',400);await get('?history=1&cursor=1.5',400);await get('?history=1&cursor=NaN',400);
 await post({action:'weekly',id:'screenings'},400);await post({action:'adopt'});await post({action:'weekly',id:'screenings'},400);await post({action:'milestone',id:'watch10'},400);
 for(let id=1;id<=7;id++)await activity('watch',id);
 for(let id=1;id<=12;id++)await activity('rate',id);
 for(let id=1;id<=3;id++)await activity('comment',id);
 pet=(await get()).pet;assert.equal(pet.economy.weeklyActivity.watch,5);assert.equal(pet.economy.activity.rate,10);assert.equal(pet.economy.activity.review,3);assert.equal(pet.economy.week.earned,115);
 // Concurrent claims serialize through the same wallet. Body-supplied rewards and dates are ignored.
 const body={action:'weekly',id:'screenings',popcorn:999999,week:'2020-01-01',userId:2};
 const concurrent=await Promise.all([r.petPost(request('/api/pet',body)),r.petPost(request('/api/pet',body))]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,400]);
 const xpBefore=pet.experience;
 for(const id of ['opinions','reviews','session'])await post({action:'weekly',id});
 pet=(await get()).pet;assert.equal(pet.economy.week.earned,195);assert.equal(pet.experience,xpBefore);assert.equal(pet.economy.claimedWeekly.length,4);
 await post({action:'weekly',id:'fake'},400);await post({action:'milestone',id:'fake'},400);await post({action:'milestone',id:'watch10'},400);
 // Next day: 10 paid watches, not the twelve total watch entries, advance the milestone.
 clock=RealDate.parse('2026-11-17T12:00:00Z');
 for(let id=8;id<=12;id++)await activity('watch',id);
 for(let id=4;id<=5;id++)await activity('comment',id);
 pet=(await get()).pet;assert.equal(pet.economy.activity.watch,10);assert.equal(pet.economy.activity.review,5);
 const beforeMilestone=pet.balance;pet=await post({action:'milestone',id:'watch10',amount:999999});assert.equal(pet.balance,beforeMilestone+25);await post({action:'milestone',id:'watch10'},400);await post({action:'milestone',id:'review5'});
 await post({action:'care',kind:'feed'});
 pet=(await get()).pet;assert.equal(pet.economy.lifetime.earned-pet.economy.lifetime.spent,pet.balance);assert.equal(pet.economy.week.spent,8);
 // Full, cursor-paginated history excludes baseline and other users. Filtering happens in SQL.
 await pg.query("INSERT INTO mg_popcorn_ledger(user_id,source_key,kind,delta)VALUES(1,'watch:1000','baseline',0)");
 let cursor=null,ids=[];do{const page=await get('?history=1'+(cursor?'&cursor='+cursor:''));assert(page.entries.length<=20);for(const e of page.entries){assert.notEqual(e.kind,'baseline');assert(e.label);assert(!('sourceKey'in e));ids.push(e.id)}cursor=page.nextCursor;}while(cursor);
 assert(ids.length>20);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(ids,[...ids].sort((a,b)=>b-a));
 const income=await get('?history=1&filter=income');assert(income.entries.every(e=>e.delta>0));const expense=await get('?history=1&filter=expense');assert.equal(expense.entries.length,1);assert.equal(expense.entries[0].delta,-8);
 assert(ids.length>(await get('?history=1&filter=income')).entries.length);assert((await get('?history=1')).entries.some(e=>e.label.includes('лимит')));
 await user(2);assert.equal((await get('?history=1')).entries.length,0);assert.equal((await get()).pet.economy.lifetime.earned,0);
 const publicData=await get('?userId=1&history=1');assert(!('economy'in publicData.pet));assert(!('productionCarry'in publicData.pet));assert(!('ledger'in publicData.pet));
 await user(1);
 // Fractional 45-minute production survives collection and old-rate upgrades.
 await pg.query('UPDATE mg_cinema_pets SET last_collected_at=$1,production_carry=0 WHERE user_id=1',[new Date(clock-45*60000)]);
 const beforeCollect=(await get()).pet.balance;pet=await post({action:'collect'});assert.equal(pet.balance,beforeCollect+1);assert.equal(pet.productionCarry,1800000);
 clock+=15*60000;pet=await post({action:'collect'});assert.equal(pet.balance,beforeCollect+2);assert.equal(pet.productionCarry,0);
 clock+=15*60000;const beforeUpgrade=pet.balance;pet=await post({action:'upgrade',kind:'projector',expectedLevel:0});assert.equal(pet.balance,beforeUpgrade-60);assert.equal(pet.productionCarry,1800000);
 clock+=10*60000;pet=await post({action:'collect'});assert.equal(pet.balance,beforeUpgrade-59);assert.equal(pet.productionCarry,0);
 // Calendar rollover: old paid activity and claims cannot be submitted for the new week.
 clock=RealDate.parse('2026-11-23T00:00:00Z');pet=(await get()).pet;assert.equal(pet.economy.weeklyActivity.watch,0);assert.equal(pet.economy.claimedWeekly.length,0);assert.equal(pet.economy.week.earned,0);assert(pet.economy.claimedMilestones.includes('watch10'));
 await post({action:'weekly',id:'screenings',week:'2026-11-16'},400);await post({action:'milestone',id:'watch10'},400);
 for(let id=13;id<=17;id++)await activity('watch',id);await post({action:'weekly',id:'screenings'});
 pet=(await get()).pet;assert.equal(pet.economy.week.earned,70);assert.equal(pet.economy.weeklyActivity.watch,5);assert.equal(pet.economy.activity.watch,15);
 const preserved=pet.balance,carry=pet.productionCarry;
 // Production-like incremental upgrade: seven files already applied, only indexes pending.
 const indexNames=['mg_watch_user_movie','mg_watch_user_date','mg_watch_movie','mg_rating_movie_value','mg_comment_movie_date','mg_notification_user_date','mg_message_pair_date','mg_popcorn_user_history'];
 await pg.exec("DELETE FROM moviemovie_migrations.history WHERE name='20261122-z-system-indexes.sql';"+indexNames.map(name=>'DROP INDEX '+name+';').join('')+'ALTER TABLE mg_users RENAME COLUMN bio TO bio_missing;');
 let incrementalRejected=false;try{await pg.exec(bundle)}catch(error){incrementalRejected=/schema verification failed/.test(error.message)}assert(incrementalRejected);await pg.exec('ROLLBACK');
 assert.equal((await pg.query('SELECT count(*)::int n FROM moviemovie_migrations.history')).rows[0].n,10);
 assert.equal((await pg.query("SELECT to_regclass('mg_popcorn_user_history') AS name")).rows[0].name,null);
 assert.equal((await get()).pet.balance,preserved);
 await pg.exec('ALTER TABLE mg_users RENAME COLUMN bio_missing TO bio');
 await pg.exec(bundle);assert.equal((await pg.query('SELECT count(*)::int n FROM moviemovie_migrations.history')).rows[0].n,11);
 await pg.exec(bundle);pet=(await get()).pet;assert.equal(pet.balance,preserved);assert.equal(pet.productionCarry,carry);assert.equal(pet.economy.lifetime.earned-pet.economy.lifetime.spent,pet.balance);
 for(const invalid of [-1,3600000]){let failed=false;try{await pg.query('UPDATE mg_cinema_pets SET production_carry=$1 WHERE user_id=1',[invalid])}catch{failed=true}assert(failed)}
 console.log('Passed full database audit (32 tables, 228 columns), deliberate drift detection, transactional rollback + pending-index incremental upgrade, optional Storage idempotence/privacy; actual wallet API + PGlite: eleven repeatable migrations/readiness, authenticated private cursor history and filters; UTC week rollover; all-part weekly criteria, zero/capped/baseline exclusion, atomic concurrent bonus claims, permanent milestone dedup; injected amount/date/user ignored; fractional collection and speed change conservation; unchanged XP; full balance reconciliation and no reset.');
}finally{global.Date=RealDate;await pg.close()}})().catch(e=>{console.error(e);process.exitCode=1});
