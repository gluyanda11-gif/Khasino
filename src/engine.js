/* Shared rules. No browser/network dependencies. */
export const SUITS=['S','H','C','D'];
export const SYMBOLS={S:'♠',H:'♥',C:'♣',D:'♦'};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function deck(){return SUITS.flatMap(suit=>Array.from({length:10},(_,i)=>({id:suit+(i+1),suit,rank:i+1})));}
export function shuffle(cards,random=()=>{let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}){const d=clone(cards);for(let i=d.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
export const value=c=>c.rank;
export const points=c=>c.rank===1?1:c.id==='S2'?1:c.id==='D10'?2:0;
export const label=c=>(c.rank===1?'A':c.rank)+SYMBOLS[c.suit];
export function side(g,p){return g.teams?p%2:p;}
export function sameSide(g,p,q){return side(g,p)===side(g,q);}
function fail(message){throw new Error(message);}
function check(condition,message){if(!condition)fail(message);}
export function createGame({players=2,teams=false,names=[],dealer=0}={},cards=shuffle(deck())){
 check([2,3,4].includes(players),'Choose 2, 3 or 4 players.');check(!teams||players===4,'Partnerships need four players.');
 check(cards.length===40&&new Set(cards.map(c=>c.id)).size===40,'The deck must contain 40 unique cards.');
 const g={schema:1,profile:'sa40-user-v1',players,teams,names:Array.from({length:players},(_,i)=>names[i]||'Player '+(i+1)),dealer,turn:(dealer+1)%players,phase:1,hands:Array.from({length:players},()=>[]),piles:Array.from({length:players},()=>[]),table:[],deck:clone(cards),lastCapture:null,version:0,status:'playing',log:[],nextBuild:1,evidence:Array.from({length:players},()=>[]),pending:null};
 const n=players===3?13:10;
 for(let i=0;i<n;i++)for(let j=1;j<=players;j++)g.hands[(dealer+j)%players].push(g.deck.shift());
 if(players===3)g.table.push({id:'loose-'+g.deck[0].id,kind:'loose',card:g.deck.shift()});
 for(const h of g.hands)h.sort((a,b)=>a.rank-b.rank||a.suit.localeCompare(b.suit));assertInvariants(g);return g;
}
export function buildCards(item){return item.kind==='loose'?[item.card]:item.groups.flat();}
export function buildTop(item){return item.kind==='loose'?item.card:item.groups.at(-1).at(-1);}
function find(g,id){const t=g.table.find(x=>x.id===id);check(t,'That table card or build is no longer available.');return t;}
function getHand(g,p,id){const c=g.hands[p].find(c=>c.id===id);check(c,'That card is not in your hand.');return c;}
function takeHand(g,p,id){const c=getHand(g,p,id);g.hands[p]=g.hands[p].filter(x=>x.id!==id);g.evidence[p]=g.evidence[p].filter(r=>r!==c.rank);return c;}
function consume(g,p,a,ctx){if(!a.card)return null;check(ctx.played===0,'Play exactly one hand card per turn.');const c=takeHand(g,p,a.card);ctx.played++;return c;}
function tableLoose(g,ids=[]){check(new Set(ids).size===ids.length,'A card cannot be used twice.');return ids.map(id=>{const t=find(g,id);check(t.kind==='loose','A build cannot be broken apart.');return t;});}
function remove(g,ids){g.table=g.table.filter(t=>!ids.includes(t.id));}
function reservation(g){for(let p=0;p<g.players;p++){const builds=g.table.filter(t=>t.kind==='build'&&t.owner===p);check(builds.length<=2,'Too many owned builds.');for(const b of builds)if(!g.hands[p].some(c=>c.hidden))check(g.hands[p].some(c=>c.rank===b.value),'Keep a '+b.value+' in your hand to capture your build.');}}
function owned(g,p){return g.table.filter(t=>t.kind==='build'&&t.owner===p);}
function addLog(g,text){g.log.unshift(text);g.log=g.log.slice(0,25);}
function remember(g,b){if(!g.evidence[b.owner].includes(b.value))g.evidence[b.owner].push(b.value);}
function sorted(cs){return cs.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id));}
// Maximum disjoint loose-card subset whose cards can partition into groups of rank.
export function captureIds(g,rank){
 const matched=g.table.filter(t=>t.kind==='build'&&t.value===rank).map(t=>t.id);
 const loose=g.table.filter(t=>t.kind==='loose'&&t.card.rank<=rank);
 const direct=loose.filter(t=>t.card.rank===rank);matched.push(...direct.map(t=>t.id));
 const rest=loose.filter(t=>t.card.rank<rank);if(!rest.length)return matched;
 // Every group totals <=10: enumerate reachable masks and combine disjoint groups.
 const groups=[];function visit(start,sum,ids){if(sum===rank){groups.push(ids);return;}for(let i=start;i<rest.length;i++)if(sum+rest[i].card.rank<=rank)visit(i+1,sum+rest[i].card.rank,[...ids,rest[i].id]);}
 visit(0,0,[]);
 // Deterministic memoized set packing. Cap search for pathological layouts.
 let budget=18000;const memo=new Map();function solve(available){const key=available.join('|');if(memo.has(key))return memo.get(key);if(--budget<=0)return [];
 const aset=new Set(available);let best=[];for(const ids of groups){if(!ids.every(id=>aset.has(id)))continue;const next=[...ids,...solve(available.filter(id=>!ids.includes(id)))];const score=xs=>xs.reduce((n,id)=>n+100+points(rest.find(t=>t.id===id).card),0);if(score(next)>score(best)||score(next)===score(best)&&next.slice().sort().join()<best.slice().sort().join())best=next;}memo.set(key,best);return best;}
 return [...matched,...solve(rest.map(t=>t.id))];
}
// Complete one exposed-card group at a time; never reach through a pile.
function augmentationGroup(g,p,rank){
 const candidates=[...g.table.filter(t=>t.kind==='loose'&&t.card.rank<=rank).map(t=>({card:t.card,item:t.id})),...g.piles.flatMap((pile,q)=>!sameSide(g,p,q)&&pile.length&&pile.at(-1).rank<=rank?[{card:pile.at(-1),pile:q}]:[])].sort((a,b)=>b.card.rank-a.card.rank||a.card.id.localeCompare(b.card.id));
 function search(start,sum,chosen){if(sum===rank)return chosen;for(let i=start;i<candidates.length;i++)if(sum+candidates[i].card.rank<=rank){const result=search(i+1,sum+candidates[i].card.rank,[...chosen,candidates[i]]);if(result)return result;}return null;}
 return search(0,0,[]);
}
function collectAugmentation(g,p,b){let groups=0;while(true){const group=augmentationGroup(g,p,b.value);if(!group)break;remove(g,group.filter(x=>x.item).map(x=>x.item));for(const source of group.filter(x=>x.pile!==undefined))g.piles[source.pile].pop();b.groups.push(sorted(group.map(x=>x.card)));groups++;}return groups;}
function exposedSources(g,p,sources=[]){check(Array.isArray(sources),'Invalid captured-pile selection.');check(sources.every(q=>Number.isInteger(q)&&q>=0&&q<g.players&&!sameSide(g,p,q)),'Only opponent capture tops can be used in a build.');check(new Set(sources).size===sources.length,'Use each exposed pile top once per added group.');return sources.map(q=>{check(g.piles[q].length,'That captured pile is empty.');return g.piles[q].at(-1);});}
function action(g,p,a,ctx){
 check(a&&typeof a.type==='string','Invalid action.');const who=g.names[p];
 if(a.type==='discard'){
  check(!(g.players===2&&g.phase===1&&owned(g,p).length),'Capture or strengthen your build before drifting in the first deal.');
  const c=consume(g,p,a,ctx);check(c,'Choose a card.');const ids=captureIds(g,c.rank);check(!ids.length,'That card can chow. Choose Chow, or use it in a build.');g.table.push({id:'loose-'+c.id,kind:'loose',card:c});addLog(g,who+' drifted '+label(c));
 }else if(a.type==='drift'){
  let items=tableLoose(g,a.items||[]);const sources=a.piles||[],tops=exposedSources(g,p,sources),hand=getHand(g,p,a.card),rank=hand.rank;const selectedBase=sources.length?items.find(t=>t.card.rank===rank):null;if(selectedBase)items=items.filter(t=>t.id!==selectedBase.id);
  check((items.length||tops.length)&&[...items.map(t=>t.card),...tops].reduce((n,c)=>n+c.rank,0)===rank,'Select loose cards or exposed opponent tops matching your hand card.');
  check(g.hands[p].some(c=>c.rank===rank&&c.id!==hand.id),'Keep another '+rank+' in your hand to chow later.');
  const existing=g.table.find(t=>t.kind==='build'&&t.value===rank),base=sources.length&&!existing?(selectedBase||g.table.find(t=>t.kind==='loose'&&t.card.rank===rank&&!items.some(x=>x.id===t.id))):null;check(!sources.length||existing||base,'Make a '+rank+' base on the table before using an opponent’s captured card.');check(!existing||sameSide(g,p,existing.owner),'An opponent already owns that build.');check(existing||!owned(g,p).length,'Capture your existing build before making another.');
  const c=consume(g,p,a,ctx);remove(g,[...items.map(t=>t.id),...(base?[base.id]:[])]);for(const q of sources)g.piles[q].pop();const groups=[...(base?[[base.card]]:[]),sorted([...items.map(t=>t.card),...tops]),[c]];
  const b=existing||{id:'b'+g.nextBuild++,kind:'build',owner:p,value:rank,groups:[]};b.groups.push(...groups);if(!existing)g.table.push(b);collectAugmentation(g,p,b);addLog(g,who+' drifted '+label(c)+' into a '+rank+' build');
 }else if(a.type==='capture'){
  const card=getHand(g,p,a.card);check(!g.table.some(t=>t.kind==='build'&&t.value===card.rank&&t.owner!==p&&sameSide(g,p,t.owner)),'You cannot chow your partner’s build.');let captureBase=null;
  if(a.piles?.length){const tops=exposedSources(g,p,a.piles);const existing=g.table.find(t=>t.kind==='build'&&t.value===card.rank);if(!existing){const selected=tableLoose(g,a.items||[]),base=selected.find(t=>t.card.rank===card.rank)||g.table.find(t=>t.kind==='loose'&&t.card.rank===card.rank);check(base,'Make a '+card.rank+' base on the table before using an opponent’s captured card.');captureBase='b'+g.nextBuild++;remove(g,[base.id]);g.table.push({id:captureBase,kind:'build',owner:p,value:card.rank,groups:[[base.card]]});}const b=g.table.find(t=>t.kind==='build'&&t.value===card.rank);collectAugmentation(g,p,b);check(tops.every(c=>buildCards(b).some(x=>x.id===c.id)),'Selected opponent tops must legally augment the matching base.');}
  for(const b of g.table.filter(t=>t.kind==='build'&&t.value===card.rank))collectAugmentation(g,p,b);
  const ids=captureIds(g,card.rank);check(ids.length,'Nothing on the table matches this card.');
  const targets=ids.map(id=>find(g,id));const c=consume(g,p,a,ctx);
  for(const b of targets.filter(t=>t.kind==='build'&&t.id!==captureBase&&t.owner!==p))remember(g,b);
  const cards=targets.flatMap(buildCards);remove(g,ids);g.piles[p].push(...cards,c);g.lastCapture=p;
  addLog(g,who+' chowed '+(cards.length+1)+' cards with '+label(c));ctx.capture=true;
 }else if(a.type==='build'){
  const items=tableLoose(g,a.items||[]),sources=a.piles||[],tops=exposedSources(g,p,sources);check(items.length+tops.length>0,'Select loose table cards or an opponent’s exposed top card to build.');const hand=a.card?getHand(g,p,a.card):null;const total=[...items.map(t=>t.card),...tops].reduce((n,c)=>n+c.rank,0)+(hand?.rank||0);check(total>=2&&total<=10,'A build must total 2 to 10.');
  const matchingBuild=g.table.find(t=>t.kind==='build'&&t.value===total);const owner=matchingBuild?.owner??a.owner??p;check(owner===p||g.teams&&owner===(p+2)%g.players,'You can only build for yourself or your partner.');
  check(g.hands[owner].some(c=>c.rank===total&&!(owner===p&&c.id===a.card))||(owner!==p&&g.hands[owner].some(c=>c.hidden)),owner===p?'Keep a matching '+total+' to capture this build.':'Your partner must keep a matching '+total+' to capture this build.');
  const existing=g.table.find(t=>t.kind==='build'&&t.value===total),base=sources.length&&!existing?g.table.find(t=>t.kind==='loose'&&t.card.rank===total&&!items.some(x=>x.id===t.id)):null;check(!sources.length||existing||base,'Make a '+total+' base on the table before using an opponent’s captured card.');check(!existing||sameSide(g,p,existing.owner),'An opponent already owns a build of '+total+'.');
  check(existing||owned(g,owner).length===0,'Capture your existing build before making another.');
  const played=consume(g,p,a,ctx);const group=sorted([...items.map(t=>t.card),...tops,...(played?[played]:[])]);remove(g,[...items.map(t=>t.id),...(base?[base.id]:[])]);for(const q of sources)g.piles[q].pop();
  const b=existing||{id:'b'+g.nextBuild++,kind:'build',owner,value:total,groups:base?[[base.card]]:[]};b.groups.push(group);if(!existing)g.table.push(b);collectAugmentation(g,p,b);addLog(g,who+' built '+total+(owner!==p?' for '+g.names[owner]:''));
 }else if(a.type==='raise'){
  const b=find(g,a.build);check(b.kind==='build'&&b.groups.length===1,'Only simple builds can be raised.');check(b.owner===p||!sameSide(g,p,b.owner),'You cannot raise your partner’s build. Add a matching group without changing its value.');const hand=getHand(g,p,a.card);const total=b.value+hand.rank;check(total<=10,'The raised build cannot exceed 10.');
  check(!g.table.some(t=>t.kind==='build'&&t.value===total),'A build of that value already exists.');check(owned(g,p).every(t=>t.id===b.id),'Capture your other build before taking ownership.');check(g.hands[p].some(c=>c.rank===total&&c.id!==hand.id),'Keep a '+total+' to chow the raised build.');remember(g,b);const c=consume(g,p,a,ctx);b.groups[0]=sorted([...b.groups[0],c]);b.value=total;b.owner=p;collectAugmentation(g,p,b);addLog(g,who+' raised a build to '+total);
 }else if(a.type==='augment'||a.type==='stash'){
  const b=find(g,a.build);check(b.kind==='build','Select a build.');const own=sameSide(g,p,b.owner);if(!own)check(!a.card,'Use table cards only when augmenting an opponent’s build.');
  const items=tableLoose(g,a.items||[]);const hand=a.card?getHand(g,p,a.card):null;const sources=a.piles||[];check(sources.every(q=>Number.isInteger(q)&&q>=0&&q<g.players&&!sameSide(g,p,q)),'Only opponent capture tops can augment.');check(new Set(sources).size===sources.length,'Use each exposed pile top once per augmentation.');
  const tops=sources.map(q=>{check(g.piles[q].length,'That captured pile is empty.');return g.piles[q].at(-1);});const cards=[...items.map(t=>t.card),...tops,...(hand?[hand]:[])];check(cards.length&&cards.reduce((n,c)=>n+c.rank,0)===b.value,'The added group must total '+b.value+'.');
  if(a.type==='stash')check(hand&&hand.rank===b.value&&cards.length===1,'Stash adds one matching hand card.');const c=consume(g,p,a,ctx);remove(g,items.map(t=>t.id));for(const q of sources)g.piles[q].pop();b.groups.push(sorted([...items.map(t=>t.card),...tops,...(c?[c]:[])]));
  collectAugmentation(g,p,b);if(!own)ctx.mustCapture.add(b.id);addLog(g,who+' strengthened a '+b.value+' build');
 }else fail('Unknown move.');
 for(const b of g.table.filter(t=>t.kind==='build'&&sameSide(g,p,t.owner)))collectAugmentation(g,p,b);reservation(g);assertInvariants(g);
}
export function executeTurn(input,p,actions){
 check(!input.leaveOffer,'Wait for the Leave it timer.');check(input.status==='playing','This hand is not active.');check(input.turn===p,'It is not your turn.');check(Array.isArray(actions)&&actions.length>0&&actions.length<=20,'Submit between 1 and 20 actions.');
 const mustChow=owned(input,p).length>1;const g=clone(input),ctx={played:0,capture:false,mustCapture:new Set()};for(const a of actions)action(g,p,a,ctx);check(ctx.played===1,'Play exactly one card from your hand before ending the turn.');check([...ctx.mustCapture].every(id=>!g.table.some(t=>t.id===id)),'Capture the opponent build you augmented in this turn.');
 check(!mustChow||(ctx.capture&&owned(g,p).length<owned(input,p).length),'You have two builds. Chow one on this turn.');
 g.version++;g.turn=(p+1)%g.players;
 const played=input.hands[p].find(c=>!g.hands[p].some(x=>x.id===c.id));
 const target=g.table.find(t=>buildCards(t).some(c=>c.id===played.id));
 g.lastMove={version:g.version,actor:p,card:clone(played),type:ctx.capture?'capture':actions.at(-1).type,target:target?.id??null,captured:ctx.capture?g.piles[p].filter(c=>!input.piles[p].some(x=>x.id===c.id)&&c.id!==played.id).map(clone):[]};
 g.recentMoves=[...(input.recentMoves||[]),clone(g.lastMove)].slice(-8);

 if(g.hands.every(h=>h.length===0)){
  if(g.deck.length){for(let i=0;i<10;i++)for(let j=1;j<=g.players;j++)g.hands[(g.dealer+j)%g.players].push(g.deck.shift());g.phase=2;g.turn=(g.dealer+1)%g.players;addLog(g,'Second deal — drifting is now allowed with a reserved capture card.');}
  else{if(g.table.length&&g.lastCapture!==null){g.piles[g.lastCapture].push(...g.table.flatMap(buildCards));g.table=[];}g.status='ended';g.result=score(g);addLog(g,'Hand complete.');}
 }assertInvariants(g);return g;
}
export function previewActions(input,p,actions){const g=clone(input),ctx={played:0,mustCapture:new Set()};for(const a of actions)action(g,p,a,ctx);return g;}
export function score(g){
 const count=g.teams?2:g.players,rows=Array.from({length:count},(_,s)=>({side:s,name:g.teams?'Team '+(s+1):g.names[s],cards:0,spades:0,aces:0,spy:0,mummy:0,mostCards:0,mostSpades:0,total:0}));
 for(let p=0;p<g.players;p++){const r=rows[side(g,p)];for(const c of g.piles[p]){r.cards++;if(c.suit==='S')r.spades++;if(c.rank===1)r.aces++;if(c.id==='S2')r.spy++;if(c.id==='D10')r.mummy+=2;}}
 if(g.players===2||g.teams)for(const [category,field]of [['cards','mostCards'],['spades','mostSpades']]){const max=Math.max(...rows.map(r=>r[category]));const winners=rows.filter(r=>r[category]===max);for(const r of winners)r[field]=2/winners.length;}
 for(const r of rows)r.total=r.aces+r.spy+r.mummy+r.mostCards+r.mostSpades;return rows;
}
export function assertInvariants(g){const cards=[...g.deck,...g.hands.flat(),...g.piles.flat(),...g.table.flatMap(buildCards)];if(cards.some(c=>c.hidden)){const visible=cards.filter(c=>!c.hidden);check(new Set(visible.map(c=>c.id)).size===visible.length,'Visible card conservation failed.');}else check(cards.length===40&&new Set(cards.map(c=>c.id)).size===40,'Card conservation failed.');const vals=[];for(const b of g.table.filter(t=>t.kind==='build')){check(b.value<=10&&b.value>=1,'Invalid build value.');check(b.groups.every(cs=>cs.reduce((n,c)=>n+c.rank,0)===b.value),'Invalid build group.');check(!vals.includes(b.value),'Duplicate build value.');vals.push(b.value);}return true;}
export function playerView(g,p){const v=clone(g);if(v.leaveOffer){delete v.leaveOffer.actions;if(p!==v.leaveOffer.partner)delete v.leaveOffer.answer;}v.hands=v.hands.map((h,q)=>q===p?h:h.map(()=>({hidden:true})));v.deck=g.deck.map(()=>({hidden:true}));return v;}
// One Build control covers new loose-card builds, raising simple builds, and adding groups.
export function buildIntent(g,p,cardId,items=[],piles=[]){
 const hand=getHand(g,p,cardId);
 if(!items.length&&!piles.length&&g.hands[p].some(c=>c.id!==hand.id&&c.rank===hand.rank*2)){const matching=g.table.find(t=>t.kind==='loose'&&t.card.rank===hand.rank);if(matching)items=[matching.id];}
 const selected=items.map(id=>find(g,id)),builds=selected.filter(t=>t.kind==='build'),loose=selected.filter(t=>t.kind==='loose');check(builds.length<=1,'Select one build at a time.');
 const groupSum=hand.rank+loose.reduce((n,t)=>n+t.card.rank,0)+piles.reduce((n,q)=>n+(g.piles[q]?.at(-1)?.rank||0),0);
 if(builds.length){const b=builds[0];if(sameSide(g,p,b.owner)&&hand.rank===b.value&&!loose.length&&!piles.length&&!(b.owner===p&&b.value+hand.rank<=10&&g.hands[p].some(c=>c.id!==hand.id&&c.rank===b.value+hand.rank)))return {value:b.value,action:{type:'augment',card:hand.id,build:b.id,items:[],piles:[]}};if((loose.length||piles.length)&&groupSum===b.value)return {value:b.value,action:{type:'augment',card:hand.id,build:b.id,items:loose.map(t=>t.id),piles}};check(!loose.length&&!piles.length,'To raise a simple build, select only that build and one hand card.');check(b.value+hand.rank<=10,'The highest number you can build is 10.');return {value:b.value+hand.rank,action:{type:'raise',card:hand.id,build:b.id}};}
 check(groupSum<=10,'The highest number you can build is 10.');
 const existing=g.table.find(t=>t.kind==='build'&&t.value===groupSum);
 if(existing&&sameSide(g,p,existing.owner))return {value:groupSum,action:{type:'augment',card:hand.id,build:existing.id,items:loose.map(t=>t.id),piles}};
 const partner=(p+2)%g.players,hasCapture=g.hands[p].some(c=>c.id!==hand.id&&c.rank===groupSum),owner=g.teams&&!hasCapture?partner:p;
 const askOwner=!!(g.teams&&!existing&&hasCapture&&g.evidence[partner]?.includes(groupSum));
 return {value:groupSum,askOwner,action:{type:'build',owner,card:hand.id,items:loose.map(t=>t.id),piles}};
}
function botCandidates(g,p,extended=false){
 const hand=g.hands[p],options=[];const add=(actions,weight)=>{try{const next=executeTurn(g,p,actions);options.push({actions,weight,next});}catch{}};
 for(const c of hand){const ids=captureIds(g,c.rank);if(ids.length){const cs=ids.map(id=>g.table.find(t=>t.id===id)).flatMap(buildCards);add([{type:'capture',card:c.id}],10+cs.reduce((n,t)=>n+points(t)*14+(g.players===2||g.teams?1+(t.suit==='S'?1:0):0),0));}add([{type:'discard',card:c.id}],-c.rank/20-points(c)*3);for(const t of g.table.filter(t=>t.kind==='loose'&&t.card.rank===c.rank))add([{type:'drift',card:c.id,items:[t.id]}],4+points(t.card)*4);}
 const loose=g.table.filter(t=>t.kind==='loose');
 for(const c of hand){for(let q=0;q<g.players;q++)if(!sameSide(g,p,q)&&g.piles[q].length){add([{type:'build',card:c.id,items:[],piles:[q]}],4+points(g.piles[q].at(-1))*5);add([{type:'drift',card:c.id,items:[],piles:[q]}],4); }for(const b of g.table.filter(t=>t.kind==='build')){add([{type:'raise',card:c.id,build:b.id}],4+b.groups.flat().reduce((n,t)=>n+points(t)*5,0));add([{type:'stash',card:c.id,build:b.id}],1);}
  for(const target of new Set(hand.filter(t=>t.id!==c.id).map(t=>t.rank))){const combos=[];function combinations(i,sum,ids){if(sum===target-c.rank){if(ids.length)combos.push(ids);return;}if(combos.length>40)return;for(let k=i;k<loose.length;k++)if(sum+loose[k].card.rank<=target-c.rank)combinations(k+1,sum+loose[k].card.rank,[...ids,loose[k].id]);}if(target>c.rank)combinations(0,0,[]);for(const ids of combos)add([{type:'build',card:c.id,items:ids}],3+ids.reduce((n,id)=>n+points(loose.find(t=>t.id===id).card)*5,0));}
 }
 if(extended){
  for(const c of hand){
   const targets=[...new Set([c.rank,...hand.filter(x=>x.id!==c.id).map(x=>x.rank),...g.table.filter(t=>t.kind==='build'&&sameSide(g,p,t.owner)).map(t=>t.value)])];
   for(const rank of targets){const groups=[];function groupsOf(i,sum,ids){if(sum===rank){groups.push(ids);return;}if(groups.length>=12)return;for(let j=i;j<loose.length;j++)if(sum+loose[j].card.rank<=rank)groupsOf(j+1,sum+loose[j].card.rank,[...ids,loose[j].id]);}groupsOf(0,0,[]);
    if(rank===c.rank)for(const ids of groups){add([{type:'drift',card:c.id,items:ids}],4);add([{type:'build',items:ids},{type:'capture',card:c.id}],10);}
    for(const b of g.table.filter(t=>t.kind==='build'&&sameSide(g,p,t.owner)&&t.value===rank)){const remaining=rank-c.rank;if(remaining>0){const combos=[];function sums(i,sum,ids){if(sum===remaining){combos.push(ids);return;}if(combos.length>=8)return;for(let j=i;j<loose.length;j++)if(sum+loose[j].card.rank<=remaining)sums(j+1,sum+loose[j].card.rank,[...ids,loose[j].id]);}sums(0,0,[]);for(const ids of combos)add([{type:'augment',build:b.id,card:c.id,items:ids}],5);}}
   }
   if(g.teams){const partner=(p+2)%g.players;for(const rank of g.evidence[partner]||[]){const remain=rank-c.rank;if(remain<=0)continue;const combos=[];function partnerGroups(i,sum,ids){if(sum===remain){combos.push(ids);return;}if(combos.length>=8)return;for(let j=i;j<loose.length;j++)if(sum+loose[j].card.rank<=remain)partnerGroups(j+1,sum+loose[j].card.rank,[...ids,loose[j].id]);}partnerGroups(0,0,[]);for(const ids of combos)add([{type:'build',owner:partner,card:c.id,items:ids}],5);}}
   for(let q=0;q<g.players;q++)if(!sameSide(g,p,q)&&g.piles[q].length){add([{type:'capture',card:c.id,piles:[q]}],12);for(const t of loose.filter(t=>t.card.rank===c.rank))add([{type:'drift',card:c.id,items:[t.id],piles:[q]}],5);}
  }
 }
 check(options.length,'No legal bot move is available under this profile.');const unique=new Map();for(const o of options){const key=JSON.stringify(o.actions);if(!unique.has(key))unique.set(key,o);}return [...unique.values()];
}

