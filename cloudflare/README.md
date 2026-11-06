# 当前部署模式：暂不开通 R2

文章、日记、随笔、会员与后台可以使用。附件上传暂时禁用，云端不创建 R2。后续开通时，在 wrangler.jsonc 添加 r2_buckets: [{"binding":"MEDIA","bucket_name":"dawnsea-media"}]，创建桶后重新部署即可。下方涉及 R2 的原始步骤仅在启用附件时执行。

# dawnsea · Cloudflare 完整版

本目录是独立的 Workers 项目：Workers 渲染页面和处理登录，D1 保存内容、账号及会话，私有 R2 保存附件。原有 Django 本地版保留，不受影响。本项目没有任何 127.0.0.1 生产链接，也不依赖电脑开机。

## 最简部署（Windows）
1. 安装 Node.js 22.12+ 或 24 LTS。
2. 在 Cloudflare 账号中开通 Workers、D1、R2。R2 是否要求绑定支付方式、资源额度和费用以你的账户控制台为准，不保证永久免费。
3. 双击本目录“部署到Cloudflare.cmd”。在浏览器登录你自己的 Cloudflare 并授权 Wrangler。脚本会安装锁定依赖、创建/复用 dawnsea-db 和 dawnsea-media、初始化数据库。
4. 根据提示输入 dawnsea 管理员密码。密码不回显，只将加盐哈希写入 Cloudflare Secret。不要把明文密码放到 GitHub 或截图中。
5. 等待输出 `https://dawnsea.<你的子域>.workers.dev`，打开并注册测试会员。管理员从 /login 登录，进入 /admin 发布内容。
6. 后续改代码运行 `npm run deploy`；无需重复设置管理员密钥。管理员首次登录创建数据库账户，之后密码在 /account 修改。重复设置初始化密钥不会覆盖已存在账户的密码。

当前账号库和文章库是新的，旧 Django 数据不会自动上传。管理员用户名沿用 dawnsea，密码在部署时设置；旧会员需要重新注册。不要将旧 server/data 数据库放入 public。

## 绑定 dawnsea.space（域名留在阿里云注册）
1. 在 Cloudflare 添加现有域名 dawnsea.space，选择适合的计划。
2. 检查导入 DNS 记录；尤其保留现有邮箱 MX/TXT、其他子域名。
3. Cloudflare 会给出专属于该域名的两条 nameserver。在阿里云域名控制台“DNS 修改/修改 DNS 服务器”改为这两条，而不是填写服务器 IP。若原来启用了 DNSSEC，按控制台迁移指引先处理旧 DS 记录，避免解析失败。
4. 等 Cloudflare 域名状态 Active 后：Workers 与 Pages → dawnsea Worker → 设置 → 域和路由 → 添加 → 自定义域 → dawnsea.space。可另加 www.dawnsea.space。Cloudflare 管理对应 DNS 和证书；不要覆盖已有冲突记录而不确认用途。
5. HTTPS 生效后验证 /、/diary、/essays、/observations、/register、/login、/admin。
域名仍在阿里云续费，只将 DNS 托管到 Cloudflare。

## GitHub 自动部署
之前截图里的 Pages 表单不适用于这个完整项目。进入创建 **Worker**、导入仓库。
只上传本 cloudflare 目录内的源码、public、migrations、scripts、package.json、package-lock.json 和 wrangler.jsonc，不要上传父目录、node_modules、.dev.vars 或旧数据库。
先完成一次上面的本机部署，让 wrangler.jsonc 写入实际 database_id，提交这个配置。Worker 名称与配置一致：dawnsea。
- 根目录：如果本目录的文件就是仓库根文件，留空；如果仓库里包含 cloudflare 子目录，填 cloudflare。
- 构建命令：`npm run check`
- 部署命令：`npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`
- 无需 Pages 的“构建输出目录”。静态资源目录由配置中的 public 指定。
- ADMIN_PASSWORD_HASH 是 Worker Secret，不能作为公开构建变量或写进源码。

## 本地开发与验证
```powershell
npm ci
npm run db:local
npm test
npm run dev
```
Wrangler 输出本机访问地址。可注册普通账号。需要本地管理员时：使用终端隐藏输入密码，将密码通过标准输入传给 `node scripts/admin-secret.mjs --local`，得到被 Git 忽略的 .dev.vars。不要提交该文件。
`npm run build` 做部署干运行，不创建云资源。数据库迁移用 `npm run db:remote`（必须先完成绑定），新的迁移文件追加在 migrations 中，不要修改已经在线执行过的迁移。

