# 凌晨的海 dawnsea

当前线上版本源码在 **cloudflare/**，网站 https://dawnsea.space 。

## 整理后的目录
- cloudflare/：正在使用的完整源码、静态图片、数据库迁移与说明。
- 旧版本归档/2026-11-06/：原静态版、Django 版、旧启动脚本及日志，仅本地保存。
- 发布包/：可分发的完整源码 ZIP，仅本地保存。
- 上传到GitHub.cmd：双击运行自动检查、测试、提交、推送。
- upload-git.ps1：上传脚本源码。

归档不是删除。旧 Django 数据库仍保留在归档中的 server/data；旧文件已不参与线上部署。cloudflare/private 中保留私有数据库备份，不上传。

## 一键上传
电脑需已安装 Git、Node.js，并可访问 GitHub/npm。
双击“上传到GitHub.cmd”，第一次推送时 Git Credential Manager 可能要求在浏览器登录 GitHub。
脚本固定上传到 https://github.com/JooCHana/mywebsitedawnsea.git 的 main 分支。
它会检查文件范围，获取远端状态，按锁文件安装依赖，运行代码检查和测试，再提交推送；失败会停止。不会自动解决冲突，不会 force push，不会把备份和密码文件加入 Git。
若远端有本地没有的提交，先在 Git 工具中拉取、合并并处理冲突，再运行脚本。
第一次上传会把已归档的旧版本从远端当前分支移除，但它们仍保存在本地归档和 Git 历史里。

只检查，不提交/推送：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\upload-git.ps1 -CheckOnly
```
自定义提交说明：
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\upload-git.ps1 -Message "更新主页"
```
脚本仅在手动双击时运行，不会后台监视文件。

## GitHub 上传与网站发布的区别
Git 推送成功不代表已经自动部署网站。需要在 Cloudflare → Workers 与 Pages → dawnsea → 设置 → 构建，连接当前仓库：
- 生产分支：main
- 根目录：cloudflare
- 构建命令：npm run check
- 部署命令：npx wrangler d1 migrations apply DB --remote && npx wrangler deploy

完成首次连接后，每次运行上传脚本推送成功，Cloudflare 会自动构建发布。文章、会员、评论存储在 D1，不由 Git 同步或备份。
详细说明见 cloudflare/GitHub自动部署说明.md。
