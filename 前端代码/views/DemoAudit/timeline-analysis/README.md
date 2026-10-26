# 时间轴分析模块 前端代码索引

> 供 AI Agent 快速定位文件、理解数据流、完成开发任务使用。

---

## 文件结构

```
timeline-analysis/
├── index.vue                          # 路由入口，仅渲染 TimelineAnalysisViewer
├── TimelineAnalysisViewer.vue         # 业务容器，页面 & 弹窗通用
└── components/
    ├── TimelineDisplay.vue            # 时间轴渲染（搜索/日期筛选内聚）
    ├── CreateTaskDialog.vue           # 创建任务弹窗（提示词选择内聚）
    └── ProgressDialog.vue            # 进度弹窗（轮询逻辑内聚）
```

---

## API 层

| 文件路径 | 函数名 | 用途 |
|----------|--------|------|
| `@/api/IcssPlatform/timelineAnalysis.js` | `createTimelineAnalysisAPI(payload)` | 创建分析任务，返回 `{ task_uuid, task_name }` |
| `@/api/IcssPlatform/timelineAnalysis.js` | `getTimelineAnalysisResultAPI(analysisId)` | 拉取分析结果，返回 `{ events[], files[] }` |
| `@/api/task.js` | `getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })` | 轮询任务进度，返回 `{ task_status, runtime_nodes[], step_tree[] }` |
| `@/api/IcssPlatform/promptManagement.js` | `getPromptTreeByFunctionTypeNewAPI('timeline_analysis')` | 获取提示词树，返回 `{ items[], defaultPrompt }` |

---

## 组件职责与接口

### TimelineAnalysisViewer.vue
**角色**：业务容器，管理跨组件共享状态。

**props**:
- `analysisId: String` — 外部传入已有分析ID（弹窗模式或任务详情模式），传入后自动调用 `loadAnalysisResult`

**emits**:
- `close-dialog` — 通知外部关闭弹窗（供弹窗调用方监听）

**管理的核心状态**:
```
timelineData[]        // 时间轴事件数据，传给 TimelineDisplay
activeFileId          // 当前高亮的文件ID，双向联动
filesFromResult[]     // 从结果中还原的文件列表，传给 FileUploadPanel.inputDocuments
isAnalyzing           // 分析进行中标志
pendingDocumentIds[]  // 待创建任务的文件ID列表
currentTaskUuid       // 当前任务UUID，传给 ProgressDialog
```

**数据流（用户操作路径）**:
```
FileUploadPanel @execute
  → handleFilePanelExecute → 打开 CreateTaskDialog（传入 documentIds）
  → CreateTaskDialog @taskCreated(taskUuid)
  → handleTaskCreated → 打开 ProgressDialog（传入 taskUuid）
  → ProgressDialog @completed(taskUuid)
  → handleProgressCompleted → loadAnalysisResult(taskUuid) → 更新 timelineData
```

**结果加载路径（只读模式）**:
```
onMounted / watch(props.analysisId)
  → loadAnalysisResult(analysisId)
  → timelineData = data.events
  → filesFromResult = 从 events 提取 / data.files
```

**复用方式（其他页面弹窗调用）**:
```vue
<el-dialog v-model="visible" width="90vw">
  <TimelineAnalysisViewer
    :analysisId="selectedTaskUuid"
    @close-dialog="visible = false"
  />
</el-dialog>
```

---

### components/TimelineDisplay.vue
**角色**：纯展示组件，搜索/筛选状态完全内聚，父组件无需感知。

**props**:
- `timelineData: Array` — 时间轴事件列表，格式见下方数据结构
- `activeFileId: String` — 当前激活文件ID，用于高亮显示

**emits**:
- `timelineClick(fileId)` — 用户点击卡片时触发，父组件更新 `activeFileId` 并联动 FileUploadPanel

**内聚状态（父组件不需要传入）**:
- `searchQuery` — 关键词搜索
- `startDate / endDate` — 日期范围（随 `timelineData` 变化自动初始化为最小/最大日期）
- `collapsedDates` — 日期折叠状态（Set）
- `expandedEvents` — 事件展开状态（Set）

