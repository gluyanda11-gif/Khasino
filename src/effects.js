// Public-state events only; hidden hands are never inspected.
export function mummyEvent(previous,next){
 if(!previous||!next||next.version===previous.version)return null;
 const has=c=>c.id==='D10',oldPile=previous.piles.findIndex(p=>p.some(has)),newPile=next.piles.findIndex(p=>p.some(has));
 if(newPile>=0&&newPile!==oldPile)return {type:'chow',player:newPile};
 const contains=t=>t.kind==='loose'?has(t.card):t.groups.some(g=>g.some(has));
 const item=next.table.find(contains);if(item&&!previous.table.some(contains))return {type:'place',item:item.id};
 return null;
}