// Small, trainable policy: no remote model and no access to opponents' cards.
export const BOT_WEIGHTS={"points":12,"cards":0.7,"spades":1.1,"future":0.65,"risk":1.1,"control":0.8,"hand":0.15};
export function legacyBotMove(input,p){const g=playerView(input,p);return botCandidates(g,p).sort((a,b)=>b.weight-a.weight)[0].actions;}
export function botBeliefs(input,p){
 const g=playerView(input,p),visible=new Set([...g.hands[p],...g.table.flatMap(buildCards),...g.piles.flat()].map(c=>c.id));
 const unseen=deck().filter(c=>!visible.has(c.id));
 const publicRanks=q=>[...new Set([...g.table.filter(t=>t.kind==='build'&&t.owner===q).map(t=>t.value),...(g.evidence[q]||[])])];
 const forced=Array.from({length:11},()=>0);let allocated=0;for(let q=0;q<g.players;q++)if(q!==p&&g.hands[q].length)for(const rank of publicRanks(q)){forced[rank]++;allocated++;}
 const probability=(q,rank)=>{if(q===p)return g.hands[p].some(c=>c.rank===rank)?1:0;if(!g.hands[q].length)return 0;if(publicRanks(q).includes(rank))return 1;const matches=Math.max(0,unseen.filter(c=>c.rank===rank).length-forced[rank]),n=Math.max(0,unseen.length-allocated),k=Math.min(Math.max(0,g.hands[q].length-publicRanks(q).length),n);let miss=1;for(let i=0;i<k;i++)miss*=Math.max(0,n-matches-i)/(n-i);return 1-miss;};
 return {unseen,publicRanks,probability};
}
function botCardValue(g,c,w){return points(c)*w.points+(g.players===2||g.teams?w.cards+(c.suit==='S'?w.spades:0):0.08);}
function botPosition(g,p,w){
 const belief=botBeliefs(g,p),value=cs=>cs.reduce((n,c)=>n+botCardValue(g,c,w),0);let captured=0;
 for(let q=0;q<g.players;q++)captured+=(sameSide(g,p,q)?1:-1)*value(g.piles[q]);
 if(g.status==='ended'){const rows=score(g),mine=rows[side(g,p)].total,others=rows.filter(r=>r.side!==side(g,p));return 100*(mine-Math.max(...others.map(r=>r.total)));}
 const threats=[];let future=0,control=0;const captures=new Map();
 for(let rank=1;rank<=10;rank++){const ids=captureIds(g,rank),cards=ids.flatMap(id=>buildCards(g.table.find(t=>t.id===id)));if(!cards.length)continue;const v=value(cards);captures.set(rank,{ids,value:v});const own=belief.probability(p,rank);let enemyMiss=1,partner=0;
  for(let step=1;step<g.players;step++){const q=(p+step)%g.players,prob=belief.probability(q,rank);if(sameSide(g,p,q))partner=Math.max(partner,prob*enemyMiss);else{threats.push({q,rank,prob,value:v,ids});enemyMiss*=1-prob;}}
  future=Math.max(future,v*(own*enemyMiss+partner));
 }
 // Expected strongest capture response, then our best recapture of its remainder.
 let danger=0;for(let step=1;step<g.players;step++){const q=(p+step)%g.players;if(sameSide(g,p,q))continue;const replies=threats.filter(t=>t.q===q).sort((a,b)=>b.value-a.value);let unavailable=1,expected=0;for(const r of replies){if(unavailable<0.02)break;const chance=unavailable*r.prob;unavailable*=1-r.prob;if(!chance)continue;const after={...g,table:g.table.filter(t=>!r.ids.includes(t.id))};let recapture=0;for(const rank of new Set(g.hands[p].map(c=>c.rank))){const ids=captureIds(after,rank);recapture=Math.max(recapture,value(ids.flatMap(id=>buildCards(after.table.find(t=>t.id===id)))));}expected+=chance*(r.value-w.future*recapture);}danger=Math.max(danger,expected);}
 for(const b of g.table.filter(t=>t.kind==='build'&&sameSide(g,p,t.owner))){let safe=1;for(let q=0;q<g.players;q++)if(!sameSide(g,p,q))safe*=1-belief.probability(q,b.value);control+=value(buildCards(b))*safe;}
 // Retain flexible capture ranks rather than spending every useful matching card.
 const ranks=new Set(g.hands[p].map(c=>c.rank));let hand=0;for(const rank of ranks)hand+=(captures.get(rank)?.value||0)*0.15+rank/10;
 return captured+w.future*future-w.risk*danger+w.control*control+w.hand*hand;
}
export function botMove(input,p,{weights=BOT_WEIGHTS}={}){
 // Sanitize even if a caller accidentally passes authoritative state.
 const g=playerView(input,p),options=botCandidates(g,p,true);let best=null;
 for(const option of options){const value=botPosition(option.next,p,weights);if(!best||value>best.value+1e-9||Math.abs(value-best.value)<1e-9&&option.weight>best.option.weight)best={option,value};}
 return best.option.actions;
}

