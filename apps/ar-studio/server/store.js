import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const file = process.env.AR_STORE_PATH || path.join(process.cwd(), '.ar-studio-data.json')
let state = {scenes:{},events:[],claims:{}}
try { state = {...state,...JSON.parse(fs.readFileSync(file,'utf8'))} } catch {}

function persist(){
  const dir=path.dirname(file); fs.mkdirSync(dir,{recursive:true})
  const tmp=`${file}.${process.pid}.tmp`; fs.writeFileSync(tmp,JSON.stringify(state,null,2)); fs.renameSync(tmp,file)
}
export function listScenes(){ return Object.values(state.scenes).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))) }
export function getScene(id){ return state.scenes[id] || Object.values(state.scenes).find(s=>s.slug===id) || null }
export function saveScene(scene){
  const now=new Date().toISOString(), id=scene.id || crypto.randomUUID()
  const prior=state.scenes[id]
  const record={...prior,...scene,id,createdAt:prior?.createdAt||now,updatedAt:now}
  state.scenes[id]=record; persist(); return record
}
export function addEvent(event){ state.events.push({...event,id:crypto.randomUUID(),at:new Date().toISOString()}); state.events=state.events.slice(-5000); persist() }
export function claim(sceneId,token,limit){
  const key=String(sceneId), claims=state.claims[key] ||= []
  if (claims.some(c=>c.token===token)) return {ok:true,duplicate:true,count:claims.length,remaining:Math.max(0,limit-claims.length)}
  if (limit>0 && claims.length>=limit) return {ok:false,soldOut:true,count:claims.length,remaining:0}
  claims.push({token,at:new Date().toISOString()}); persist()
  return {ok:true,duplicate:false,count:claims.length,remaining:limit>0?Math.max(0,limit-claims.length):null}
}
export function resetForTests(){ state={scenes:{},events:[],claims:{}} }