## 已实现
- 首页时间流；所见所闻、日记、随笔、视频独立页面；关键词、日期、标签及分类查询。
- 注册、登录、退出、个人页、修改密码；管理员编辑/删除内容、会员封禁、评论审核、网站设置。
- 公开 / 会员 / 私密权限对正文及附件一致生效；未授权资源返回 404。
- 上传 JPG/PNG/WebP/MP4/WebM，签名+扩展名验证，单文件 20MB；视频支持 HTTP Range。R2 必须保持私有，禁止开启公共 r2.dev 或直连公开桶。
- 下载入口要求登录且资源允许下载。浏览器可播放/显示的内容不能绝对阻止另存。
- 参数化 SQL、HTML 转义、严格 CSP、同源 POST 校验、HttpOnly 会话、HTTPS Secure Cookie、密码 PBKDF2 加盐哈希、限速、一次性算术验证码和评论审核。

## 限制与运维
- 此版正文是纯文本，不执行 HTML，不含富文本编辑器、邮箱验证/邮件找回、视频转码、大文件分片上传。
- 算术验证码是基础防护，繁忙公网网站应进一步接 Turnstile。PBKDF2 使用 Workers Web Crypto 支持范围内的 100000 次迭代；敏感/大规模服务宜使用专业身份提供方。
- 管理列表显示最近 200 篇内容/评论和 500 个用户。公开文章列表分页。
- 本地数据和云端数据隔离；上线之前无示例私密数据、无内置明文口令。
- D1 备份：`npx wrangler d1 export DB --remote --output=backup.sql`，将备份保存在此目录之外的私有位置；R2 独立备份。删除文章会同时删除附件，无回收站。
- 注意 Workers CPU、D1 配额与 R2 用量。使用免费额度不代表无限容量。错误详情在 Worker 日志查看，访客不会收到数据库堆栈。

官方参考：
https://developers.cloudflare.com/workers/static-assets/
https://developers.cloudflare.com/d1/wrangler-commands/
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

验证记录：2026-11-05，部署干运行通过；4 个安全单元测试及 1 个 Workers 集成测试通过，覆盖注册登录、内容权限、评论审核、附件 Range 与封禁。尚未完成云端发布和浏览器视觉检查。

## 本次发布记录（2026-11-05）
- 已发布：https://dawnsea.1050162298.workers.dev
- 首页、所见所闻、日记、随笔、注册、登录线上 HTTP 检查通过。
- 管理员 dawnsea 已初始化；云端登录和管理后台访问验证通过。
- 按用户选择，暂未开通 R2，上传按钮禁用。文章和会员功能正常。
- dawnsea.space 仍为 pending，需要阿里云 DNS 服务器设置为 harvey.ns.cloudflare.com、tricia.ns.cloudflare.com；激活后绑定 Worker 自定义域。
- 最新部署版本：0fad4168-7ff4-4a6a-b4fe-43b09dc606f2。

## 域名绑定更新（2026-11-06）
Cloudflare 已确认 dawnsea.space 为 active，并已绑定 dawnsea Worker 的生产环境。Cloudflare DNS 已返回 A 记录；当前本机 DNS 尚未同步，HTTPS 握手未通过，正式域名访问仍需后续验证。备用地址 https://dawnsea.1050162298.workers.dev 已保留。

## 2026-11-06 动态主页更新
- 参考 SRInternet/Home_Page 的个人侧栏与卡片布局，以原创 SVG/CSS 海景实现昼夜主题；未复制该仓库源码。
- 本地时间 06–18 点为日间，其余为夜间；可手动切换。支持减少动态效果的系统偏好。
- 页面模块：src/layout.js；新增业务：src/community.js；海景样式：public/home.css；交互：public/home.js、theme.js。
- 头像目前为原创海景占位 SVG。用户提供海边图像后，将图片保存到 public 并修改 layout.js 与 community.js 中头像引用。
- 注册需用户名、手机号、邮箱及密码，不发送短信/邮件；保留简单算术验证码。手机号邮箱不向访客展示。
- 讨论全部公开，登录才能发帖回复；后台可编辑删除话题及评论。旧文章的三级权限仍然保留。
- 推文由原文章数据展示，在编辑页面勾选置顶；工作项目支持介绍、外部链接、公开 PDF/TXT 文档。
- 未开通 R2；小文档保存在 D1，每份最大 512KB；图片视频上传仍保持禁用。项目文档公开下载。
- 数据库变更见 migrations/0002_community.sql。已备份旧数据库于被 Git 忽略的 private/，切勿上传该目录。

背景与头像已替换为用户提供的原图：public/sea-night.png、sea-day.png、avatar.png。昼夜交叉淡入，夜间保留局部光影与海面动画；不修改原图。
