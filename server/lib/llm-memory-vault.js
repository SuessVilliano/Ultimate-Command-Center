import * as db from './database.js';

function getDb(){ const d=db.getDb?.(); if(!d) throw new Error('SQLite unavailable'); return d; }
const now=()=>new Date().toISOString();

export function initMemoryVault(){
  const d=getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS llm_memory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT DEFAULT CURRENT_TIMESTAMP,
      source TEXT DEFAULT 'juno',
      agent TEXT DEFAULT '',
      domain TEXT DEFAULT 'general',
      item_type TEXT DEFAULT 'conversation',
      title TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5,
      entities_json TEXT DEFAULT '[]',
      tags_json TEXT DEFAULT '[]',
      source_url TEXT,
      source_ref TEXT,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_llm_memory_ts ON llm_memory_items(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_llm_memory_domain ON llm_memory_items(domain);
    CREATE INDEX IF NOT EXISTS idx_llm_memory_source ON llm_memory_items(source);
    CREATE INDEX IF NOT EXISTS idx_llm_memory_type ON llm_memory_items(item_type);
  `);
}

function arr(v){ return Array.isArray(v)?v:[]; }
export function addMemory(m={}){
  initMemoryVault();
  const d=getDb();
  const r=d.prepare(`INSERT INTO llm_memory_items
    (ts,source,agent,domain,item_type,title,summary,content,importance,entities_json,tags_json,source_url,source_ref,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      m.ts||now(), m.source||'juno', m.agent||'', m.domain||'general', m.item_type||'conversation',
      m.title||'', m.summary||'', String(m.content||''), Math.max(1,Math.min(10,Number(m.importance||5))),
      JSON.stringify(arr(m.entities)), JSON.stringify(arr(m.tags)), m.source_url||null, m.source_ref||null,
      JSON.stringify(m.metadata||{})
    );
  return getMemory(r.lastInsertRowid);
}
export function getMemory(id){ initMemoryVault(); return getDb().prepare('SELECT * FROM llm_memory_items WHERE id=?').get(id); }
export function listMemories({limit=200,domain,source,type,q}={}){
  initMemoryVault(); let sql='SELECT * FROM llm_memory_items WHERE 1=1'; const p=[];
  if(domain){sql+=' AND domain=?';p.push(domain);} if(source){sql+=' AND source=?';p.push(source);} if(type){sql+=' AND item_type=?';p.push(type);}
  if(q){sql+=' AND (LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(content) LIKE ?)'; const x=`%${String(q).toLowerCase()}%`;p.push(x,x,x);}
  sql+=' ORDER BY datetime(ts) DESC, id DESC LIMIT ?'; p.push(Math.min(1000,Number(limit)||200));
  return getDb().prepare(sql).all(...p);
}
export function stats(){
  initMemoryVault(); const d=getDb();
  return {
    total:d.prepare('SELECT COUNT(*) n FROM llm_memory_items').get().n,
    byDomain:d.prepare('SELECT domain,COUNT(*) n FROM llm_memory_items GROUP BY domain ORDER BY n DESC').all(),
    bySource:d.prepare('SELECT source,COUNT(*) n FROM llm_memory_items GROUP BY source ORDER BY n DESC').all(),
    highImportance:d.prepare('SELECT COUNT(*) n FROM llm_memory_items WHERE importance>=8').get().n,
  };
}
export function searchContext(query,limit=20){ return listMemories({q:query,limit}); }
