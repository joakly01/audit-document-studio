# 会议纪要分析功能

## 概述
会议纪要分析功能是一个用于分析和聚类会议纪要文档的前端界面，能够从会议文档中提取议题、按相似性进行聚类，并提供可视化的时间轴展示。

## 功能特性
- 支持多种文档格式（PDF、DOC、DOCX）
- 智能议题提取和聚类
- 会议时间轴可视化
- 多维度筛选和搜索
- 结果导出和导入功能
- 文件过期验证机制

## 目录结构
```
meeting-minutes-analysis/
├── components/                 # 组件目录
│   ├── ClusterResultPanel.vue  # 聚类结果面板
│   ├── ConfigPanel.vue         # 配置面板
│   ├── FileUploadPanel.vue     # 文件上传面板
│   ├── MeetingTimeline.vue     # 会议时间轴
│   └── TopicDetailDialog.vue   # 议题详情弹窗
├── index.vue                   # 主页面
├── mockData.js                 # 模拟数据
└── README.md                   # 本文档
```

## 主要组件

### FileUploadPanel.vue
- 文件上传和管理组件
- 支持本地上传和从文件管理器选择
- 文件状态管理（上传中、失败、过期等）
- 文件过期验证机制

### ConfigPanel.vue
- 配置和筛选组件
- 提示词选择和编辑
- 解析配置（相似度阈值、最小聚类数等）
- 筛选条件（参会人员、时间范围、金额范围、关键字等）

### ClusterResultPanel.vue
- 聚类结果显示组件
- 议题聚类列表显示
- 详细信息表格
- 议题详情弹窗

### MeetingTimeline.vue
- 会议时间轴组件
- 按日期分组显示会议
- 会议和议题的可视化展示
- 交互式选择功能

### TopicDetailDialog.vue
- 议题详情弹窗组件
- 议题信息展示
- 内容概括显示
- 原文预览功能
- 文件下载功能

## API 接口
所有API调用均通过 `@/api/meetingMinutesAnalysis.js` 进行管理，包括：
- 创建并执行会议纪要分析
- 获取单次会议纪要分析详情
- 获取文档预览内容
- 下载文档原文件
- 批量验证文档是否有效

## 使用场景
1. **立即执行**：前端实时分析，不存储到数据库
2. **后台执行**：存储到数据库，支持后续查询

## 技术栈
- Vue 3 + Composition API
- Element Plus 组件库
- SCSS 样式
- localStorage 状态管理