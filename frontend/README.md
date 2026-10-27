# 文档挖掘助手 · Vue 前端

按《总体优化设计方案 V1.0》开发的 Vue 3 + TypeScript 前端工程。`src/` 是组件化业务源码，不是旧静态原型的打包壳。

## 本地运行

要求 Node.js 22.12+。

```bash
npm ci
npm run dev
```

默认真实接口模式。复制 `.env.example` 为 `.env.local`，设置 `API_PROXY_TARGET` 指向原业务服务，或由生产网关同源代理 `/api`。登录沿用宿主身份。

独立演示（不会调用真实分析服务）：

```bash
npm run dev -- --mode demo
```

演示模式有清楚标识，仅用于检查交互；不能用于判断模型分析能力。

## 校验与构建

```bash
npm run typecheck
npm test
npm run build
```

生产构建默认 API 模式。只有显式运行 `npm run build -- --mode demo` 才生成演示版。

本地已通过 89 项单元/接口契约测试与 60 个浏览器检查项，详见实施记录。浏览器回归需同时启动演示开发服务（5173）和生产预览（4173），再运行 `npm run test:browser`。默认 Chrome 路径为 `/opt/google/chrome/chrome`，其他环境可通过 `CHROME_PATH` 指定本机浏览器。

```bash
# 完成生产构建后，在另一个终端启动
npm run preview -- --port 4173
```

Dockerfile 与 Nginx 示例在工程中提供；尚未验证容器构建。Nginx 的 `/api` 默认返回“接口未配置”，需接宿主网关后才可正式使用。构建保留了 UI 依赖体积警告，Office 解析库为按需加载。

## 页面

- `#/library`：资料管理、文件/文件夹上传、解析与选择。
- `#/tool/extract`：信息提取。另有 word、theme、timeline、meeting、risk、bidding、contract、prepaid、engineering、association。
- `#/tasks`：跨工具分析记录与运行监控。
- `#/tasks/:id`：该任务对应的业务结果页。
- `#/tool/:tool/history`：当前工具的分析记录。
- `#/templates`：提取模板及字段管理。
- `#/prompts`：公共、机构、个人提示词。

在路由前加入 `?embed=1` 可隐藏独立导航，例如 `/?embed=1#/tool/extract`。

## 交接文档

- [工程与交互约束](docs/ARCHITECTURE.md)
- [API 对接与原源码依据](docs/API-CONTRACT.md)
- [资料管理与预览](docs/LIBRARY.md)
- [结果页面与任务生命周期](docs/RESULTS.md)
- [实施与验证记录](docs/implementation/progress.md)

**尚不能据此宣称生产联调完成。** 原提供目录是源码摘录，不是完整原工程；缺失专用 API、运行样例和生产身份等问题以对接清单为准。真实模式不使用模拟结果兜底。旧原型、截图、原源码与方案资料保持原样。
