export const MAX_FILES = 20
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024

export function slugify(value='scene') {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64) || 'scene'
}

export function isPublicHttps(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)
  } catch { return false }
}

export function validateAdd(existingCount, existingBytes, incoming=[]) {
  const bytes = incoming.reduce((s,f)=>s+(Number(f.size)||0),0)
  if (existingCount + incoming.length > MAX_FILES) return {ok:false,error:`Limit is ${MAX_FILES} assets per scene.`}
  if (existingBytes + bytes > MAX_TOTAL_BYTES) return {ok:false,error:'Keep total local scene assets under 100 MB.'}
  return {ok:true}
}

export function buildSceneUrl(base, scene) {
  if (!isPublicHttps(base)) throw new Error('A public HTTPS AR base URL is required before publishing.')
  const url = new URL(base)
  url.pathname = url.pathname.replace(/\/$/,'') + '/'
  url.searchParams.set('src', scene.src)
  url.searchParams.set('name', scene.title || scene.name || 'AR scene')
  url.searchParams.set('scale', String(scene.settings?.scale ?? 1))
  url.searchParams.set('yaw', String(scene.settings?.yaw ?? 0))
  url.searchParams.set('autoplay', scene.settings?.autoplay === false ? '0' : '1')
  url.searchParams.set('spin', scene.settings?.autoRotate ? '1' : '0')
  url.searchParams.set('shadow', String(scene.settings?.shadow ?? 1))
  url.searchParams.set('exposure', String(scene.settings?.exposure ?? 1))
  url.searchParams.set('arscale', scene.settings?.arScale || 'auto')
  if (scene.trigger?.type === 'geo') {
    url.searchParams.set('trigger','geo')
    url.searchParams.set('lat',String(scene.trigger.lat))
    url.searchParams.set('lng',String(scene.trigger.lng))
    url.searchParams.set('radius',String(scene.trigger.radius || 100))
  }
  if (scene.claimLimit) url.searchParams.set('claims',String(scene.claimLimit))
  return url.toString()
}

export function haversineMeters(a,b) {
  const R=6371000
  const rad=d=>d*Math.PI/180
  const dLat=rad(b.lat-a.lat), dLng=rad(b.lng-a.lng)
  const x=Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))
}

export function withinGeofence(user,target,radius=100) {
  return haversineMeters(user,target) <= Number(radius)
}
