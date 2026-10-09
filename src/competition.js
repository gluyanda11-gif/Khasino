// Personal records only: these are not server-verified ratings.
export function matchResult(game,seat){
 if(game.status!=='ended'||!Array.isArray(game.result))return null;
 const mine=game.result.find(r=>r.side===(game.teams?seat%2:seat));if(!mine)return null;
 const max=Math.max(...game.result.map(r=>r.total)),tied=game.result.filter(r=>r.total===max).length>1;
 return {outcome:mine.total===max?(tied?'draw':'win'):'loss',points:mine.total,mode:game.teams?'Partnerships':game.players+' players'};
}
export function addResult(record,match){
 const next=structuredClone(record||{seen:[],groups:{},recent:[]});if(next.seen.includes(match.id))return next;
 const key=match.kind+':'+match.mode,s=next.groups[key]??={kind:match.kind,mode:match.mode,wins:0,losses:0,draws:0,streak:0,bestStreak:0};
 s[match.outcome==='win'?'wins':match.outcome==='loss'?'losses':'draws']++;
 s.streak=match.outcome==='win'?s.streak+1:0;s.bestStreak=Math.max(s.bestStreak,s.streak);
 next.seen=[match.id,...next.seen].slice(0,500);next.recent=[match,...next.recent].slice(0,30);return next;
}
export function summarize(record,kind){const rows=Object.values(record?.groups||{}).filter(s=>s.kind===kind);return rows.reduce((a,s)=>({wins:a.wins+s.wins,losses:a.losses+s.losses,draws:a.draws+s.draws,bestStreak:Math.max(a.bestStreak,s.bestStreak)}),{wins:0,losses:0,draws:0,bestStreak:0});}
