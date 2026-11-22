// Optional isolated fixture server. No remote URLs, credentials, or persistent production data.
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.AUDIT_DB_DEPS ? resolve(process.env.AUDIT_DB_DEPS, 'package.json') : import.meta.url);
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
import fs from 'node:fs';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const db=await PGlite.create();
await db.exec(fs.readFileSync(root+'/tests/integration/fixtures/pre-economy-schema.sql','utf8'));
await db.exec(fs.readFileSync(root+'/scripts/supabase/01-upgrade.sql','utf8'));
await db.exec(`INSERT INTO mg_movies(title,description,category,genre,studio,year,duration,poster,country,mood) VALUES('Audit film','Audit story','Фильм','Драма, Детектив','Studio A, Studio B',1950,90,'/brand/moviemovie-logo.png','Россия','cry'),('Audit series','Series story','Сериал','Триллер','Studio B',2020,45,'/brand/moviemovie-logo.png','США','fast-paced');`);
fs.mkdirSync('/tmp/mm-audit-pg',{recursive:true});
await db.exec("CREATE TABLE mm_audit_fixture(key text primary key,value text);INSERT INTO mm_audit_fixture VALUES('isolated','yes')");
const server=new PGLiteSocketServer({db,maxConnections:10,path:'/tmp/mm-audit-pg/.s.PGSQL.5432'});
await server.start();console.log('Isolated audit database ready (Unix socket).');
process.on('SIGTERM',async()=>{await server.stop();await db.close();process.exit(0)});
