import * as ollama from './ollama-provider.js';
import { relayChat, relayStatus } from './mac-ai-relay.js';

const bridgeUrl = () => String(process.env.MAC_AI_BRIDGE_URL || '').replace(/\/$/, '');
const bridgeToken = () => process.env.LIV8_MAC_BRIDGE_TOKEN || '';

async function bridgeFetch(path, options = {}) {
  const res = await fetch(`${bridgeUrl()}${path}`, { ...options, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${bridgeToken()}`, ...(options.headers||{}) }, signal: options.signal || AbortSignal.timeout(120000) });
  const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||`Mac AI bridge HTTP ${res.status}`); return data;
}

export async function localAiStatus() {
  if (bridgeUrl() && bridgeToken()) {
    try { return await bridgeFetch('/api/ai/bridge/status',{method:'GET',signal:AbortSignal.timeout(6000)}).then(x=>({...x,remote:true,route:'mac-bridge'})); }
    catch (error) { const s=relayStatus(); if(s.connected)return {ok:true,provider:'ollama',remote:true,route:'outbound-relay',bridgeError:error.message,...s}; return {ok:false,provider:'ollama',remote:true,route:'mac-bridge',error:error.message,...s}; }
  }
  if (bridgeToken() && process.env.NODE_ENV === 'production') { const s=relayStatus(); return { ok:s.connected, provider:'ollama',remote:true,route:'outbound-relay',...s }; }
  return ollama.status();
}

export async function localAiChat(messages, options={}) {
  const payload={messages,model:options.model,fast:options.fast===true,systemPrompt:options.systemPrompt,maxTokens:options.maxTokens,temperature:options.temperature};
  if (bridgeUrl() && bridgeToken()) { try { return await bridgeFetch('/api/ai/bridge/chat',{method:'POST',body:JSON.stringify(payload)}); } catch (error) { if(relayStatus().connected)return relayChat(payload,options.timeoutMs); throw error; } }
  if (bridgeToken() && process.env.NODE_ENV === 'production') return relayChat(payload, options.timeoutMs);
  return ollama.chat(messages,options);
}
