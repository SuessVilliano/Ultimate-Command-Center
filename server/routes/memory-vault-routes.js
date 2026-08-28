import * as vault from '../lib/llm-memory-vault.js';

export function registerMemoryVaultRoutes(app){
  vault.initMemoryVault();
  app.get('/api/memory/vault', (req,res)=>{
    try { res.json({ok:true,items:vault.listMemories({limit:+(req.query.limit||200),domain:req.query.domain,source:req.query.source,type:req.query.type,q:req.query.q})}); }
    catch(e){ res.status(500).json({ok:false,error:e.message}); }
  });
  app.get('/api/memory/vault/stats',(req,res)=>{
    try { res.json({ok:true,stats:vault.stats()}); }
    catch(e){ res.status(500).json({ok:false,error:e.message}); }
  });
  app.post('/api/memory/vault',(req,res)=>{
    try { res.json({ok:true,item:vault.addMemory(req.body||{})}); }
    catch(e){ res.status(500).json({ok:false,error:e.message}); }
  });
  app.post('/api/memory/vault/import',(req,res)=>{
    try {
      const rows=Array.isArray(req.body)?req.body:(req.body?.items||[]);
      const saved=rows.filter(x=>x?.content).map(x=>vault.addMemory(x));
      res.json({ok:true,imported:saved.length,items:saved});
    } catch(e){ res.status(500).json({ok:false,error:e.message}); }
  });
}
export default registerMemoryVaultRoutes;
