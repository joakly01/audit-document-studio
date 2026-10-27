# 接口适配证据与联调边界

本工程没有后端实现、在线服务地址或可用身份凭证。API adapter 可运行且已使用请求桩验证；这不等同于真实后端联调完成。默认 `VITE_DATA_MODE=api`（不配置也为 API）；只有显式 `VITE_DATA_MODE=demo` 才启用独立内存演示。API 失败、无权限、业务错误、静态站点回退均直接报错，不切换演示。

## 已采用的原代码证据

- `前端代码/api/fileManager.js`：目录树、文件分页/空间查询、上传、解析重排、原文/预览、表头、附件关联。
- `前端代码/api/task.js`：通用 `BatchExecuteByFilter`、`task-CreateSchedules`、`PageList`、`GetTaskSchedules`、导出、原任务重试、费用继续、两表比较、合同报告。原删除/终止共用接口存在完成瞬间误删历史的竞态，新 adapter 不用该接口执行停止。
- `前端代码/api/template.js`：提取模板和目录 CRUD。
- `前端代码/api/IcssPlatform/promptManagement.js`：功能提示词树、个人空间与提示词 CRUD；另存保留 `config`。
- `前端代码/views/file-manager-code/composables/buildToolBatchExecutePayload.js` 及 `buildWordCloudBatchExecutePayload.js`、`buildThemeAnalysisBatchExecutePayload.js`、`buildMeetingMinutesExecutePayload.js`：任务元数据、文件执行配置、词表、双阶段提示词、会议阈值（百分比除以100）。当前提交的是用户确认的解析完成文件 ID 快照，不再提交可变目录范围。
- `前端代码/views/file-manager-code/ContractViewer.vue`、`前端代码/views/document-mining/PrepaidExpensesPrototype.vue`、工程与两表原组件及 helpers：合同规则剥离已提取值、费用提取/继续、工程 F 键映射、两表比较配置。

`src/services/legacy` 保留原工程单表、两表配置 helper 和合同结果解析器，注明来源。工程逐文件、逐模式配置任意稳定 F 键、字段类型、权重和评分规则；移除字段时裁剪受影响的组合规则，不改其他台账。两表保留字段映射、权重、评分规则、候选数/总对数/匹配锁及组合判断。合同规则保留 title、description、laws_and_regulations、judgment_rule，删除历史提取值。

## 11 工具提交约定

| 工具 | 主要提交结构 | 创建接口 |
|---|---|---|
| 信息提取 | custom fields、合并附件、切片长度、重叠长度 | 通用 BatchExecuteByFilter |
| 词云 | stop_words / user_dict_words | 通用 BatchExecuteByFilter |
| 主题归纳 | prompt + theme_summarization_prompt | 通用 BatchExecuteByFilter |
| 时间轴 | files、prompt/prompt_id、background | 显式配置 |
| 会议纪要 | files、提取/风险提示词、相似度、最小聚类数 | 显式配置 |
| 风险点 | byFile/byRisk、已选风险点、实际提示词正文 | 通用 BatchExecuteByFilter |
| 招投标 | analysis_modes、mode_configs、projects 的招标文件与投标单位 | 显式配置 |
| 合同 | 自动类别仅 parameter_settings.button；指定类别包含规则原结构与双阶段提示词 | 通用 BatchExecuteByFilter |
| 待摊费用 | exec_phase=extract、费用类型、双阶段正文 | 通用 BatchExecuteByFilter |
| 工程一致性 | 每文件 duplicate_detection / parent_child_analysis | 通用 BatchExecuteByFilter |
| 两表关联 | task_schedule_results[].parameter_settings，table1/2、config | task-CreateSchedules |

## 必须确认或配置的边界

`VITE_API_BASE_URL` 配置 API 域名（可留空使用同源代理）；默认携带 Cookie，宿主也可调用 `setTokenProvider` 提供仅驻内存的令牌。专用接口变量使用相对基础地址的路径。身份凭据不能放入 VITE 变量，这些值会写入浏览器产物。

原 API 目录没有会议、时间轴、招投标的完整专用 API 模块。部分视图/构造器提及地址不能证明生产服务已部署，因此以下接口必须由宿主显式指定，缺少配置时禁止提交：

- `VITE_MEETING_SUBMIT_URL`
- `VITE_TIMELINE_SUBMIT_URL`
- `VITE_BIDDING_SUBMIT_URL`
- `VITE_MEETING_RISK_URL` / `VITE_MEETING_QUESTION_URL`（后续操作，可用 `{id}` 占位符）

可选 `VITE_MATERIALS_URL` 为 POST 批量元数据查询，正文 `{file_ids}`；未配置时只能重新核对已载入资料所在目录。跨会话历史来源需要完整资料快照或该元数据接口，只有来源 ID 时不会制造文件记录。再次分析也需要完整资料、提示词和配置快照；新提交任务仅在当前会话保留草稿副本，跨会话须由后端返回。

