// Actual production Next/browser test. Guarded local fixture only, no production data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
const deps = createRequire(process.env.UI_TEST_DEPS ? resolve(process.env.UI_TEST_DEPS,'package.json') : import.meta.url);
const { chromium: pw } = deps('playwright-core'), chromium = deps('@sparticuz/chromium').default;
const base = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.equal(new URL(process.env.AUDIT_DATABASE_URL).searchParams.get('host'),'/tmp/mm-audit-pg');
const db = new Client({connectionString:process.env.AUDIT_DATABASE_URL}); await db.connect();
assert.equal((await db.query("SELECT value FROM mm_audit_fixture WHERE key='isolated'")).rows[0]?.value,'yes');
const browser = await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process'),headless:true});
try {
  const context = await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  const suffix = Date.now(); const material = {title:`Заявка ${suffix}`,description:'Полное описание, готовое к публикации',category:'Сериал',genre:'Драма',year:2020,duration:45,episodes:12,poster:'/brand/moviemovie-logo.png',country:'Россия',director:'Автор'};
  const signup = await context.request.post(base+'/api/auth',{data:{action:'register',email:`proposal-${suffix}@example.test`,username:`Proposal${suffix}`,password:'suggestions-browser-password'}}); assert.equal(signup.status(),200);
  const author = (await signup.json()).user;
  const page = await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/catalog');
  await page.getByRole('button',{name:'Предложить кино',exact:true}).click();
  const form = page.getByRole('dialog',{name:'Предложить кино',exact:true}); await form.waitFor();
  await form.getByLabel('Название *',{exact:true}).fill(material.title);
  await form.getByRole('textbox',{name:/^Описание/}).fill(material.description);
  await form.getByRole('combobox',{name:/Категория/}).selectOption(material.category);
  await form.getByLabel('Год начала',{exact:true}).fill(String(material.year));
  await form.getByLabel('Минуты',{exact:true}).fill('45'); await form.getByLabel('Серии',{exact:true}).fill('12');
  await form.getByLabel('Жанры (через запятую)',{exact:true}).fill('Драма');
  await form.locator('.upload-input').first().locator('input:not([type=file])').fill(material.poster);
  for(const width of [320,390,768,1280]) { await page.setViewportSize({width,height:1000}); assert(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Form overflow '+width); }
  await form.getByRole('button',{name:'Отправить предложение',exact:true}).click(); await form.waitFor({state:'detached'});
  let suggestion = (await db.query('SELECT * FROM mg_movie_suggestions WHERE user_id=$1 ORDER BY id DESC LIMIT 1',[author.id])).rows[0]; assert.equal(suggestion.material.episodes,12); assert.equal(suggestion.status,'pending');
  await db.query("UPDATE mg_users SET role='moderator' WHERE id=$1",[author.id]);
  await page.goto(base+'/admin?tab=suggestions'); await page.getByRole('region',{name:'Очередь предложений'}).waitFor(); await page.getByLabel('Поиск заявок',{exact:true}).fill(String(suffix));
  await page.getByRole('region',{name:'Очередь предложений'}).waitFor();
  await page.getByRole('combobox',{name:/Категория предложений/}).selectOption('Фильм'); assert.equal(await page.locator('.suggestion-rich-card').count(),0);
  await page.getByRole('combobox',{name:/Категория предложений/}).selectOption('Сериал'); assert.equal(await page.locator('.suggestion-rich-card').count(),1);
  await page.getByLabel('Поиск заявок',{exact:true}).fill('несуществующая'); assert.equal(await page.locator('.suggestion-rich-card').count(),0);
  await page.getByLabel('Поиск заявок',{exact:true}).fill(String(suffix));
  for(const width of [320,390,768,1280]) { await page.setViewportSize({width,height:1000}); if (!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))) { console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,c:el.className,w:el.getBoundingClientRect().width,r:el.getBoundingClientRect().right})).slice(-35))); await page.screenshot({path:'/tmp/mm-proposal-overflow.png',fullPage:true}); throw new Error('Queue overflow '+width); } }
  fs.mkdirSync('/tmp/mm-suggestions-screenshots',{recursive:true}); await page.screenshot({path:'/tmp/mm-suggestions-screenshots/queue-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Проверить и одобрить',exact:true}).click();
  const review=page.getByRole('dialog',{name:'Проверка предложения',exact:true}); await review.waitFor();
  assert.equal(await review.getByRole('textbox',{name:/^Описание/}).inputValue(),material.description);
  await review.getByRole('textbox',{name:/^Описание/}).fill('Отредактировано куратором');
  await review.getByRole('button',{name:'Одобрить и открыть материал',exact:true}).click();
  await page.waitForURL(/\/movie\/\d+$/); await page.getByRole('heading',{name:material.title,exact:true}).waitFor();
  const filmId=Number(new URL(page.url()).pathname.split('/').pop());
  assert.equal((await db.query('SELECT description FROM mg_movies WHERE id=$1',[filmId])).rows[0].description,'Отредактировано куратором');
  await page.goto(base+'/admin?tab=suggestions'); await page.getByRole('region',{name:'Очередь предложений'}).waitFor(); await page.getByLabel('Поиск заявок',{exact:true}).fill(String(suffix)); assert.equal(await page.locator('.suggestion-rich-card').count(),0);
  await page.getByRole('button',{name:/^Принято /}).click(); assert.equal(await page.locator('.suggestion-rich-card').count(),1);
  // Real HTTP concurrency: replayed approvals cannot create a second film/reward.
  const repeated=await Promise.all([1,2,3].map(()=>context.request.post(base+'/api/action',{data:{action:'approveSuggestion',id:suggestion.id}}))); for(const response of repeated) assert.equal(response.status(),200);
  assert.equal((await db.query('SELECT count(*)::int n FROM mg_movies WHERE title=$1',[material.title])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM mg_popcorn_ledger WHERE user_id=$1 AND kind='catalog'",[author.id])).rows[0].n,1);
  // Another proposal exercises native rejection dialog, cancellation and history.
  const second=await context.request.post(base+'/api/action',{data:{action:'suggestMovie',...material,title:`Отказ ${suffix}`}}); assert.equal(second.status(),200);
  await page.goto(base+'/admin?tab=suggestions'); await page.getByRole('region',{name:'Очередь предложений'}).waitFor(); await page.getByLabel('Поиск заявок',{exact:true}).fill(String(suffix));
  await page.getByRole('button',{name:'Отклонить',exact:true}).click();
  await page.getByRole('dialog',{name:/Отклонить/}).waitFor(); await page.keyboard.press('Escape'); assert.equal(await page.locator('.suggestion-reject-dialog').count(),0);
  await page.getByRole('button',{name:'Отклонить',exact:true}).click(); await page.getByLabel('Причина отклонения',{exact:true}).fill('Нужно уточнить первоисточник');
  await page.getByRole('button',{name:'Подтвердить отклонение',exact:true}).click(); await page.locator('.suggestion-reject-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('.suggestion-rich-card').count(),0); await page.getByRole('button',{name:/^Отклонено /}).click(); assert.equal(await page.getByText('Причина: Нужно уточнить первоисточник',{exact:true}).count(),1);
  await page.setViewportSize({width:390,height:1000}); await page.screenshot({path:'/tmp/mm-suggestions-screenshots/history-mobile.png',fullPage:true});
  // Original author retains their private history after losing moderator access.
  await db.query("UPDATE mg_users SET role='visitor' WHERE id=$1",[author.id]);
  await page.goto(base+'/catalog?suggestions=mine'); await page.getByRole('dialog',{name:'Предложить кино',exact:true}).waitFor(); await page.getByText(/Мои предложения ·/).click(); assert.equal(await page.getByText('Нужно уточнить первоисточник',{exact:true}).count(),1);
  const capped=await Promise.all(Array.from({length:7},(_,i)=>context.request.post(base+'/api/action',{data:{action:'suggestMovie',...material,title:`Параллельная ${suffix} ${i}`}})));
  assert.equal(capped.filter(r=>r.status()===200).length,5); assert.equal(capped.filter(r=>r.status()===400).length,2);
  assert.equal((await db.query("SELECT count(*)::int n FROM mg_movie_suggestions WHERE user_id=$1 AND status='pending'",[author.id])).rows[0].n,5);
  assert.deepEqual(errors,[]);
  console.log('Passed real browser full-form submission, four-width modal/queue checks, category/search filters, review edits + transactional publish + automatic movie navigation, pending removal/archive, replayed approvals + concurrent five-proposal cap, rejection reason/Escape and private author history. Screenshots: /tmp/mm-suggestions-screenshots');
} finally { await browser.close(); await db.end(); }
