# 本地源码与 GitHub 自动部署

本目录就是当前线上版本的完整源码，包含昼夜背景、头像、推文、讨论区、会员及中文后台。原始图片保存在 public。无需重新建站或创建新数据库。

## 上传方式（推荐新建独立仓库）
1. 解压 dawnsea-cloudflare.zip，把解压后 package.json 所在目录作为仓库根目录。
2. 在 GitHub 创建一个仓库，将解压出的文件和文件夹上传。不要只上传 ZIP 文件。
3. 根目录应该直接看到 package.json、package-lock.json、wrangler.jsonc、src、public、migrations、scripts、tests、README.md、.gitignore。
4. 若从原始桌面目录上传，请只取 cloudflare 内的源码，不要上传 node_modules、.wrangler、private、.dev.vars、.env、数据库备份或父目录的 server。

## 连接现有 Cloudflare 网站
Cloudflare 控制台 → Workers 与 Pages → 已有的 dawnsea → 设置 → 构建 → 连接 Git 仓库。
- 仓库：你上传源码的仓库。
- 生产分支：main（如果实际使用其他分支，填写实际名称）。
- 根目录：新独立仓库直接包含 package.json 时留空；保留原先“我的网站”仓库结构时填 cloudflare。
- 构建命令：npm run check
- 部署命令：npx wrangler d1 migrations apply DB --remote && npx wrangler deploy
- 若出现安装命令选项：npm ci
- Worker 名称保持 dawnsea；这是 Workers 构建设置，不是 Pages 的静态输出目录表单。

必须选择已经上线的 dawnsea Worker，并保留 wrangler.jsonc 的 D1 database_id、域名路由和 Worker 名称。现有管理员密钥已经存放在 Cloudflare，不需要把密码填入代码或 GitHub。部署令牌需要具有当前 D1 数据库的迁移权限以及 Worker 发布权限；如果构建报 D1 权限不足，在 Cloudflare 构建设置检查部署令牌权限。

## 以后怎么更新
- 修改源码，提交 commit 并 push 到生产分支后，Cloudflare 才会自动构建发布。
- 只在电脑保存文件，不会触发部署；只上传 ZIP 也不会部署。
- GitHub 网页直接修改文件并提交到生产分支，也可触发。
- 构建成功后刷新 https://dawnsea.space；失败时在 Cloudflare 的构建日志查看原因。
- 当前没有替你连接 GitHub 自动构建；需完成上面的首次连接。

## 修改位置
- src/layout.js：个人侧栏、简介默认文案、联系链接、全站框架。
- src/community.js：首页推文、讨论、我的工作、项目管理。
- src/worker.js：登录、账号、文章、后台与安全路由。
- public/home.css：主页样式和海景效果。
- public/theme.js、public/home.js：昼夜切换和交互。
- public/sea-day.png、sea-night.png、avatar.png：白天背景、夜间背景、头像。
- migrations：数据库增量变更，不要修改已在云端执行过的迁移文件。

## 文章与账号数据不在 Git 中
后台发布的文章、推文、话题、评论、会员和小文档保存在 Cloudflare D1。正常部署代码不会清空它们。源码 ZIP 不包含这些私人数据库内容。
若要备份数据：在本目录执行 npx wrangler d1 export DB --remote --output=private/database-backup.sql，先确保 private 目录存在，并将备份保存在私人位置。

## 本地开发
安装 Node.js 22.12+ 或 24 LTS，在本目录终端执行：
npm ci
npm run db:local
npm run dev
按终端显示的网址访问。线上账号与本地账号库相互独立，本地修改验证后再提交。功能测试执行 npm test。
