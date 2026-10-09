import game from './game.js';
import {D1Bucket} from './storage.js';
import {accountIdentity,accountRoutes} from './auth.js';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(!env.DB)return new Response('Khasino storage is not configured.',{status:503});
 const bucket=new D1Bucket(env.DB),bindings={...env,BUCKET:bucket};
 if(url.pathname.startsWith('/api/auth/'))return accountRoutes(request,bindings,bucket,url);
 // Never trust platform identity headers arriving from the public internet.
 const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('khasino-verified-user-id');
 try{if(url.pathname.startsWith('/api/')){const id=await accountIdentity(request,bindings,bucket);if(id)headers.set('khasino-verified-user-id',id);}}
 catch{return new Response(JSON.stringify({error:'Account verification is temporarily unavailable. Please try again.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
 return game.fetch(new Request(request,{headers}),bindings,ctx);
}};
