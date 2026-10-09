const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const secret=()=>crypto.randomUUID()+crypto.randomUUID();
const roomKey=code=>'rooms/'+code;
const roomCode=()=>{const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');};
function validateName(name){if(typeof name!=='string'||!name.trim()||name.length>20)throw new Error('Choose a name between 1 and 20 characters.');return name.trim();}
async function roomRead(env,code){const object=await env.BUCKET.get(roomKey(code));if(!object)throw new Error('That room was not found. Check the code.');const room=JSON.parse(await object.text());room.game.profile='sa40-user-v1';if(room.expires<Date.now()){await env.BUCKET.delete(roomKey(code));throw new Error('This table has expired. Create a new one.');}await compFinish(env,code,room);return {room,etag:object.etag};}
function syncClock(room,now=Date.now()){
 if(room.game.status!=='playing'){room.clock=null;return;}
 room.timeoutSeats??=room.seats.map(()=>({missed:0,bot:false,abandoned:false}));
 if(!room.clock||room.clock.version!==room.game.version)room.clock={version:room.game.version,endsAt:now+(room.timeoutSeats[room.game.turn].bot?3000:45000)};
}
function advanceClock(room,now=Date.now()){
 syncClock(room,now);
 if(room.game.leaveOffer){if(now<room.game.leaveOffer.endsAt)return false;room.game=resolveLeaveOffer(room.game);syncClock(room,now);return true;}
 if(!room.clock||now<room.clock.endsAt)return false;
 const p=room.game.turn,s=room.timeoutSeats[p];s.missed++;if(s.missed>=3){s.bot=true;if(room.rated)s.abandoned=true;}
 room.game=beginLeaveOffer(room.game,p,botMove(room.game,p),now);syncClock(room,now);return true;
}
async function writeRoom(env,code,room,etag){syncClock(room);const result=await env.BUCKET.put(roomKey(code),JSON.stringify(room),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(!result)throw new Error('The table changed. Refresh and try your move again.');await compFinish(env,code,room);}
async function authSeat(room,token){if(typeof token!=='string'||token.length>160)throw new Error('Return with your original seat invitation.');const digest=await hash(token),p=room.seats.findIndex(s=>s?.credential===digest);if(p<0)throw new Error('This seat credential is invalid.');return p;}
function responseRoom(code,room,p,token){return {code,seat:p,rated:!!room.rated,tournament:room.tournament||null,...(token?{token}:{}),clock:room.clock||null,timeoutSeats:room.timeoutSeats||[],serverNow:Date.now(),game:playerView(room.game,p)};}
async function profileHandler(request,env,url){
 const user=request.headers.get('oai-authenticated-user-id');
 if(request.method==='GET'&&!user)return json({signedIn:false,profile:null});
 if(!user)return json({error:'Sign in to create your Khasino profile.'},401);
 if(!env.BUCKET)return json({error:'Profiles are temporarily unavailable. Guest play is ready.'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed.'},405);
 const key='players/'+await hash(user);
 try{
  const old=await env.BUCKET.get(key),existing=old?JSON.parse(await old.text()):null;
  if(request.method==='GET')return json({signedIn:true,profile:existing});
  if(request.headers.get('Origin')!==url.origin)return json({error:'Save your profile from this site.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON.'},415);
  const raw=await request.text();if(raw.length>2000)return json({error:'Profile is too large.'},413);
  let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid profile.'},400);}
  if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid profile.'},400);
  const displayName=validateName(data.displayName),now=Date.now();
  const profile={displayName,createdAt:existing?.createdAt??now,updatedAt:now};
  const saved=await env.BUCKET.put(key,JSON.stringify(profile),{onlyIf:old?{etagMatches:old.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(!saved)return json({error:'Your profile changed. Reopen it and try again.'},409);
  return json({signedIn:true,profile},existing?200:201);
 }catch(error){return json({error:error.message||'Could not load your profile.'},400);}
}
async function apiHandler(request,env,url){
 if(!env.BUCKET)return json({error:'Online rooms are unavailable in this deployment. Offline play is ready.'},503);
 if(request.method!=='POST')return json({error:'Use the room interface.'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Open the room from this site.'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected a JSON room command.'},415);
 const raw=await request.text();if(raw.length>12000)return json({error:'Room command is too large.'},413);let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid room command.'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Invalid room command.'},400);
 try{
  if(url.pathname==='/api/rooms'){
   let name=validateName(data.name);const players=data.players,teams=data.teams===true,rated=data.rated===true;const competitor=await compSeat(request,env,rated,teams?'teams':String(players));if(rated)name=competitor.name;if(![2,3,4].includes(players)||teams&&players!==4)throw new Error('Choose a supported table size.');
   const user=request.headers.get('oai-authenticated-user-id')||request.headers.get('CF-Connecting-IP')||'anonymous';const limitKey='limits/'+await hash(user+new Date().toISOString().slice(0,10));const prev=await env.BUCKET.get(limitKey);const count=prev?Number(await prev.text()):0;if(count>=12)return json({error:'You have created enough tables for today. Rejoin an existing room or play offline.'},429);const limited=await env.BUCKET.put(limitKey,String(count+1),{onlyIf:prev?{etagMatches:prev.etag}:{etagDoesNotMatch:'*'}});if(!limited)throw new Error('Please wait a moment before creating another table.');
   const code=roomCode(),token=secret(),names=[name,...Array(players-1).fill('Open seat')],game=createGame({players,teams,names});game.status='lobby';const room={created:Date.now(),expires:Date.now()+12*60*60*1000,rated,competitionMatchId:crypto.randomUUID(),seats:[{...competitor,name,credential:await hash(token)},...Array(players-1).fill(null)],game,commands:[]};await writeRoom(env,code,room);return json(responseRoom(code,room,0,token),201);
  }
  const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|move|rematch|leave|resume))?$/);if(!match)return json({error:'Room route not found.'},404);const [,code,operation]=match;const {room,etag}=await roomRead(env,code);
  if(operation==='join'){
   if(room.tournament||room.seats.every(s=>s?.pid))throw new Error('Enter this match through the competition screen.');
   if(room.game.status!=='lobby')throw new Error('This table has already started.');const p=room.seats.findIndex(s=>!s);if(p<0)throw new Error('This table is full.');const competitor=await compSeat(request,env,room.rated,compMode(room.game));if(room.rated&&room.seats.some(s=>s?.pid===competitor.pid))throw new Error('Each rated seat needs a different account.');const name=room.rated?competitor.name:validateName(data.name),token=secret();room.seats[p]={...competitor,name,credential:await hash(token)};room.game.names[p]=name;room.game.version++;if(room.seats.every(Boolean))room.game.status='playing';await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p,token));
  }
  const p=await authSeat(room,data.token);
  if(room.rated){const player=await compPlayer(request,env);if(room.seats[p].pid!==player.pid)throw new Error('This rated seat belongs to another account.');}
  if(advanceClock(room)){await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p));}
  if(operation==='resume'){if(room.timeoutSeats?.[p]){room.timeoutSeats[p].bot=false;room.timeoutSeats[p].missed=0;if(room.game.turn===p)room.clock=null;}await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p));}
  if(operation==='leave'){room.game=answerLeaveOffer(room.game,p,data.offer,data.yes);await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p));}
  if(!operation)return json(responseRoom(code,room,p));
  if(operation==='move'){
   if(typeof data.command!=='string'||data.command.length>80)throw new Error('Missing move identifier.');
   if(room.commands.some(c=>c.id===data.command&&c.seat===p))return json(responseRoom(code,room,p));
   if(data.version!==room.game.version)return json({error:'The table changed. Your hand has been refreshed; choose your move again.'},409);
   room.game=beginLeaveOffer(room.game,p,data.actions);if(room.timeoutSeats?.[p])room.timeoutSeats[p].missed=0;room.commands.push({id:data.command,seat:p});room.commands=room.commands.slice(-80);await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p));
  }
  if(operation==='rematch'){
   if(room.tournament)throw new Error('Return to the tournament for your next match.');
   if(p!==0)throw new Error('The room creator deals the rematch.');if(room.game.status!=='ended')throw new Error('Finish this hand before dealing again.');if(data.version!==room.game.version)throw new Error('The table changed. Refresh before dealing.');const version=room.game.version+1;room.game=createGame({players:room.game.players,teams:room.game.teams,names:room.game.names,dealer:(room.game.dealer+1)%room.game.players});room.game.version=version;room.commands=[];room.clock=null;room.timeoutSeats=null;room.competitionMatchId=crypto.randomUUID();if(room.rated)for(const s of room.seats)s.rating=await compRating(env,s.pid,compMode(room.game));await writeRoom(env,code,room,etag);return json(responseRoom(code,room,p));
  }
 }catch(error){return json({error:error.message||'Room service unavailable.'},error.message?.includes('changed')?409:400);}
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/competition/'))return competitiveHandler(request,env,url);
 if(url.pathname==='/api/profile')return profileHandler(request,env,url);
 if(url.pathname.startsWith('/api/'))return apiHandler(request,env,url);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const asset=ASSETS[url.pathname];if(!asset)return new Response('Not found',{status:404});
 const [body,type]=asset;return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"}});
}};
