import { assertMaterialCovers } from './material-cover-contract.mjs';
// Browser smoke against a real production Next server, not the React/network fixture.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const deps=createRequire(process.env.UI_TEST_DEPS?resolve(process.env.UI_TEST_DEPS,'package.json'):import.meta.url);
const {chromium:pw}=deps('playwright-core'),chromium=deps('@sparticuz/chromium').default;
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert(process.env.AUDIT_DATABASE_URL&&new URL(process.env.AUDIT_DATABASE_URL).searchParams.get('host')==='/tmp/mm-audit-pg');
const db=new Client({connectionString:process.env.AUDIT_DATABASE_URL});await db.connect();
assert.equal((await db.query("SELECT value FROM mm_audit_fixture WHERE key='isolated'")).rows[0]?.value,'yes');await db.end();
const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(arg=>arg!=='--single-process'),headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 const api=context.request;
 const signup=await api.post(base+'/api/auth',{data:{action:'register',email:`browser-${Date.now()}@example.test`,username:`Browser${Date.now()}`,password:'audit-browser-password'}});assert.equal(signup.status(),200);
 const me=(await signup.json()).user;
 for(const body of [{action:'watch',movieId:1},{action:'bookmark',movieId:2,saved:true},{action:'favorite',movieId:2}])assert.equal((await api.post(base+'/api/action',{data:body})).status(),200);
 const snapshot=await(await api.get(base+'/api/data')).json();assert.equal(snapshot.user.id,me.id);
 const page=await context.newPage();const errors=[];const failures=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/hydration|Minified React error|TypeError|ReferenceError/i.test(message.text()))errors.push(message.text())});
 page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=500)failures.push(`${response.status()} ${response.url()}`)});
 const open=async path=>{const response=await page.goto(base+path);assert.equal(response.status(),200,path);await page.waitForTimeout(450);if(await page.locator('[data-material-cover]').count())await assertMaterialCovers(page)};
 const pages=['/','/catalog','/world','/top','/profile','/watchlist','/favorites','/leaderboard','/achievements','/challenges','/games','/friends','/wrapped','/collab','/watchroom','/chat','/admin','/about-admin','/movie/1','/movie/2',`/user/${me.id}`,`/compare/${me.id}`,'/room/ABC123?movie=2'];
 for(const path of pages){await open(path);assert((await page.locator('main').innerText()).trim().length>0,'Empty route '+path)}
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 const cards=async()=>page.locator('.film-grid > .film-card h3').allTextContents();
 const find=predicate=>snapshot.films.filter(predicate).map(f=>f.title).sort();
 const check=async expected=>assert.deepEqual((await cards()).sort(),expected.slice().sort());
 const cases=[
  ['Жанр','Драма',find(f=>f.genre.split(',').map(s=>s.trim()).includes('Драма'))],
  ['Студия','Studio B',find(f=>(f.studio||'').split(',').map(s=>s.trim()).includes('Studio B'))],
  ['Год','before1960',find(f=>f.year<1960)],
  ['Год','2020',find(f=>f.year===2020)],
  ['Минимальный рейтинг','8',find(f=>f.rating>=8)],
  ['Минимальный рейтинг','9',find(f=>f.rating>=9)],
  ['Статус просмотра','watched',find(f=>f.id===1)],
  ['Статус просмотра','unwatched',find(f=>f.id!==1)],
 ];
 for(const[label,value,expected]of cases){await open('/catalog');await page.getByRole('button',{name:'Все фильтры',exact:true}).click();await page.getByRole('combobox',{name:label,exact:true}).selectOption(value);await check(expected)}
 for(const sort of ['popular','rating','new','old']){
  const current=await(await api.get(base+'/api/data')).json();
  await open('/catalog');await page.getByRole('button',{name:'Все фильтры',exact:true}).click();await page.getByRole('combobox',{name:'Сортировка',exact:true}).selectOption(sort);
  const expected=[...current.films].sort((a,b)=>(sort==='rating'?b.rating-a.rating:sort==='new'?b.year-a.year:sort==='old'?a.year-b.year:(b.views||0)-(a.views||0))||a.id-b.id).map(f=>f.title);assert.deepEqual(await cards(),expected);
 }
 await open('/catalog?studio=Studio%20B&year=2020');assert(await page.locator('#catalog-precise-filters').isVisible());await check(find(f=>f.year===2020&&(f.studio||'').includes('Studio B')));
 await open('/catalog');for(const mood of ['🍿 Попкорновый аттракцион','🧠 Вскипятить мозги','😭 Поплакать','🌃 Эстетика ночи','☕ Уютный вечер','🦖 На одном дыхании']){const button=page.getByRole('button',{name:mood,exact:true});await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true')}
 for(const metric of ['rating','views','favorites']){await open(`/top?metric=${metric}&limit=100`);assert.equal(await page.locator('.material-metrics button[aria-pressed=true]').count(),1)}
 await open('/top');for(const label of ['Все','Фильм','Сериал','Мультфильм','Мультсериал','Аниме-сериал','Аниме-фильм']){const button=page.locator('.material-categories').getByRole('button',{name:label,exact:true});await button.click();await page.waitForTimeout(100);assert.equal(await button.getAttribute('aria-pressed'),'true')}
 await open('/leaderboard');for(const button of await page.locator('.leader-filters:not(.leader-limit-filters) button').all()){await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true')}for(const limit of [1,3,5,10,25,50,100]){await page.getByRole('button',{name:`Топ-${limit}`,exact:true}).click();assert.equal(await page.locator('.leaderboard-rank-list .rank-row').count(),Math.min(limit,snapshot.leaderboard.length))}
 await open('/world');await page.getByLabel('Выбранная страна',{exact:true}).selectOption('RU');assert.equal(await page.locator('.world-film').count(),1);await page.getByRole('button',{name:'Мои открытия',exact:true}).click();assert.equal(await page.locator('.world-film').count(),1);await page.getByRole('button',{name:'Карта каталога',exact:true}).click();await page.getByLabel('Выбранная страна',{exact:true}).selectOption('');await page.getByLabel('Ещё не смотрел',{exact:true}).check();assert.equal(await page.locator('.world-film').count(),snapshot.films.length-1);
 await open('/movie/1');await page.getByRole('button',{name:/Мнения сообщества ·/}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
 await open('/games');const modes=page.locator('.game-card');assert.equal(await modes.count(),16);await modes.first().click();for(let round=0;round<5;round++){await page.locator('.game-options button').first().click();await page.getByRole('button',{name:round===4?'Результат':'Следующий вопрос',exact:false}).click()}await page.locator('.game-result').waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 console.log(`Passed real-browser navigation across ${pages.length} pages; all catalog control types/sorts/moods, deep links, top metrics/categories, six leaderboard metrics/seven limits, map filters, review drawer and a five-round game; no runtime/hydration errors or local HTTP 5xx.`);
}finally{await browser.close()}
