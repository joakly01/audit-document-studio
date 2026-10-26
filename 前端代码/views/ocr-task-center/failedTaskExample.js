// 任务失败和文件失败的示例数据
// 用于测试任务结果页面的失败状态显示

export const failedTaskExample = {
  task_id: 'task-000999',
  task_name: '失败任务示例',
  task_remark: '测试失败场景，包含多个失败文件，用于验证错误信息显示功能',
  agent_id: 'agent-001',
  agent_name: 'PDF解析智能体',
  status: 'failed',
  current_progress: '失败',
  current_node: 'OCR解析失败',
  file_count: 4,
  progress_detail: {
    steps: [
      {
        name: '文档上传',
        status: 'completed',
        timestamp: '2024-01-15 10:30:00'
      },
      {
        name: 'OCR解析',
        status: 'failed',
        timestamp: '2024-01-15 10:32:00'
      }
    ],
    current_step: 'ocr'
  },
  files: [
    {
      file_id: 'file-000001',
      file_name: '审计报告2024年度.pdf',
      file_type: 'pdf',
      file_size: 2048576,
      status: 'failed',
      progress: '失败',
      error_message: 'OCR解析失败：无法识别文档内容，文档可能已损坏或格式不支持。请检查文档质量或重新上传。',
      settings: {
        mode: 'field',
        prompt: '',
        template: '审计报告模板',
        fieldDefinitions: [
          {
            id: 1,
            name: '报告标题',
            type: 'String',
            description: '审计报告的标题'
          },
          {
            id: 2,
            name: '报告年度',
            type: 'String',
            description: '审计报告所属年度'
          },
          {
            id: 3,
            name: '被审计单位',
            type: 'String',
            description: '被审计的单位名称'
          }
        ],
        configured: true,
        configuredAt: '2024-01-15T10:25:00.000Z'
      }
    },
    {
      file_id: 'file-000002',
      file_name: '合同文件示例.docx',
      file_type: 'docx',
      file_size: 1536000,
      status: 'failed',
      progress: '失败',
      error_message: '文件解析失败：文档格式异常，无法提取内容。请确认文件完整性。',
      settings: {
        mode: 'prompt',
        prompt: '请识别并提取文档中的所有重要字段，包括但不限于：合同名称、双方信息、金额、日期等',
        template: '',
        fieldDefinitions: [],
        configured: true,
        configuredAt: '2024-01-15T10:26:00.000Z'
      }
    },
    {
      file_id: 'file-000003',
      file_name: '财务数据表.xlsx',
      file_type: 'xlsx',
      file_size: 512000,
      status: 'completed',
      progress: '已完成',
      error_message: null,
      settings: {
        mode: 'field',
        prompt: '',
        template: '发票提取模板',
        fieldDefinitions: [
          {
            id: 1,
            name: '发票号码',
            type: 'String',
            description: '发票的唯一编号'
          },
          {
            id: 2,
            name: '开票日期',
            type: 'Date',
            description: '发票开具日期'
          }
        ],
        configured: true,
        configuredAt: '2024-01-15T10:27:00.000Z'
      }
    },
    {
      file_id: 'file-000004',
      file_name: '演示文档.pdf',
      file_type: 'pdf',
      file_size: 1024000,
      status: 'processing',
      progress: '进行中',
      error_message: null,
      settings: {
        mode: 'prompt',
        prompt: '请帮我结构化这个文件，结果以JSON形式返回，包含文档类型、关键信息、摘要等字段',
        template: '',
        fieldDefinitions: [],
        configured: true,
        configuredAt: '2024-01-15T10:28:00.000Z'
      }
    }
  ],
  result_data: null,
  error_message: 'OCR解析失败：无法识别文档内容，请检查文档质量或格式。',
  created_at: '2024-01-15 10:25:00',
  updated_at: '2024-01-15 10:32:00',
  started_at: '2024-01-15 10:25:30',
  completed_at: null
}

// 使用说明：
// 1. 在 TaskResultViewer.vue 的 loadTaskData 函数中，可以临时使用这个示例数据：
//    taskData.value = failedTaskExample
//    fileList.value = failedTaskExample.files
//
// 2. 或者直接在浏览器控制台访问：
//    window.failedTaskExample = failedTaskExample
//
// 3. 访问路径示例：
//    /task-result?taskId=task-000999&fileId=file-000001