// Fixed public window keeps the partner's private answer from leaking timing hints.
export const LEAVE_WINDOW_MS=2000;
export function beginLeaveOffer(input,p,actions,now=Date.now()){
 const capture=actions?.at(-1);if(!input.teams||capture?.type!=='capture')return executeTurn(input,p,actions);
 executeTurn(input,p,actions);const c=getHand(input,p,capture.card);
 const g=clone(input);g.leaveOffer={id:'leave-'+g.version+'-'+c.id,actor:p,partner:(p+2)%g.players,value:c.rank,endsAt:now+LEAVE_WINDOW_MS,actions:clone(actions),answer:null};g.version++;return g;
}
export function answerLeaveOffer(input,p,id,yes,now=Date.now()){
 const o=input.leaveOffer;check(o&&o.id===id,'This request has ended.');check(p===o.partner,'Only the partner can answer.');check(now<o.endsAt,'This request has ended.');check(typeof yes==='boolean','Choose Yes or No.');check(o.answer===null,'Your answer is already recorded.');
 if(yes){check(input.hands[p].some(c=>c.rank===o.value),'You need a '+o.value+' to take ownership.');check(owned(input,p).length<2,'You already have two builds.');check(owned(input,o.actor).length<2,'Your partner must chow one of their two builds this turn.');}
 const g=clone(input);g.leaveOffer.answer=yes;return g;
}
function leaveGroups(cards,rank){
 if(!cards.length)return [];const first=cards[0];
 function search(i,sum,indices){if(sum===rank){const chosen=new Set(indices);try{return [sorted(indices.map(j=>cards[j])),...leaveGroups(cards.filter((_,j)=>!chosen.has(j)),rank)];}catch{return null;}}for(let j=i;j<cards.length;j++)if(sum+cards[j].rank<=rank){const result=search(j+1,sum+cards[j].rank,[...indices,j]);if(result)return result;}return null;}
 const result=search(1,first.rank,[0]);check(result,'Cannot leave an invalid capture group.');return result;
}
export function resolveLeaveOffer(input,now=Date.now()){
 const o=input.leaveOffer;if(!o||now<o.endsAt)return input;
 const g=clone(input);delete g.leaveOffer;
 if(o.answer!==true)return executeTurn(g,o.actor,o.actions);
 const captured=executeTurn(g,o.actor,o.actions).lastMove.captured;
 const prepared=previewActions(g,o.actor,o.actions.slice(0,-1));
 const ids=new Set(captured.map(c=>c.id));let existing=prepared.table.find(t=>t.kind==='build'&&t.value===o.value);
 if(existing)remember(prepared,existing);
 prepared.table=prepared.table.filter(t=>!buildCards(t).some(c=>ids.has(c.id)));
 prepared.piles=prepared.piles.map(pile=>pile.filter(c=>!ids.has(c.id)));
 const b={id:existing?.id||'b'+prepared.nextBuild++,kind:'build',owner:o.partner,value:o.value,groups:leaveGroups(captured,o.value)};prepared.table.push(b);
 const next=executeTurn(prepared,o.actor,[{type:'stash',build:b.id,card:o.actions.at(-1).card}]);
 addLog(next,g.names[o.actor]+' left the '+b.value+' build for '+g.names[o.partner]);return next;
}
