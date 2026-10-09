const SESSION='__Host-khasino-session',FLOW='__Host-khasino-oauth';
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>crypto.randomUUID()+crypto.randomUUID();
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function cookies(req){return Object.fromEntries((req.headers.get('Cookie')||'').split(';').map(s=>s.trim().split('=')));}
function reply(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});}
function redirect(location,setCookie){return new Response(null,{status:303,headers:{Location:location,'Cache-Control':'no-store',...(setCookie?{'Set-Cookie':setCookie}:{})}});}
async function provider(env,operation,data){
 if(!env.FIREBASE_API_KEY)throw new Error('Accounts are not configured yet.');
 const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
 const body=await r.json();if(!r.ok)throw new Error('Could not complete this account request. Check your details and try again.');return body;
}
async function session(env,bucket,tokens){
 const result=await provider(env,'lookup',{idToken:tokens.idToken}),user=result.users?.[0];
 if(!user?.localId||!user.emailVerified)throw new Error('Verify your email before signing in.');
 const token=random(),key='sessions/'+await digest(token);await bucket.put(key,JSON.stringify({uid:user.localId,idToken:tokens.idToken,refreshToken:tokens.refreshToken,expires:Date.now()+30*86400000}));return cookie(SESSION,token,30*86400);
}
export async function accountIdentity(req,env,bucket){
 const token=cookies(req)[SESSION];if(!token||token.length>160)return null;
 const key='sessions/'+await digest(token),o=await bucket.get(key);if(!o)return null;let s=JSON.parse(await o.text());if(s.expires<Date.now()){await bucket.delete(key);return null;}
 let result;try{result=await provider(env,'lookup',{idToken:s.idToken});}catch{
  const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return null;const t=await r.json();s.idToken=t.id_token;s.refreshToken=t.refresh_token;result=await provider(env,'lookup',{idToken:s.idToken});await bucket.put(key,JSON.stringify(s),{onlyIf:{etagMatches:o.etag}});
 }
 const u=result.users?.[0];return u?.localId===s.uid&&u.emailVerified?'firebase:'+s.uid:null;
}
async function throttle(req,env){
 const ip=req.headers.get('CF-Connecting-IP')||'unknown',window=Math.floor(Date.now()/600000),key=await digest(ip)+':'+window;
 const r=await env.DB.prepare('INSERT INTO auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,Date.now()+600000).first();
 if(r.count>20)throw new Error('Too many attempts. Try again in ten minutes.');
 await env.DB.prepare('DELETE FROM auth_limits WHERE expires<?').bind(Date.now()).run();
}
export async function accountRoutes(req,env,bucket,url){
 const op=url.pathname.slice('/api/auth/'.length),origin=env.APP_ORIGIN;
 if(!origin||url.origin!==origin)return reply({error:'Account origin is not configured.'},503);
 try{
  if(op==='google'&&req.method==='GET'){
   if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new Error('Google sign-in is not configured yet.');await throttle(req,env);
   const state=random();await bucket.put('oauth/'+await digest(state),JSON.stringify({expires:Date.now()+600000}));
   const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:origin+'/api/auth/callback',response_type:'code',scope:'openid email profile',state,prompt:'select_account'}).toString();return redirect(target.href,cookie(FLOW,state,600));
  }
  if(op==='callback'&&req.method==='GET'){
   const state=url.searchParams.get('state');if(!state||state!==cookies(req)[FLOW])throw new Error('Sign-in expired. Start again.');const key='oauth/'+await digest(state),old=await bucket.get(key);if(!old||JSON.parse(await old.text()).expires<Date.now())throw new Error('Sign-in expired. Start again.');
   const claimed=await bucket.put(key,JSON.stringify({expires:0}),{onlyIf:{etagMatches:old.etag}});if(!claimed)throw new Error('Sign-in already used.');await bucket.delete(key);
   if(!url.searchParams.get('code'))throw new Error('Google sign-in was cancelled.');
   const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code:url.searchParams.get('code'),grant_type:'authorization_code',redirect_uri:origin+'/api/auth/callback'}),signal:AbortSignal.timeout(10000)});const google=await r.json();if(!r.ok||!google.id_token)throw new Error('Google sign-in could not be completed.');
   const tokens=await provider(env,'signInWithIdp',{postBody:new URLSearchParams({id_token:google.id_token,providerId:'google.com'}).toString(),requestUri:origin,returnSecureToken:true});
   const response=redirect('/?account=create',await session(env,bucket,tokens));response.headers.append('Set-Cookie',cookie(FLOW,'',0));return response;
  }
  if(req.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(req.headers.get('Origin')!==origin)return reply({error:'Use the account form on this site.'},403);
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Expected JSON.'},415);
  const raw=await req.text();if(raw.length>4000)return reply({error:'Request too large.'},413);const data=JSON.parse(raw);
  if(op==='logout'){const token=cookies(req)[SESSION];if(token)await bucket.delete('sessions/'+await digest(token));return reply({ok:true},200,{'Set-Cookie':cookie(SESSION,'',0)});}
  await throttle(req,env);
  if(op==='verify'){await provider(env,'update',{oobCode:data.code});return reply({ok:true});}
  if(op==='reset-confirm'){if(typeof data.password!=='string'||data.password.length<8)throw new Error('Use a password with at least eight characters.');await provider(env,'resetPassword',{oobCode:data.code,newPassword:data.password});return reply({ok:true});}
  if(typeof data.email!=='string'||data.email.length>254||!/^\S+@\S+\.\S+$/.test(data.email))throw new Error('Enter a valid email address.');
  if(op==='reset'){try{await provider(env,'sendOobCode',{requestType:'PASSWORD_RESET',email:data.email});}catch{}return reply({message:'If that account exists, a password reset email has been sent.'});}
  if(!['login','signup','resend'].includes(op))return reply({error:'Unknown account action.'},404);
  if(typeof data.password!=='string'||data.password.length<8||data.password.length>128)throw new Error('Use a password with 8–128 characters.');
  const tokens=await provider(env,op==='signup'?'signUp':'signInWithPassword',{email:data.email,password:data.password,returnSecureToken:true});
  if(op==='signup'||op==='resend'){await provider(env,'sendOobCode',{requestType:'VERIFY_EMAIL',idToken:tokens.idToken});return reply({message:'Check your email to verify your account, then log in.'});}
  return reply({ok:true},200,{'Set-Cookie':await session(env,bucket,tokens)});
 }catch(e){if(op==='callback')return redirect('/?authError=1',cookie(FLOW,'',0));return reply({error:e.message||'Account service unavailable.'},400);}
}
