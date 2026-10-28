# 当前服务器部署

2026-10-28，Vue 前端已部署到原 Nginx 服务。正式版与演示版分别构建、使用不同入口。

| 入口 | 地址 | 用途 |
|---|---|---|
| 正式前端 | http://43.128.232.108/#/library | API 模式，接入真实业务服务 |
| 前端体验 | http://43.128.232.108/demo/#/library | 明确标注演示数据，状态仅在当前页面会话中有效 |
| 信息提取体验 | http://43.128.232.108/demo/#/tool/extract | 可添加虚构资料、配置字段并查看演示结果 |
| 健康检查 | http://43.128.232.108/healthz | 前端服务状态 |
| 发布版本 | http://43.128.232.108/version.json | 构建时间、来源提交与源码摘要 |

服务器当前没有业务后端或后端代理。正式入口不会改用演示数据，`/api/` 明确返回 503 JSON。接入真实分析前，应依据 `API-CONTRACT.md` 配置业务网关、宿主身份、专用任务接口及相关权限。

## 发布与验证

- 当前版本目录：`/var/www/audit-document-studio/releases/vue-20261028T023610-TMZ5wP`。
- 服务目录：`/var/www/audit-document-studio/current`，通过符号链接切换版本。
- Nginx 配置：`/etc/nginx/conf.d/audit-document-studio.conf`。
- 上一版本：`/var/www/audit-document-studio/releases/vue-20261028T022010-7LHGOu`。
- 上一版本配置：`/var/www/audit-document-studio/config-backups/vue-20261028T023610-TMZ5wP.conf`。

本次发布 UI 还原修正：恢复左侧导航和紧凑命令栏，统一栏宽、字号、规则表与弹窗，资料预览恢复原文件 / 解析文本双栏，并修复 Office 阅读位置保持和手机目录显示。此前的 IP/HTTP UUID 兼容修正继续保留。

本次验证：92 项单元/接口测试、Vue 类型检查、两种模式生产构建通过。14 项工作区回归、13 项本地入口专项检查通过；上线后 35 项部署检查和 13 项入口专项检查通过，无页面运行错误或资源加载失败。结果见 `review/deployment/report.json`、`review/material-entry/server.json`。前次完整 UI 核对的 67 项检查保留在 `review/ui-restore/deployed-ui.json`，不计入本次复验数量。

62 个构建文件已逐个通过公网下载比对，文件字节与构建产物一致，JS/CSS 的 MIME 和 nosniff 正确，见 `review/deployment/assets.json`。本次源码摘要为 `c04a9e48c0ba7cea4f679823589e8a5b8468b86588c3386cebe976de80fa1a11`，构建时间为 2026-10-28 10:36:10（北京时间）。

所有发布文件来自构建产物；源码、依赖、环境文件和 source map 不发布到静态目录。资源按内容哈希缓存，首页和版本信息不长期缓存。Nginx 已运行并沿用原服务自启动设置。

## 后续发布

以下命令在 `frontend` 目录执行，构建目录须为本次发布专用目录：

```bash
npm test
npm run build -- --sourcemap hidden --outDir /tmp/audit-vue-next/api
npm run build -- --mode demo --base /demo/ --sourcemap hidden --outDir /tmp/audit-vue-next/demo
bash deploy/local-deploy.sh /tmp/audit-vue-next/api /tmp/audit-vue-next/demo
DEPLOY_URL=http://43.128.232.108 node tests/browser-deployment.mjs
```

部署脚本使用本机 sudo 权限，保存旧配置、创建版本目录，校验 Nginx 后切换。基本健康检查失败时自动恢复旧配置和版本；浏览器回归失败仍需根据检查结果决定回退。接入后端后，应先修改 `deploy/local-nginx.conf` 中 `/api/` 的代理配置，避免后续部署覆盖已有网关。

## 回退本次发布

```bash
sudo cp /var/www/audit-document-studio/config-backups/vue-20261028T023610-TMZ5wP.conf /etc/nginx/conf.d/audit-document-studio.conf
sudo ln -sfn /var/www/audit-document-studio/releases/vue-20261028T022010-7LHGOu /var/www/audit-document-studio/current.rollback
sudo mv -Tf /var/www/audit-document-studio/current.rollback /var/www/audit-document-studio/current
sudo nginx -t && sudo systemctl reload nginx
```

此回退恢复上一版 Vue 前端。发布记录标识基础提交 `c78a1ae` 与本次源码摘要；`sourceModified=true` 表示包含随后在本地完成的 UI 还原和 HTTP 兼容修正，不能把它当成基础提交的原样部署。发布元数据保留发布时的基础提交及源码摘要；后续 Git 提交收录对应源码与验证记录，未另外生成部署包。

本次后续调整：工具的资料添加入口仅保留在左侧资料区域；原文空态只显示预览提示。左侧“添加 / 添加项目”使用蓝色实心按钮及 16px 加粗文字。正式版与演示版均已同步。
