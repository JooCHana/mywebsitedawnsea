# 凌晨的海 dawnsea
Django 5.2 + SQLite + 服务端模板。无需 Node 构建；后台 /admin/。

## 本地运行（Python 3.12+）
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```
访问 http://127.0.0.1:8000 。Linux 激活命令为 `source .venv/bin/activate`。
首次数据库初始化使用已提交的 migrations。管理员在后台添加 Site settings、分类、标签、内容及附件。正文使用安全纯文本，保留换行。用户管理取消“有效”即可封禁；只有超级用户可读取私密内容。评论默认待审核，后台勾选审核通过才展示。不要向普通用户赋予 staff/superuser 权限。

## 公网部署 / 打包
需要自己的公网 Linux 服务器、Docker Compose、Caddy 与已购买域名。dawnsea 是站点名，实际需购买可用的完整域名，例如 dawnsea.example.com 是占位符，不是已配置域名。
1. 将代码上传服务器，将域名 A/AAAA 指向服务器公网 IP；只开放 80/443 和必要的 SSH。
2. `cp .env.example .env`，使用 `python -c "import secrets; print(secrets.token_urlsafe(64))"` 生成 SECRET_KEY；填写真实域名和 HTTPS origin。
3. `mkdir -p data`，`docker compose build`，`docker compose run --rm web python manage.py migrate`。
4. `docker compose run --rm web python manage.py createsuperuser`，`docker compose up -d`。
5. 安装 Caddy，把 Caddyfile 的域名改为真实域名，作为主机系统服务运行；自动申请 HTTPS 证书，代理到回环地址 8000。不要暴露应用端口，不要让外部请求绕过受信任代理。若用 Nginx，设置 Host、X-Forwarded-Proto，上传大小 260m，并自行配置 TLS。
6. `docker compose exec web python manage.py check --deploy`；确认 HTTPS、登录、上传以及匿名访问私密资源返回 404。根据是否包含其他非 HTTPS 子域决定启用 HSTS。
镜像即部署包；可 `docker save` 导出。静态资源在镜像构建时 collectstatic，由 WhiteNoise 提供。数据库和上传均保存在 data，必须持久化。

## 权限与安全
公开内容匿名可读；会员内容登录可读；私密内容仅超级用户可读。附件每次读取执行同样权限检查，无公开 media 目录。下载入口要求登录且资源允许下载。浏览器可见的图片/视频无法技术上杜绝另存，下载开关仅控制本站下载入口。
CSRF、模板转义、密码哈希、安全 Cookie、文件扩展名和签名校验、250MB 文件上限已配置。评论每账号 60 秒限发且人工审核；注册和评论使用一次性算术验证码。生产建议在 Caddy 前接 WAF/边缘限流，对登录和注册按 IP 限速，避免自动化撞库；算术验证码不能替代专业反机器人服务。仅管理员能上传；不支持 SVG/HTML。大型视频建议转为兼容 MP4，当前流式文件响应无专门视频转码/Range 优化。

## 维护
备份前停止应用，再复制整个 data 目录，恢复时保留同一 SECRET_KEY。更新先备份再构建镜像、执行 migrate。SQLite 适合个人低流量；高并发时安装 psycopg 并将 DATABASES 改为 PostgreSQL 连接配置，使用 dumpdata/loaddata 迁移（先在测试环境验证）。禁止将生产 data、.env 放入版本库。

## 结构与验证
config/ 为配置及路由；blog/ 为数据模型、权限、后台；templates/ 为响应式页面。测试：`python manage.py test`。此项目不依赖外部图床；公开首页按时间归档，可按日期、类型、标签和关键词筛选。后台管理分类。页面样式可选择深海/晨光，站点介绍与备案可编辑。无密码找回邮件服务（需自行配置 SMTP 后扩展）。
