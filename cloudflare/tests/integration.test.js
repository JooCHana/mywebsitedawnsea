import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {hashPassword} from '../src/security.js';

test('Workers integration: accounts, permissions, comments, upload, range, moderation, bans',async()=>{
 const password='Integration-only-739284!';
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'dist/worker.js',compatibilityDate:'2026-11-03',d1Databases:['DB'],r2Buckets:['MEDIA'],bindings:{ADMIN_USERNAME:'dawnsea',ADMIN_PASSWORD_HASH:await hashPassword(password)}}));
 try {
 const db=await mf.getD1Database('DB');
 for(const sql of readFileSync('migrations/0001_initial.sql','utf8').split(';').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 let ip=1;
 async function req(path,{method='GET',data,cookie='',origin='http://site.test',fixedIp}={}) {
  const headers={'CF-Connecting-IP':fixedIp||'192.0.2.'+(ip++),'Cookie':cookie};if(method==='POST')headers.Origin=origin;
  let body=data?new URLSearchParams(data).toString():undefined;
  if(data instanceof FormData){const encoded=new Request('http://site.test',{method:'POST',body:data});headers['Content-Type']=encoded.headers.get('Content-Type');body=await encoded.arrayBuffer();}else if(data)headers['Content-Type']='application/x-www-form-urlencoded';
  return mf.dispatchFetch('http://site.test'+path,{method,headers,body,redirect:'manual'});
 }
 async function auth(path,username,pw){const page=await req(path),html=await page.text(),id=html.match(/name="challenge" value="([a-f0-9]+)"/)[1],sum=html.match(/验证码：(\d+) \+ (\d+)/);return req(path,{method:'POST',data:{username,password:pw,confirm:pw,challenge:id,answer:String(Number(sum[1])+Number(sum[2]))}});}
 for(const path of ['/','/observations','/diary','/essays','/videos','/login','/register'])assert.equal((await req(path)).status,200,path);
 assert.equal((await req('/admin')).status,303);
 assert.equal((await req('/register',{method:'POST',origin:'https://evil.test',data:{}})).status,403);
 assert.equal((await auth('/register','reader',password)).status,303);
 const login=await auth('/login','reader',password);assert.equal(login.status,303);const member=login.headers.get('set-cookie').split(';')[0];
 const adminLogin=await auth('/login','dawnsea',password);assert.equal(adminLogin.status,303);const admin=adminLogin.headers.get('set-cookie').split(';')[0];
 assert.equal((await req('/admin',{cookie:member})).status,403);
 const postIds={};
 for(const visibility of ['public','members','private']){
  const response=await req('/admin/post',{method:'POST',cookie:admin,data:{title:visibility,body:'<script>unsafe</script>',kind:'diary',visibility,category:'日常',tags:'海边,生活'}});
  assert.equal(response.status,303);postIds[visibility]=Number(new URL(response.headers.get('location'),'http://site.test').searchParams.get('id'));
 }
 for(const [cookie,visible] of [['',['public']],[member,['public','members']],[admin,['public','members','private']]])for(const visibility of Object.keys(postIds))assert.equal((await req('/post/'+postIds[visibility],{cookie})).status,visible.includes(visibility)?200:404);
 const content=await(await req('/post/'+postIds.public)).text();assert.ok(content.includes('&lt;script&gt;'));assert.ok(!content.includes('<script>unsafe'));
 const detail=await(await req('/post/'+postIds.public,{cookie:member})).text(),challenge=detail.match(/name="challenge" value="([a-f0-9]+)"/)[1],sum=detail.match(/验证码：(\d+) \+ (\d+)/);
 const comment=await req('/comment/'+postIds.public,{method:'POST',cookie:member,data:{body:'测试留言',challenge,answer:String(Number(sum[1])+Number(sum[2]))}});assert.equal(comment.status,303);
 assert.ok(!(await(await req('/post/'+postIds.public)).text()).includes('测试留言'));
 await req('/admin/comments',{method:'POST',cookie:admin,data:{id:'1',action:'toggle'}});
 assert.ok((await(await req('/post/'+postIds.public)).text()).includes('测试留言'));
 // A real PNG tests protected streaming and download permissions.
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
 const upload=new FormData();upload.set('post_id',postIds.public);upload.set('file',new File([png],'pixel.png',{type:'image/png'}));upload.set('downloadable','on');
 assert.equal((await req('/admin/upload',{method:'POST',cookie:admin,data:upload})).status,303);
 const attachment=await db.prepare('SELECT * FROM attachments LIMIT 1').first();assert.equal((await req('/media/'+attachment.id)).status,200);
 assert.equal((await req('/media/'+attachment.id+'?download=1')).status,403);
 assert.equal((await req('/media/'+attachment.id+'?download=1',{cookie:member})).status,200);
 const range=await mf.dispatchFetch('http://site.test/media/'+attachment.id,{headers:{Range:'bytes=0-7'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8);
 await db.prepare("UPDATE posts SET visibility='private' WHERE id=?").bind(postIds.public).run();assert.equal((await req('/media/'+attachment.id,{cookie:member})).status,404);
 assert.equal((await req('/media/'+attachment.id,{cookie:admin})).status,200);
 await req('/admin/users',{method:'POST',cookie:admin,data:{id:'1'}});assert.equal((await req('/account',{cookie:member})).status,303);
 console.log('Integration verified: all sections, registration/login, CSRF, 3 visibility levels, escaped content, comments, R2, Range, downloads and ban revocation.');
 }finally{await mf.dispose();}
});
