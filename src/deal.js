// Presentation order only. The rules engine owns the actual dealt cards.
export function dealSequence(counts,dealer){
 const delivered=counts.map(()=>0),sequence=[];let batch=0;
 while(delivered.some((n,p)=>n<counts[p])){for(let offset=1;offset<=counts.length;offset++){const seat=(dealer+offset)%counts.length;for(let card=0;card<2&&delivered[seat]<counts[seat];card++)sequence.push({seat,index:delivered[seat]++,batch});batch++;}}
 return sequence;
}
