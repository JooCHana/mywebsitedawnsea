import test from 'node:test';
import assert from 'node:assert/strict';
import {escape,hashPassword,verifyPassword,canRead,uploadType} from '../src/security.js';
test('passwords are salted and verify without plaintext storage',async()=>{const hash=await hashPassword('Test-Password-123');assert.ok(!hash.includes('Test-Password'));assert.ok(await verifyPassword('Test-Password-123',hash));assert.ok(!await verifyPassword('wrong',hash));assert.notEqual(hash,await hashPassword('Test-Password-123'));});
test('visibility rejects unauthorized readers',()=>{assert.ok(canRead(null,{visibility:'public'}));assert.ok(!canRead(null,{visibility:'members'}));assert.ok(canRead({role:'member'},{visibility:'members'}));assert.ok(!canRead({role:'member'},{visibility:'private'}));assert.ok(canRead({role:'admin'},{visibility:'private'}));assert.ok(!canRead(null,null));});
test('stored content is escaped',()=>assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;'));
test('upload magic rejects scripts',()=>{assert.equal(uploadType(new TextEncoder().encode('<script>alert(1)</script>')),null);assert.equal(uploadType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');});
