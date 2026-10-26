# 本机部署

部署对象为当前优化版的 `dist/` 静态前端。原始 `前端代码/` 是组件和接口摘录，不是可独立构建的完整 Vue 工程；此次不更改原始组件或后台接口。

本机使用 Nginx 的 80 端口，已设为系统开机自动启动。仅发布静态文件，不发布工程源码、Git 目录、规范材料或运行凭据。

保留 PDF 分段读取，并显式配置 `.mjs` 的 JavaScript MIME 类型，避免 PDF 预览组件被浏览器拦截。IP 地址的 HTTP 环境通过浏览器已有的 `crypto.getRandomValues` 补充 UUID，供文件预览令牌、模板和任务编号使用；HTTPS 环境继续使用原生实现。

- 公网入口：http://43.128.232.108/#library
- 信息提取：http://43.128.232.108/#tool/extract
- 内网入口：http://10.7.0.7/#library
- 本机入口：http://127.0.0.1/#library
- 站点目录：`/var/www/audit-document-studio/current`
- Nginx 配置：`/etc/nginx/conf.d/audit-document-studio.conf`
- 访问日志：`/var/log/nginx/audit-document-studio.access.log`
- 错误日志：`/var/log/nginx/audit-document-studio.error.log`

更新前端后，在本目录执行 `bash local-deploy.sh` 即可部署当前 `dist/`；脚本需要本机 sudo 权限，会校验配置、切换独立版本目录并重载服务。旧版本位于 `/var/www/audit-document-studio/releases/`，回退时将 `current` 符号链接切回对应目录并重载 Nginx。

维护命令：

```bash
sudo systemctl status nginx
sudo nginx -t
sudo systemctl reload nginx
curl http://127.0.0.1/healthz
```

部署验证：在工程根目录运行 `python3 tests/browser_local_deployment.py`。已检查健康入口、模块 MIME、PDF 分段读取、四项主页面，以及 PDF/Word/Excel 预览；证据位于 `review/local-deployment-checks.json`。

当前部署为前端交互工程。AI 执行、正式账号权限、后台任务、服务端存储仍按原接入说明联调。浏览器保存的数据按访问地址隔离，原托管站点中的浏览器数据不会自动迁移到本机站点。
