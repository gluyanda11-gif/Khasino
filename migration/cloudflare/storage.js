// D1 implements the conditional object operations used by the room server.
export class D1Bucket {
 constructor(db){this.db=db;}
 async get(key){const r=await this.db.prepare('SELECT value,etag FROM objects WHERE key=?').bind(key).first();return r?{etag:r.etag,text:async()=>r.value}:null;}
 async put(key,value,options={}){
  const etag=crypto.randomUUID(),c=options.onlyIf;let q,args;
  if(c?.etagMatches){q='UPDATE objects SET value=?,etag=? WHERE key=? AND etag=?';args=[value,etag,key,c.etagMatches];}
  else if(c?.etagDoesNotMatch==='*'){q='INSERT OR IGNORE INTO objects(key,value,etag) VALUES(?,?,?)';args=[key,value,etag];}
  else {q='INSERT INTO objects(key,value,etag) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,etag=excluded.etag';args=[key,value,etag];}
  const r=await this.db.prepare(q).bind(...args).run();return r.meta.changes?{etag}:null;
 }
 async delete(key){await this.db.prepare('DELETE FROM objects WHERE key=?').bind(key).run();}
 async list({prefix='',cursor,limit=1000}={}){
  const n=Math.min(1000,Math.max(1,limit));const r=await this.db.prepare('SELECT key FROM objects WHERE substr(key,1,?)=? AND key>? ORDER BY key LIMIT ?').bind(prefix.length,prefix,cursor||'',n+1).all();
  const truncated=r.results.length>n,objects=r.results.slice(0,n).map(r=>({key:r.key}));return {objects,truncated,cursor:truncated?objects.at(-1).key:undefined};
 }
}