---

### components/CreateTaskDialog.vue
**角色**：创建任务弹窗，含提示词选择逻辑，调用 `createTimelineAnalysisAPI`。

**props**:
- `v-model:visible` — 弹窗显隐
- `defaultTaskName: String` — 弹窗打开时预填的任务名
- `documentIds: Array` — 待分析的文件ID列表

**emits**:
- `taskCreated(taskUuid, taskName)` — 创建成功后触发，父组件用 `taskUuid` 打开 ProgressDialog
- `update:visible` — 关闭弹窗

**内聚逻辑**:
- `onMounted` 时自动调用 `getPromptTreeByFunctionTypeNewAPI('timeline_analysis')` 加载提示词树
- 自动回填 `defaultPrompt`
- 创建成功后同时向 `eventBus` emit `task-progress-start`（供任务中心感知）

**createTimelineAnalysisAPI 请求 payload**:
```js
{
  document_ids: String[],
  task_name: String,
  task_notes?: String,        // 备注（可选）
  prompt_id?: Number,         // 选中的提示词ID（可选）
  prompt?: String,            // 提示词内容（可选）
}
```

---

### components/ProgressDialog.vue
**角色**：进度弹窗，自管理任务进度轮询，无需父组件参与轮询逻辑。

**props**:
- `v-model:visible` — 弹窗显隐（关闭时自动停止轮询）
- `taskUuid: String` — 任务UUID（变化时自动重启轮询）

**emits**:
- `completed(taskUuid)` — 任务完成，父组件负责加载结果（调用 `loadAnalysisResult`）
- `failed` — 任务失败
- `update:visible` — 关闭弹窗

**轮询逻辑**:
- 间隔：`2000ms`，超时上限：`10分钟`
- 轮询接口：`getTaskSchedulesAPI(taskUuid, { prefer_runtime: true })`
- `task_status === 2` → COMPLETED；`task_status === 3` → FAILED
- 节点数据优先取 `runtime_nodes`，fallback `step_tree`
- `onBeforeUnmount` 时自动清除定时器

---

## 数据结构

### TimelineEvent（timelineData 中的单条数据）
```ts
{
  id: string           // 事件唯一ID
  fileId: string       // 所属文件ID
  fileName: string     // 文件名（展示用）
  date: string         // 日期，格式 "YYYY-MM-DD"
  title: string        // 事件标题
  sections: Array<{
    subtitle: string   // 小节标题
    content: string    // 小节内容
  }>
}
```

### filesFromResult（传给 FileUploadPanel.inputDocuments）
```ts
Array<{
  document_id: string
  file_name: string
}>
```

---

## 公共依赖

| 依赖 | 路径 | 用途 |
|------|------|------|
| FileUploadPanel | `@/views/DemoAudit/meeting-minutes-analysis/components/FileUploadPanel.vue` | 左侧文件上传/选择面板，复用会议纪要模块组件 |
| TaskRuntimeProgressTree | `@/views/file-manager-code/components/contract/TaskRuntimeProgressTree.vue` | 任务进度节点树渲染 |
| eventBus | `@/utils/eventBus.js` | 触发 `task-progress-start` 事件通知任务中心 |

---

## 常见修改场景

**修改时间轴卡片展示样式** → `components/TimelineDisplay.vue`，样式类前缀 `tld-`

**修改创建任务弹窗表单字段** → `components/CreateTaskDialog.vue`，样式类前缀 `ctd-`

**修改进度弹窗轮询行为（间隔/超时）** → `components/ProgressDialog.vue`，常量 `PROGRESS_POLL_INTERVAL` / `MAX_PROGRESS_POLL_MS`

**新增弹窗调用入口（其他页面）** → 直接包裹 `TimelineAnalysisViewer`，传 `analysisId` prop

**修改提示词加载逻辑** → `components/CreateTaskDialog.vue` 的 `getPromptTree()` 函数
