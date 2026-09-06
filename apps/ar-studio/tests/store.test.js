import test from 'node:test'
import assert from 'node:assert/strict'
import {claim,resetForTests} from '../server/store.js'

test('claims are idempotent per device and respect finite limit',()=>{resetForTests();let a=claim('scene','device-a',2);assert.equal(a.ok,true);assert.equal(a.count,1);let dup=claim('scene','device-a',2);assert.equal(dup.duplicate,true);assert.equal(dup.count,1);let b=claim('scene','device-b',2);assert.equal(b.ok,true);assert.equal(b.count,2);let c=claim('scene','device-c',2);assert.equal(c.ok,false);assert.equal(c.soldOut,true)})