`VITE_TASK_STOP_URL` 为独立取消接口，POST `{task_uuid}`，路径支持 `{id}`。必须原子执行“只取消排队/运行中的任务，保留历史与已完成结果”；已结束时返回无操作或冲突，绝不能删除。未配置时不显示停止操作，也不调用旧 `DeleteTaskSchedules`。不能仅将新地址代理到旧 DELETE；前端先查状态无法消除该接口的竞态。

`VITE_TASK_ATTACHMENTS_URL` 当前作为宿主已支持任务正文 `attachment_overrides` 的能力开关标识，并不被调用为独立上传接口。未声明此能力时，adapter 核对本次附件是否与资料库已保存关系相同，不暗中修改资料库关系。接入时必须确认创建接口接受该字段及其快照语义。

待摊界面基数显示“元”，原前端却直接写入名为 `billing_base_wan` 的参数，证据相互不一致。默认禁用继续计算；只有后端确认接口接收元且无需换算后，才设置 `VITE_PREPAID_UNIT_CONFIRMED=true`。本适配未根据字段名擅自换算。

文件全选会分页完整读取当前过滤范围，核对总数变化并去重，默认上限5000。超过上限或范围变化时明确失败，不把首屏当作全部。更大规模需后端选择快照API。

## 结果与演示

normalizers 识别原 `task_schedule_result_list`、DISPOSAL_RESULT 大写字段、多层 JSON、数值解析状态；未知类型/状态保留 unknown，不从歧义 task_type=10 猜工具。已适配：

| 原结构 | 新结果视图 |
|---|---|
| 提取 final_result.items | 字段/values、完整字段详情与 evidence_list，保留金额 0 和未找到标记 |
| 主题 joint_table / topic_summary | 资料要点表与归纳正文分开展示，兼容 outputs.text |
| 风险 items / data.items | 风险路径、等级、描述和真实来源 |
| 合同 outputs.text / text_2 | 复用原解析器；规则与补充分析，缺失结论不当成“符合” |
| 费用 text_1 / billing_agreement_text | 计费约定，存在 text_2 则保留计算内容；prepaid_phase 区分执行阶段 |
| 工程 duplicate_detection / parent_child_analysis | 重复/主子项目结果、分阶段错误和明确空列表 |
| 两表 compare_response | comparison_results、双侧 unique_items 与实际返回的 differences |
| 词云专用结果 files[].word_counts | GET /api/v1/word-cloud/tasks/{id}/result，聚合有效文件词频并保留来源 |

标准结构与已知别名统一到业务组件，同一任务的新旧结构分别适配再合并。未知内容保留 `unmapped` 与原 schedules；状态元数据不冒充提取字段，不补造金额、评分、页码和结论。仍需真实响应逐工具联调。

演示 provider 每实例独立，刷新后重置。78份资料、三空间、四解析状态、16条任务及11类历史结果、模板、提示词均为明确标记的虚构数据；演示上传不会上传服务器。演示 Excel 使用 SheetJS 生成有效工作簿，演示报告是明确标识的 TXT，不以重命名 JSON 冒充 Office 文件。

验证索引见 `implementation/progress.md`。本地测试覆盖业务错误、静态页面回退、分页上限、配置/阈值/规则、结果转换、导出格式、个人提示词及演示隔离。上线前仍需真实服务验证身份权限、分页总数、11类提交结果、取消原子语义、文件内容和大批量容量。

## 个人词库

沿用 GET/PUT `/api/v1/word-cloud/lexicon`。按 200 条分页、最多读取 10000 条，要求总数并检查重复/缺页。保存前重读比较，变化时阻止覆盖。此客户端检查不具备原子性，多端编辑仍需后端 revision / If-Match 或逐项更新，不可将其视为并发事务保护。

## 合同报告与导出

按原 `views/file-manager-code/composables/useContractReport.js`，报告绑定源任务，不创建新分析任务：

- GET `/api/v1/task/ContractReportBySource/{source_task_uuid}`：查询状态。
- POST `/api/v1/task/ContractReportGenerate/{source_task_uuid}`：分析结束且有结果后生成。
- GET `/api/v1/task/ContractReportDownload/{source_task_uuid}`：鉴权下载。原 API 参数名为 report_task_uuid，但原 composable 实际传源分析任务 ID；联调时确认当前后端仍支持此行为。

报告状态独立轮询，离开页面清理，未知状态禁止重复生成。真实报告的 Word 格式仍须验收。合同表格导出沿用 ExportContractCompletenessResults；工程沿用 ExportEngineeringProjectResultsZip，保存为 ZIP；其余使用 ExportExecutionRecords，JSON 保留实际返回内容。
