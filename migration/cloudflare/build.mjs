import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),dir=new URL('./build/',import.meta.url);await mkdir(dir,{recursive:true});
const original=await readFile(new URL('worker/index.js',root),'utf8');
let app=await readFile(new URL('src/app.js',root),'utf8');
const start=app.indexOf(' if(!playerAccount.signedIn){const returnTo='),end=app.indexOf('\n const profile=playerAccount.profile;',start);if(start<0||end<0)throw new Error('Account UI changed; update migration patch.');
app=app.slice(0,start)+' if(!playerAccount.signedIn){emailAccountDialog(create);return;}'+app.slice(end);
app=app.replace('<a class="account-signout" href="/signout-with-chatgpt?return_to=%2F" target="_top">Log out</a>','<button id="accountLogout" class="text-button">Log out</button>');
app=app.replace(" $('profileForm').onsubmit=", " $('accountLogout').onclick=async()=>{await api('/api/auth/logout',{});playerAccount=null;renderAccount();$('modal').close();};\n $('profileForm').onsubmit=");
app=app.replace('Players need access to this site; it is currently published privately.','Share the room code with your friends.');
app+='\n'+await readFile(new URL('./account-ui.js',import.meta.url),'utf8');
let game=original.replace('export default {async fetch','const gameWorker={async fetch').replaceAll('oai-authenticated-user-id','khasino-verified-user-id');
// Replace only embedded app asset, retaining every other game asset verbatim.
const a=game.indexOf('const ASSETS=')+13,b=game.indexOf(';\n',a),assets=JSON.parse(game.slice(a,b));assets['/app.js'][0]=app;assets['/sw.js'][0]=assets['/sw.js'][0].replace(/khasino-user-v1-\d+/g,'khasino-independent-v1-4');
game=game.slice(0,a)+JSON.stringify(assets)+game.slice(b)+'\nexport default gameWorker;\n';
if(game.includes('signin-with-chatgpt')||game.includes('signout-with-chatgpt')||game.includes('Continue with ChatGPT'))throw new Error('Old login leaked into migration.');
await writeFile(new URL('game.js',dir),game);for(const f of ['entry.js','auth.js','storage.js'])await copyFile(new URL(f,import.meta.url),new URL(f,dir));
console.log('Independent Khasino Worker built: migration/cloudflare/build/entry.js');
