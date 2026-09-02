#!/usr/bin/env node
const api=String(process.env.LIV8_COMMAND_API_URL||'https://liv8-command-center-api.onrender.com').replace(/\/$/,'');
const token=process.env.LIV8_MAC_BRIDGE_TOKEN;
const ollama=String(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
if(!token){console.error('Missing LIV8_MAC_BRIDGE_TOKEN');process.exit(1)}
const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`,'x-liv8-worker':process.env.COMPUTERNAME||process.env.HOSTNAME||'mac-mini'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function complete(id,body){await fetch(`${api}/api/ai/mac-relay/jobs/${id}/complete`,{method:'POST',headers,body:JSON.stringify(body)})}
async function run(job){try{const p=job.payload||{},model=p.model||(p.fast?'gemma3:4b':'qwen3:8b');const messages=p.systemPrompt?[{role:'system',content:p.systemPrompt},...(p.messages||[])]:p.messages||[];const r=await fetch(`${ollama}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,stream:false,options:{temperature:p.temperature??0.7,num_predict:p.maxTokens||1024}})});const data=await r.json();if(!r.ok)throw new Error(data.error||`Ollama HTTP ${r.status}`);await complete(job.id,{ok:true,result:{text:data.message?.content||'',model,provider:'ollama',via:'outbound-relay'}})}catch(e){await complete(job.id,{ok:false,error:e.message})}}
console.log(`LIV8 Mac AI worker connecting ${api} to ${ollama}`);
while(true){try{await fetch(`${api}/api/ai/mac-relay/heartbeat`,{method:'POST',headers,body:JSON.stringify({worker:headers['x-liv8-worker']})});const r=await fetch(`${api}/api/ai/mac-relay/claim`,{headers});if(r.ok){const {job}=await r.json();if(job)await run(job)}else await sleep(3000)}catch(e){console.error(new Date().toISOString(),e.message);await sleep(3000)}}
