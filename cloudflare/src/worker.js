import {escape as e,random,digest,hashPassword,verifyPassword,canRead,uploadType} from './security.js';
const kinds={article:'所见所闻',diary:'每日日记',essay:'观点随笔',video:'视频'};
const paths={'/observations':'article','/diary':'diary','/essays':'essay','/videos':'video'};
const epoch=()=>Math.floor(Date.now()/1000);
const redirect=(url,cookie)=>new Response(null,{status:303,headers:{Location:url,...(cookie?{'Set-Cookie':cookie}:{})}});
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const field=(name,label,value='',type='text')=>`<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${type==='password'?'autocomplete="current-password"':''}></label>`;
const select=(name,values,current)=>`<select name="${name}">${Object.entries(values).map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${e(label)}</option>`).join('')}</select>`;
function page(title,body,user,settings={}) {
 return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · dawnsea</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"></head><body class="${settings.style==='sea'?'sea':''}"><header class="site-header"><nav class="navigation container" aria-label="主导航"><a class="brand" href="/">dawnsea<span>.</span></a><div class="nav-links"><a href="/">首页</a><a href="/observations">所见所闻</a><a href="/diary">每日日记</a><a href="/essays">观点随笔</a><a href="/videos">视频</a>${user?`<a href="/account">${e(user.username)}</a>${user.role==='admin'?'<a href="/admin">管理后台</a>':''}<form action="/logout" method="post"><button class="text-button">退出</button></form>`:'<a href="/register">注册</a><a href="/login">登录</a>'}</div></nav></header><main class="container">${body}</main><footer class="site-footer">© ${new Date().getFullYear()} HJC · ${e(settings.icp||'')}<p>凌晨的海 · 留下生活经过的痕迹</p></footer></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});
}
async function userFor(req,env) {
 const token=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!token)return null;
 return env.DB.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.banned=0').bind(await digest(token),epoch()).first();
}
function cookie(req,token,age=604800) {return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
async function rate(env,key,max,seconds) {
 const slot=Math.floor(epoch()/seconds),id=await digest(key+':'+slot);
 const row=await env.DB.prepare('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(id,epoch()+seconds*2).first();
 if(row.count>max)fail(429,'操作太频繁，请稍后重试。');
}
async function challenge(env) {
 const values=crypto.getRandomValues(new Uint8Array(2)),a=values[0]%9+1,b=values[1]%9+1,id=random();
 await env.DB.prepare('INSERT INTO challenges(id,answer,expires) VALUES(?,?,?)').bind(id,String(a+b),epoch()+600).run();
 return `<input type="hidden" name="challenge" value="${id}"><label>简单验证码：${a} + ${b} = ?<input name="answer" inputmode="numeric" autocomplete="off" required></label>`;
}
async function checkChallenge(env,form) {
 const row=await env.DB.prepare('DELETE FROM challenges WHERE id=? RETURNING answer,expires').bind(String(form.get('challenge')||'')).first();
 if(!row||row.expires<epoch()||row.answer!==String(form.get('answer')||'').trim())fail(400,'验证码错误或已过期，请返回并刷新页面后重试。');
}
const requireUser=user=>{if(!user)fail(401,'请先登录。');};
const requireAdmin=user=>{if(user?.role!=='admin')fail(403,'仅管理员可访问。');};
const string=(f,name,max=200)=>{const value=String(f.get(name)||'').trim();if(value.length>max)fail(400,`${name} 内容过长。`);return value;};
const postEditor=(post={})=>`<form method="post" action="/admin/post"><input type="hidden" name="id" value="${post.id||''}">${field('title','标题',post.title)}<label>正文（纯文本，自动保留换行）<textarea name="body" rows="14" required>${e(post.body)}</textarea></label><div class="grid"><label>板块${select('kind',kinds,post.kind||'article')}</label><label>访问权限${select('visibility',{public:'公开',members:'仅注册会员',private:'仅自己'},post.visibility||'public')}</label></div>${field('category','分类',post.category)}${field('tags','标签（英文逗号分隔）',post.tags)}<button class="button">保存内容</button></form>`;
async function route(req,env,ctx) {
 const url=new URL(req.url),path=url.pathname.replace(/\/$/,'')||'/',method=req.method;
 if(!['GET','HEAD','POST'].includes(method))fail(405,'不支持的请求方法。');
 // Same-origin POSTs only: blocks login CSRF, forged forms and cross-site uploads.
 if(method==='POST'&&req.headers.get('Origin')!==url.origin)fail(403,'请求来源校验失败，请从本站页面提交。');
 if(method==='POST'&&Number(req.headers.get('Content-Length')||0)>21*1024*1024)fail(413,'上传最大 20MB。');
 if(!env.DB)fail(503,'数据库尚未配置，请完成部署文档中的 D1 绑定与初始化。');
 const user=await userFor(req,env),settings=await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
 const render=(title,body)=>page(title,body,user,settings);
 const ip=req.headers.get('CF-Connecting-IP')||'local';
 if(method==='POST')await rate(env,`post:${ip}`,120,60);
 // Cleanup is bounded by the rolling quotas and runs outside the response path.
 ctx.waitUntil(env.DB.batch(['sessions','challenges','limits'].map(t=>env.DB.prepare(`DELETE FROM ${t} WHERE expires<?`).bind(epoch()))).catch(()=>{}));
 if((path==='/login'||path==='/register')&&method==='GET') {
  await rate(env,`auth-form:${ip}`,60,600);
  if(user)return redirect('/account');
  return render(path==='/login'?'会员登录':'会员注册',`<section class="card auth"><p class="eyebrow">DAWNSEA / ACCOUNT</p><h1>${path==='/login'?'欢迎回到海边':'在海边留一个名字'}</h1><form method="post">${field('username','用户名（3–32 位字母、数字、下划线）')}${field('password','密码（至少 10 位，最多 128 位）','','password')}${path==='/register'?field('confirm','再次输入密码','','password'):''}${await challenge(env)}<button class="button">${path==='/login'?'登录':'创建账号'}</button></form><p><a href="/login">已有账号？登录</a> · <a href="/register">注册会员</a></p></section>`);
 }
 if((path==='/login'||path==='/register')&&method==='POST') {
  await rate(env,`auth:${ip}`,12,600);
  const f=await req.formData();await checkChallenge(env,f);
  const username=string(f,'username',32),password=String(f.get('password')||'');
  if(!/^[a-zA-Z0-9_]{3,32}$/.test(username)||password.length<(path==='/register'?10:1)||password.length>128)fail(400,'用户名须为 3–32 位字母数字或下划线；密码须为 10–128 位。');
  await rate(env,`username:${username.toLowerCase()}`,15,600);
  // Bootstrap only the designated administrator, from a secret password hash.
  const adminName=env.ADMIN_USERNAME||'dawnsea';
  if(path==='/register') {
   if(username.toLowerCase()===adminName.toLowerCase())fail(400,'该用户名已保留。');
   if(password!==f.get('confirm'))fail(400,'两次密码不一致。');
   const exists=await env.DB.prepare('SELECT id FROM users WHERE lower(username)=lower(?)').bind(username).first();
   if(exists)fail(400,'该用户名已存在。');
   try { await env.DB.prepare('INSERT INTO users(username,password) VALUES(?,?)').bind(username,await hashPassword(password)).run(); }
   catch {fail(400,'注册未完成，该用户名可能已存在。');}
   return redirect('/login');
  }
  let account=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  if(!account&&username===adminName&&env.ADMIN_PASSWORD_HASH&&await verifyPassword(password,env.ADMIN_PASSWORD_HASH)) {
   await env.DB.prepare("INSERT OR IGNORE INTO users(username,password,role) VALUES(?,?,'admin')").bind(adminName,env.ADMIN_PASSWORD_HASH).run();
   account=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(username).first();
  }
  if(!account||account.banned||!await verifyPassword(password,account.password))fail(401,'用户名或密码错误，或账号已停用。');
  const token=random();await env.DB.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await digest(token),account.id,epoch()+604800).run();
  return redirect('/account',cookie(req,token));
 }
 if(path==='/logout'&&method==='POST') {
  const token=(req.headers.get('Cookie')||'').match(/session=([a-f0-9]{64})/)?.[1];
  if(token)await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();
  return redirect('/',cookie(req,'',0));
 }
 if(path==='/account'&&method==='GET') {
  if(!user)return redirect('/login');
  return render('个人账号',`<section class="card auth"><h1>你好，${e(user.username)}</h1><p>你可以阅读会员内容、留言及下载允许下载的资源。</p>${user.role==='admin'?'<a class="button" href="/admin">管理网站</a>':''}<h2>修改密码</h2><form action="/account/password" method="post">${field('current','当前密码','','password')}${field('password','新密码（至少 10 位）','','password')}${field('confirm','确认新密码','','password')}<button class="button">更新密码并重新登录</button></form></section>`);
 }
 if(path==='/account/password'&&method==='POST') {
  requireUser(user);await rate(env,`password:${user.id}`,5,600);const f=await req.formData(),password=String(f.get('password')||'');
  if(!await verifyPassword(String(f.get('current')||''),user.password))fail(400,'当前密码错误。');
  if(password.length<10||password.length>128||password!==f.get('confirm'))fail(400,'新密码须为 10–128 位，且两次一致。');
  await env.DB.batch([env.DB.prepare('UPDATE users SET password=? WHERE id=?').bind(await hashPassword(password),user.id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  return redirect('/login',cookie(req,'',0));
 }
 if((path==='/'||paths[path])&&method==='GET') {
  const params=[],where=[];
  if(user?.role!=='admin'){where.push(user?"visibility IN ('public','members')":"visibility='public'");}
  if(paths[path]){where.push('kind=?');params.push(paths[path]);}
  for(const name of ['q','tag','date','category']) {
   const v=url.searchParams.get(name)?.slice(0,200);if(!v)continue;
   if(name==='q'){where.push('(title LIKE ? OR body LIKE ?)');params.push('%'+v+'%','%'+v+'%');}
   if(name==='tag'){where.push("(',' || tags || ',') LIKE ?");params.push('%,'+v+',%');}
   if(name==='date'){where.push('date(created)=?');params.push(v);}
   if(name==='category'){where.push('category=?');params.push(v);}
  }
  const pageNo=Math.max(1,Math.min(100000,Number.parseInt(url.searchParams.get('page')||'1')||1));
  const {results}=await env.DB.prepare(`SELECT * FROM posts ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY created DESC,id DESC LIMIT 11 OFFSET ?`).bind(...params,(pageNo-1)*10).all();
  const title=paths[path]?kinds[paths[path]]:settings.name;
  const pager=(n)=>{const q=new URLSearchParams(url.searchParams);q.set('page',n);return path+'?'+q;};
  return render(title,`${path==='/'?`<section class="hero"><div class="avatar" role="img" aria-label="dawnsea 头像">d.</div><p class="eyebrow">A LITTLE SPACE OF MY OWN</p><h1>你好，我是 dawnsea</h1><p class="intro">${e(settings.description)}</p><a class="button" href="/observations">发现生活的微光 ↗</a></section>`:`<section class="page-heading"><p class="eyebrow">DAWNSEA / JOURNAL</p><h1>${e(title)}</h1><p>记录生活，分享思考。</p></section>`}<section class="content"><form class="filters"><input name="q" placeholder="搜索文字" aria-label="搜索" value="${e(url.searchParams.get('q'))}"><input name="date" type="date" aria-label="日期" value="${e(url.searchParams.get('date'))}"><button class="button">查找</button></form>${results.slice(0,10).map(p=>`<article class="card entry"><p class="subtitle">${e(p.created.slice(0,10))} / ${kinds[p.kind]} / ${e(p.category)}</p><h2><a href="/post/${p.id}">${e(p.title)}</a></h2><p>${e(p.body.slice(0,180))}</p><div>${p.tags.split(',').filter(Boolean).map(t=>`<a class="tag" href="${path}?tag=${encodeURIComponent(t)}"># ${e(t)}</a>`).join('')}</div><a href="/post/${p.id}">阅读全文 →</a></article>`).join('')||'<div class="card"><h2>故事正在酝酿</h2><p>暂时没有符合条件的内容。</p></div>'}<div class="pagination">${pageNo>1?`<a href="${e(pager(pageNo-1))}">上一页</a>`:''}<span>第 ${pageNo} 页</span>${results.length>10?`<a href="${e(pager(pageNo+1))}">下一页</a>`:''}</div></section>`);
 }
 const detail=path.match(/^\/post\/(\d+)$/);
 if(detail&&method==='GET') {
  const p=await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(detail[1]).first();if(!canRead(user,p))fail(404,'内容不存在或不可见。');
  const {results:files}=await env.DB.prepare('SELECT * FROM attachments WHERE post_id=?').bind(p.id).all();
  const {results:comments}=await env.DB.prepare('SELECT c.*,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND c.approved=1 ORDER BY c.id DESC LIMIT 100').bind(p.id).all();
  return render(p.title,`<section class="content page-heading"><p class="subtitle">${e(p.created)} / ${kinds[p.kind]}</p><h1>${e(p.title)}</h1><article class="post-body">${e(p.body)}</article>${files.map(f=>`<figure>${f.mime.startsWith('video/')?`<video controls preload="metadata" src="/media/${f.id}"></video>`:`<img loading="lazy" src="/media/${f.id}" alt="${e(f.name)}">`}${f.downloadable&&user?`<figcaption><a href="/media/${f.id}?download=1">下载 ${e(f.name)}</a></figcaption>`:''}</figure>`).join('')}<h2>海边留言</h2>${url.searchParams.has('submitted')?'<p role="status">留言已提交，审核后展示。</p>':''}${comments.map(c=>`<div class="card entry"><b>${e(c.username)}</b><p class="post-body">${e(c.body)}</p></div>`).join('')||'<p>还没有公开留言。</p>'}${user?`<form method="post" action="/comment/${p.id}"><label>留言<textarea name="body" maxlength="2000" required></textarea></label>${await challenge(env)}<button class="button">提交审核</button></form>`:'<a href="/login">登录后参与交流</a>'}</section>`);
 }
 const comment=path.match(/^\/comment\/(\d+)$/);
 if(comment&&method==='POST') {
  requireUser(user);const p=await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(comment[1]).first();if(!canRead(user,p))fail(404,'内容不可见。');
  await rate(env,`comment:${user.id}`,1,60);const f=await req.formData();await checkChallenge(env,f);const body=string(f,'body',2000);if(body.length<2)fail(400,'评论至少 2 个字。');
  await env.DB.prepare('INSERT INTO comments(post_id,user_id,body) VALUES(?,?,?)').bind(p.id,user.id,body).run();return redirect(`/post/${p.id}?submitted=1`);
 }
 const media=path.match(/^\/media\/([a-f0-9]{64})$/);
 if(media&&(method==='GET'||method==='HEAD')) {
  const f=await env.DB.prepare('SELECT a.*,p.visibility FROM attachments a JOIN posts p ON p.id=a.post_id WHERE a.id=?').bind(media[1]).first();if(!canRead(user,f))fail(404,'资源不可见。');
  if(url.searchParams.get('download')==='1'&&(!user||!f.downloadable))fail(403,'该资源不允许下载或需要登录。');
  const head=await env.MEDIA.head(f.id);if(!head)fail(404,'文件不存在。');
  const headers=new Headers({'Content-Type':f.mime,'Accept-Ranges':'bytes','Cache-Control':'private, no-store'});
  if(url.searchParams.get('download')==='1')headers.set('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
  const range=req.headers.get('Range');let options={},status=200;
  if(range){const m=range.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});let start=m[1]?Number(m[1]):Math.max(0,head.size-Number(m[2])),end=m[1]?(m[2]?Math.min(Number(m[2]),head.size-1):head.size-1):head.size-1;if(start>end||start>=head.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});options={range:{offset:start,length:end-start+1}};status=206;headers.set('Content-Range',`bytes ${start}-${end}/${head.size}`);headers.set('Content-Length',String(end-start+1));}
  else headers.set('Content-Length',String(head.size));
  const object=method==='HEAD'?null:await env.MEDIA.get(f.id,options);return new Response(object?.body||null,{status,headers});
 }
 if(path.startsWith('/admin')) {
  if(!user)return redirect('/login');requireAdmin(user);
  if(path==='/admin'&&method==='GET') {
   const {results:posts}=await env.DB.prepare('SELECT id,title,kind,visibility FROM posts ORDER BY id DESC LIMIT 200').all();
   return render('管理后台',`<section class="page-heading"><h1>管理后台</h1><p>欢迎，${e(user.username)}。在这里记录你的生活。</p><div class="actions"><a class="button" href="/admin/post">发布内容</a><a href="/admin/users">会员管理</a><a href="/admin/comments">评论审核</a><a href="/admin/settings">网站设置</a></div></section><div class="card">${posts.map(p=>`<div class="admin-row"><a href="/admin/post?id=${p.id}">${e(p.title)}</a><span>${kinds[p.kind]} · ${e(p.visibility)}</span><a href="/post/${p.id}">查看</a></div>`).join('')||'暂无内容，点击“发布内容”开始。'}</div>`);
  }
  if(path==='/admin/post'&&method==='GET') {
   const id=url.searchParams.get('id'),p=id?await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first():{};if(!p)fail(404,'文章不存在。');
   const files=id?(await env.DB.prepare('SELECT * FROM attachments WHERE post_id=?').bind(id).all()).results:[];
   return render('编辑内容',`<section class="card editor"><h1>${id?'编辑内容':'发布内容'}</h1>${postEditor(p)}${id?`<hr><h2>图片与视频</h2>${!env.MEDIA?'<p role="status">图片和视频上传暂未启用；开通 R2 后可恢复。当前可正常发布文字内容。</p>':''}<p>支持 JPG / PNG / WebP / MP4 / WebM，单文件最多 20MB。</p><form method="post" enctype="multipart/form-data" action="/admin/upload"><input type="hidden" name="post_id" value="${p.id}"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required><label class="check"><input type="checkbox" name="downloadable">允许登录会员下载</label><button class="button" ${!env.MEDIA?'disabled':''}>上传附件</button></form>${files.map(f=>`<div class="admin-row"><a href="/media/${f.id}">${e(f.name)}</a><form method="post" action="/admin/attachment"><input type="hidden" name="id" value="${f.id}"><button name="action" value="toggle">${f.downloadable?'关闭下载':'允许下载'}</button><button name="action" value="delete">删除附件</button></form></div>`).join('')}<hr><form method="post" action="/admin/delete"><input type="hidden" name="id" value="${p.id}"><label class="check"><input type="checkbox" name="confirm" required>确认永久删除此内容及附件</label><button class="danger">删除内容</button></form>`:'<p>保存内容后即可上传图片和视频。</p>'}</section>`);
  }
  if(path==='/admin/post'&&method==='POST') {
   const f=await req.formData(),title=string(f,'title'),body=string(f,'body',100000),kind=string(f,'kind'),visibility=string(f,'visibility'),category=string(f,'category',80),tags=string(f,'tags',500).split(/[,，]/).map(x=>x.trim()).filter(Boolean).join(',');
   if(!title||!body||!kinds[kind]||!['public','members','private'].includes(visibility))fail(400,'请填写标题、正文和有效的板块及权限。');
   const id=string(f,'id');let saved;
   if(id){saved=await env.DB.prepare('UPDATE posts SET title=?,body=?,kind=?,visibility=?,category=?,tags=? WHERE id=? RETURNING id').bind(title,body,kind,visibility,category,tags,id).first();if(!saved)fail(404,'文章不存在。');}
   else saved=await env.DB.prepare('INSERT INTO posts(title,body,kind,visibility,category,tags) VALUES(?,?,?,?,?,?) RETURNING id').bind(title,body,kind,visibility,category,tags).first();
   return redirect('/admin/post?id='+saved.id);
  }
  if(path==='/admin/upload'&&method==='POST') {
   if(!env.MEDIA)fail(503,'图片和视频上传暂未启用，管理员需要先开通并绑定 R2。');
   const f=await req.formData(),postId=string(f,'post_id'),file=f.get('file');
   if(!file||typeof file==='string'||file.size<1||file.size>20*1024*1024)fail(400,'请选择 20MB 以内的有效文件。');
   const post=await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(postId).first();if(!post)fail(404,'文章不存在。');
   const mime=uploadType(new Uint8Array(await file.slice(0,32).arrayBuffer()));
   const extension=file.name.split('.').pop().toLowerCase(),types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',webm:'video/webm'};
   if(!mime||types[extension]!==mime)fail(400,'文件类型不支持或内容与扩展名不匹配。');
   const id=random();await env.MEDIA.put(id,file.stream(),{httpMetadata:{contentType:mime}});
   try {await env.DB.prepare('INSERT INTO attachments(id,post_id,name,mime,size,downloadable) VALUES(?,?,?,?,?,?)').bind(id,postId,file.name.slice(0,200),mime,file.size,f.has('downloadable')?1:0).run();}
   catch(error){await env.MEDIA.delete(id);throw error;}
   return redirect('/admin/post?id='+postId);
  }
  if(path==='/admin/attachment'&&method==='POST') {
   const f=await req.formData(),a=await env.DB.prepare('SELECT * FROM attachments WHERE id=?').bind(string(f,'id')).first();if(!a)fail(404,'附件不存在。');
   if(f.get('action')==='delete'){await env.MEDIA.delete(a.id);await env.DB.prepare('DELETE FROM attachments WHERE id=?').bind(a.id).run();}
   else if(f.get('action')==='toggle')await env.DB.prepare('UPDATE attachments SET downloadable=1-downloadable WHERE id=?').bind(a.id).run();
   return redirect('/admin/post?id='+a.post_id);
  }
  if(path==='/admin/delete'&&method==='POST') {
   const f=await req.formData();if(!f.has('confirm'))fail(400,'请确认删除。');const id=string(f,'id');
   const {results}=await env.DB.prepare('SELECT id FROM attachments WHERE post_id=?').bind(id).all();
   for(const a of results)await env.MEDIA.delete(a.id);
   await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run();return redirect('/admin');
  }
  if(path==='/admin/users'&&method==='GET') {
   const {results}=await env.DB.prepare('SELECT id,username,role,banned,created FROM users ORDER BY id DESC LIMIT 500').all();
   return render('会员管理',`<section class="page-heading"><h1>会员管理</h1><a href="/admin">返回后台</a></section><div class="card">${results.map(u=>`<div class="admin-row"><span>${e(u.username)} · ${e(u.role)} · ${u.banned?'已封禁':'正常'}</span>${u.role!=='admin'?`<form method="post"><input type="hidden" name="id" value="${u.id}"><button>${u.banned?'解除封禁':'封禁'}</button></form>`:''}</div>`).join('')}</div>`);
  }
  if(path==='/admin/users'&&method==='POST') {
   const f=await req.formData(),id=string(f,'id');await env.DB.batch([env.DB.prepare("UPDATE users SET banned=1-banned WHERE id=? AND role!='admin'").bind(id),env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE id=? AND role!='admin')").bind(id)]);return redirect('/admin/users');
  }
  if(path==='/admin/comments'&&method==='GET') {
   const {results}=await env.DB.prepare('SELECT c.*,u.username,p.title FROM comments c JOIN users u ON u.id=c.user_id JOIN posts p ON p.id=c.post_id ORDER BY c.id DESC LIMIT 200').all();
   return render('评论审核',`<section class="page-heading"><h1>评论审核</h1><a href="/admin">返回后台</a></section>${results.map(c=>`<div class="card entry"><b>${e(c.username)} / ${e(c.title)}</b><p>${e(c.body)}</p><form method="post"><input type="hidden" name="id" value="${c.id}"><button name="action" value="toggle">${c.approved?'撤回审核':'审核通过'}</button> <button name="action" value="delete">删除</button></form></div>`).join('')||'<p>暂无评论。</p>'}`);
  }
  if(path==='/admin/comments'&&method==='POST') {
   const f=await req.formData(),id=string(f,'id');await env.DB.prepare(f.get('action')==='delete'?'DELETE FROM comments WHERE id=?':'UPDATE comments SET approved=1-approved WHERE id=?').bind(id).run();return redirect('/admin/comments');
  }
  if(path==='/admin/settings'&&method==='GET')return render('网站设置',`<section class="card editor"><h1>网站设置</h1><form method="post">${field('name','站点名称',settings.name)}${field('description','简介',settings.description)}${field('icp','备案信息',settings.icp)}<label>页面样式${select('style',{light:'晨光 · 浅色',sea:'深海 · 蓝色'},settings.style)}</label><button class="button">保存设置</button></form></section>`);
  if(path==='/admin/settings'&&method==='POST') {
   const f=await req.formData();await env.DB.prepare('UPDATE settings SET name=?,description=?,icp=?,style=? WHERE id=1').bind(string(f,'name',80)||'凌晨的海',string(f,'description',300),string(f,'icp',100),f.get('style')==='sea'?'sea':'light').run();return redirect('/admin/settings');
  }
 }
 fail(404,'页面不存在。');
}
export default {async fetch(req,env,ctx) {
 let response;
 try {response=await route(req,env,ctx);}catch(error){if(!error.status)console.error('Request failed:',error.message);response=page('提示',`<section class="card auth"><h1>${error.status||500}</h1><p>${e(error.status?error.message:'服务暂时不可用，请稍后重试。管理员请检查数据库绑定与日志。')}</p><a href="/">返回首页</a> · <a href="/login">登录</a></section>`,null);response=new Response(response.body,{status:error.status||500,headers:response.headers});}
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Cache-Control','private, no-store');
 headers.set('Content-Security-Policy',"default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self'; media-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
 return new Response(req.method==='HEAD'?null:response.body,{status:response.status,headers});
}};
