import {readFile,writeFile} from 'node:fs/promises';
const [databaseId,origin]=process.argv.slice(2);
if(!/^[0-9a-f-]{36}$/i.test(databaseId||''))throw new Error('Supply the D1 database ID returned by wrangler d1 create.');
const u=new URL(origin);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash)throw new Error('Supply the HTTPS origin, for example https://khasino.yourname.workers.dev');
const config=JSON.parse(await readFile(new URL('wrangler.example.jsonc',import.meta.url),'utf8'));config.vars.APP_ORIGIN=u.origin;config.d1_databases[0].database_id=databaseId;
await writeFile(new URL('wrangler.jsonc',import.meta.url),JSON.stringify(config,null,2)+'\n');console.log('Cloudflare configuration saved.');
