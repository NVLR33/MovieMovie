// Production Next/browser regression. Local marker-guarded disposable DB only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from 'pg';
const deps=createRequire(process.env.UI_TEST_DEPS?resolve(process.env.UI_TEST_DEPS,'package.json'):import.meta.url);
const {chromium:pw}=deps('playwright-core'),chromium=deps('@sparticuz/chromium').default;
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.equal(new URL(process.env.AUDIT_DATABASE_URL).searchParams.get('host'),'/tmp/mm-audit-pg');
const db=new Client({connectionString:process.env.AUDIT_DATABASE_URL});await db.connect();
assert.equal((await db.query("select value from mm_audit_fixture where key='isolated'")).rows[0]?.value,'yes');await db.end();
const browser=await pw.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process'),headless:true});
try{
 const seed=await browser.newContext(),context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 const suffix=Date.now(),email=`auth-browser-${suffix}@example.test`,password='browser-auth-password';
 const registered=await seed.request.post(base+'/api/auth',{data:{action:'register',email,password,username:`Auth${suffix}`}});assert.equal(registered.status(),200);const account=(await registered.json()).user;
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?auth=schema');const modal=page.locator('.auth-modal'),message=modal.getByRole('alert');
 await message.waitFor();assert((await message.innerText()).includes('SQL-миграции Supabase'));
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Auth form overflow '+width);}
 await page.waitForTimeout(4200);assert(await message.isVisible(),'Error must remain after the toast expires');
 await modal.getByLabel('Электронная почта',{exact:true}).fill(email);await modal.getByLabel('Пароль',{exact:true}).fill('wrong-password');
 await modal.getByRole('button',{name:'Войти в киновселенную',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.auth-error-message')?.textContent.includes('Неверная почта или пароль'));
 await modal.getByLabel('Пароль',{exact:true}).fill(password);await modal.getByRole('button',{name:'Войти в киновселенную',exact:true}).click();await modal.waitFor({state:'detached'});
 const session=await context.request.get(base+'/api/auth');assert.equal((await session.json()).user.id,account.id);
 assert((await context.cookies()).some(cookie=>cookie.name==='mg_session'&&cookie.httpOnly));
 await page.goto(base+'/?auth=state');await modal.waitFor();assert((await modal.getByRole('alert').innerText()).includes('cookie'));
 await page.goto(base+'/?auth=constructor');await modal.waitFor();assert((await modal.getByRole('alert').innerText()).includes('Не удалось выполнить вход'));
 assert.deepEqual(errors,[]);
 console.log('Passed production browser auth error persistence, four widths 320–1280, bad credentials + successful login with actual httpOnly cookie, OAuth state diagnostic and unknown-reason fallback; no runtime errors.');
}finally{await browser.close();}
