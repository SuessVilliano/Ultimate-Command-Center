import test from 'node:test'
import assert from 'node:assert/strict'
import {MAX_FILES,buildSceneUrl,haversineMeters,isPublicHttps,slugify,validateAdd,withinGeofence} from '../src/scene-utils.js'

test('slugify creates safe aliases',()=>assert.equal(slugify(' Jovi Siren Head! '),'jovi-siren-head'))
test('publish requires public HTTPS',()=>{assert.equal(isPublicHttps('https://ar.elevate.co'),true);assert.equal(isPublicHttps('http://localhost:5173'),false);assert.throws(()=>buildSceneUrl('http://localhost:5173',{src:'https://x.test/a.glb'}))})
test('scene URL carries transforms and geo trigger',()=>{const u=new URL(buildSceneUrl('https://ar.elevate.co/',{src:'https://cdn.test/a.glb',title:'Siren',settings:{scale:2,yaw:45},trigger:{type:'geo',lat:28.2,lng:-82.3,radius:50}}));assert.equal(u.protocol,'https:');assert.equal(u.searchParams.get('scale'),'2');assert.equal(u.searchParams.get('trigger'),'geo');assert.equal(u.searchParams.get('radius'),'50')})
test('asset limit rejects overflow without deleting anything',()=>assert.equal(validateAdd(MAX_FILES,0,[{size:1}]).ok,false))
test('haversine/geofence works',()=>{const a={lat:28.182,lng:-82.35},near={lat:28.1821,lng:-82.35},far={lat:28.2,lng:-82.35};assert.ok(haversineMeters(a,near)<20);assert.equal(withinGeofence(a,near,25),true);assert.equal(withinGeofence(a,far,25),false)})
