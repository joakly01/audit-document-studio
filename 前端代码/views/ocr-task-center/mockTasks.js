// OCR 任务中心模拟数据
import { failedTaskExample } from './failedTaskExample.js'

// 生成随机时间戳
const generateTime = (daysAgo = 0) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(date.getHours() - Math.floor(Math.random() * 24))
  date.setMinutes(date.getMinutes() - Math.floor(Math.random() * 60))
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

// 文件类型配置
const fileTypes = ['pdf', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'txt', 'md']
const fileTypeNames = {
  pdf: 'PDF',
  docx: 'DOCX',
  xlsx: 'XLSX',
  pptx: 'PPTX',
  doc: 'DOC',
  xls: 'XLS',
  ppt: 'PPT',
  txt: 'TXT',
  md: 'MD'
}

// 智能体配置
const agents = [
  { id: 'agent-001', name: 'PDF解析智能体' },
  { id: 'agent-002', name: 'Word解析智能体' },
  { id: 'agent-003', name: 'Excel解析智能体' },
  { id: 'agent-004', name: 'PPT解析智能体' },
  { id: 'agent-005', name: '通用文档解析智能体' }
]

// 节点状态定义
const nodeStatuses = {
  pending: '文档上传完成',
  processing_ocr: '正在OCR解析',
  processing_ai: '正在大模型分析',
  processing_format: '正在归档排版',
  completed: '解析完成',
  failed_ocr: 'OCR解析失败',
  failed_ai: '大模型分析失败',
  failed_format: '归档排版失败'
}

// 步骤定义
const steps = [
  { name: '文档上传', key: 'upload' },
  { name: 'OCR解析', key: 'ocr' },
  { name: '大模型分析', key: 'ai' },
  { name: '归档排版', key: 'format' }
]

// 生成步骤详情
const generateProgressDetail = (status, currentStep = null) => {
  const detail = {
    steps: [],
    current_step: currentStep || 'upload'
  }

  let stepIndex = 0
  if (status === 'completed') {
    // 所有步骤完成
    steps.forEach((step, index) => {
      detail.steps.push({
        name: step.name,
        status: 'completed',
        timestamp: generateTime(3 - index)
      })
    })
    detail.current_step = 'format'
  } else if (status === 'failed') {
    // 根据失败节点设置
    if (currentStep === 'ocr') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(2)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'failed',
        timestamp: generateTime(1)
      })
      detail.current_step = 'ocr'
    } else if (currentStep === 'ai') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(2)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'completed',
        timestamp: generateTime(1)
      })
      detail.steps.push({
        name: steps[2].name,
        status: 'failed',
        timestamp: generateTime(0)
      })
      detail.current_step = 'ai'
    } else if (currentStep === 'format') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(3)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'completed',
        timestamp: generateTime(2)
      })
      detail.steps.push({
        name: steps[2].name,
        status: 'completed',
        timestamp: generateTime(1)
      })
      detail.steps.push({
        name: steps[3].name,
        status: 'failed',
        timestamp: generateTime(0)
      })
      detail.current_step = 'format'
    }
  } else if (status === 'processing') {
    // 进行中的任务
    if (currentStep === 'ocr') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(1)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'processing',
        timestamp: generateTime(0)
      })
      detail.current_step = 'ocr'
    } else if (currentStep === 'ai') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(2)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'completed',
        timestamp: generateTime(1)
      })
      detail.steps.push({
        name: steps[2].name,
        status: 'processing',
        timestamp: generateTime(0)
      })
      detail.current_step = 'ai'
    } else if (currentStep === 'format') {
      detail.steps.push({
        name: steps[0].name,
        status: 'completed',
        timestamp: generateTime(3)
      })
      detail.steps.push({
        name: steps[1].name,
        status: 'completed',
        timestamp: generateTime(2)
      })
      detail.steps.push({
        name: steps[2].name,
        status: 'completed',
        timestamp: generateTime(1)
      })
      detail.steps.push({
        name: steps[3].name,
        status: 'processing',
        timestamp: generateTime(0)
      })
      detail.current_step = 'format'
    }
  } else {
    // 未开始
    detail.steps.push({
      name: steps[0].name,
      status: 'pending',
      timestamp: null
    })
    detail.current_step = 'upload'
  }

  return detail
}

// 生成示例结果数据
const generateResultData = () => {
  return {
    document_type: '合同',
    extracted_fields: {
      '合同名称': '技术服务合同',
      '甲方': '某某科技有限公司',
      '乙方': '某某服务有限公司',
      '合同金额': '100万元',
      '签订日期': '2024-01-15',
      '合同期限': '2024年1月1日至2024年12月31日'
    },
    summary: '这是一份技术服务合同，合同金额为100万元，合同期限为一年。',
    pages: 15,
    words: 3500
  }
}

// 生成文件列表
const generateFiles = (count, baseIndex, fileTypes, inputMode = 'prompt') => {
  const files = []
  const prompts = [
    '请帮我结构化这个文件，结果以JSON形式返回，包含文档类型、关键信息、摘要等字段',
    '提取文档中的关键信息，包括标题、作者、日期、主要内容等，并以结构化格式返回',
    '分析文档内容，提取重要数据点，生成结构化的JSON结果',
    '请识别并提取文档中的所有重要字段，包括但不限于：合同名称、双方信息、金额、日期等'
  ]
  const templates = ['默认模板', '合同提取模板', '发票提取模板', '审计报告模板']
  
  // 字段模式的字段定义模板
  const fieldDefinitionsTemplates = [
    // 合同提取模板
    [
      { id: 1, name: '合同名称', type: 'String', description: '合同的名称或标题' },
      { id: 2, name: '甲方', type: 'String', description: '合同甲方名称' },
      { id: 3, name: '乙方', type: 'String', description: '合同乙方名称' },
      { id: 4, name: '合同金额', type: 'String', description: '合同约定的金额' },
      { id: 5, name: '签订日期', type: 'Date', description: '合同签订日期' }
    ],
    // 发票提取模板
    [
      { id: 1, name: '发票号码', type: 'String', description: '发票的唯一编号' },
      { id: 2, name: '开票日期', type: 'Date', description: '发票开具日期' },
      { id: 3, name: '开票单位', type: 'String', description: '开具发票的单位名称' },
      { id: 4, name: '金额', type: 'Number', description: '发票金额' },
      { id: 5, name: '税额', type: 'Number', description: '发票税额' }
    ],
    // 审计报告模板
    [
      { id: 1, name: '报告标题', type: 'String', description: '审计报告的标题' },
      { id: 2, name: '报告年度', type: 'String', description: '审计报告所属年度' },
      { id: 3, name: '被审计单位', type: 'String', description: '被审计的单位名称' },
      { id: 4, name: '审计机构', type: 'String', description: '执行审计的机构名称' },
      { id: 5, name: '审计意见', type: 'String', description: '审计意见类型' }
    ],
    // 默认模板
    [
      { id: 1, name: '文档标题', type: 'String', description: '文档的标题' },
      { id: 2, name: '创建日期', type: 'Date', description: '文档创建日期' },
      { id: 3, name: '作者', type: 'String', description: '文档作者' },
      { id: 4, name: '关键词', type: 'String', description: '文档关键词' }
    ]
  ]
  
  for (let i = 0; i < count; i++) {
    const fileType = fileTypes[i % fileTypes.length]
    const fileIndex = baseIndex * 10 + i + 1
    const fileStatus = Math.random() > 0.3 ? 'completed' : (Math.random() > 0.5 ? 'processing' : 'pending')
    const hasError = fileStatus === 'failed' || (Math.random() < 0.1 && fileStatus === 'completed')
    
    // 生成文件设置（模拟从文档预览页面保存的设置）
    const templateIndex = i % templates.length
    const settings = {
      mode: inputMode,
      prompt: inputMode === 'prompt' ? prompts[i % prompts.length] : '',
      template: inputMode === 'field' ? templates[templateIndex] : '',
      fieldDefinitions: inputMode === 'field' ? fieldDefinitionsTemplates[templateIndex] : [],
      configured: true,
      configuredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    }
    
    files.push({
      file_id: `file-${String(fileIndex).padStart(6, '0')}`,
      file_name: `示例文档${fileIndex}.${fileType}`,
      file_type: fileType,
      file_size: Math.floor(Math.random() * 10000000) + 100000, // 100KB - 10MB
      status: fileStatus,
      progress: fileStatus === 'completed' ? '已完成' : (fileStatus === 'processing' ? '进行中' : (fileStatus === 'failed' ? '失败' : '未开始')),
      error_message: hasError ? '处理过程中发生错误，请检查文件格式或重试' : null,
      settings: settings
    })
  }
  return files
}

// 生成输入参数
const generateInputParams = (mode, agent, index) => {
  if (mode === 'agent') {
    return {
      mode: 'agent',
      content: agent.name
    }
  } else if (mode === 'prompt') {
    const prompts = [
      '请帮我结构化这个文件，结果以JSON形式返回，包含文档类型、关键信息、摘要等字段',
      '提取文档中的关键信息，包括标题、作者、日期、主要内容等，并以结构化格式返回',
      '分析文档内容，提取重要数据点，生成结构化的JSON结果',
      '请识别并提取文档中的所有重要字段，包括但不限于：合同名称、双方信息、金额、日期等'
    ]
    return {
      mode: 'prompt',
      content: prompts[index % prompts.length]
    }
  } else if (mode === 'field') {
    const templates = ['合同提取模板', '发票提取模板', '审计报告模板', '自定义字段提取']
    return {
      mode: 'field',
      content: templates[index % templates.length]
    }
  }
  return {
    mode: 'agent',
    content: agent.name
  }
}

// 生成当前进度文本（四个状态：等待中、进行中、已完成、失败）
const getCurrentProgressText = (status) => {
  const progressMap = {
    pending: '等待中',
    processing: '进行中',
    completed: '已完成',
    failed: '失败'
  }
  return progressMap[status] || '等待中'
}

// 生成任务数据
const generateTask = (index, status, fileTypes, agent, currentStep = null, inputMode = 'prompt') => {
  const taskId = `task-${String(index + 1).padStart(6, '0')}`
  const fileCount = Math.floor(Math.random() * 5) + 1 // 1-5个文件
  const files = generateFiles(fileCount, index, fileTypes, inputMode)
  
  let currentNode = nodeStatuses.pending
  let progressDetail = generateProgressDetail(status, currentStep)
  let resultData = null
  let errorMessage = null
  let startedAt = null
  let completedAt = null
  const currentProgress = getCurrentProgressText(status)

  if (status === 'processing') {
    if (currentStep === 'ocr') {
      currentNode = nodeStatuses.processing_ocr
    } else if (currentStep === 'ai') {
      currentNode = nodeStatuses.processing_ai
    } else if (currentStep === 'format') {
      currentNode = nodeStatuses.processing_format
    }
    startedAt = generateTime(1)
  } else if (status === 'completed') {
    currentNode = nodeStatuses.completed
    resultData = generateResultData()
    startedAt = generateTime(2)
    completedAt = generateTime(0)
    // 所有文件标记为已完成
    files.forEach(file => {
      file.status = 'completed'
      file.progress = '已完成'
    })
  } else if (status === 'failed') {
    if (currentStep === 'ocr') {
      currentNode = nodeStatuses.failed_ocr
      errorMessage = 'OCR解析失败：无法识别文档内容，请检查文档质量或格式。'
    } else if (currentStep === 'ai') {
      currentNode = nodeStatuses.failed_ai
      errorMessage = '大模型分析失败：模型处理超时，请稍后重试。'
    } else if (currentStep === 'format') {
      currentNode = nodeStatuses.failed_format
      errorMessage = '归档排版失败：结果格式化错误，请联系管理员。'
    }
    startedAt = generateTime(1)
  }

  // 生成任务名称
  const taskName = inputMode === 'agent' 
    ? `${agent.name}任务-${index + 1}`
    : inputMode === 'prompt'
    ? `Prompt模式任务-${index + 1}`
    : `字段模式任务-${index + 1}`

  // 生成任务备注（部分任务有备注）
  const taskRemarks = [
    '批量处理合同文档，需要提取关键信息',
    '审计报告解析，重点关注财务数据',
    '发票识别任务，提取发票号码和金额',
    '文档归档任务，需要结构化存储',
    null, // 部分任务没有备注
    null,
    '重要文档处理，请仔细核对结果',
    null
  ]
  const taskRemark = taskRemarks[index % taskRemarks.length]

  return {
    task_id: taskId,
    task_name: taskName,
    task_remark: taskRemark,
    agent_id: agent.id,
    agent_name: agent.name,
    status: status,
    current_progress: currentProgress,
    current_node: currentNode,
    file_count: fileCount,
    progress_detail: progressDetail,
    files: files,
    result_data: resultData,
    error_message: errorMessage,
    created_at: generateTime(status === 'pending' ? 0 : 2),
    updated_at: generateTime(0),
    started_at: startedAt,
    completed_at: completedAt
  }
}

// 生成模拟任务列表
export const mockTasks = [
  // 已完成的任务 - 智能体调用
  generateTask(0, 'completed', ['pdf', 'docx'], agents[0], 'format', 'agent'),
  generateTask(1, 'completed', ['docx', 'xlsx'], agents[1], 'format', 'agent'),
  generateTask(2, 'completed', ['xlsx', 'pptx'], agents[2], 'format', 'agent'),
  
  // 已完成的任务 - Prompt模式
  generateTask(3, 'completed', ['pdf', 'docx', 'xlsx'], agents[0], 'format', 'prompt'),
  generateTask(4, 'completed', ['pptx', 'pdf'], agents[1], 'format', 'prompt'),
  
  // 已完成的任务 - 字段模式
  generateTask(5, 'completed', ['pdf', 'docx'], agents[2], 'format', 'field'),
  
  // 进行中的任务 - 智能体调用
  generateTask(6, 'processing', ['docx', 'pdf'], agents[1], 'ocr', 'agent'),
  generateTask(7, 'processing', ['pdf', 'xlsx'], agents[0], 'ai', 'agent'),
  
  // 进行中的任务 - Prompt模式
  generateTask(8, 'processing', ['xlsx', 'pptx', 'docx'], agents[2], 'format', 'prompt'),
  
  // 进行中的任务 - 字段模式
  generateTask(9, 'processing', ['pptx', 'pdf'], agents[3], 'ocr', 'field'),
  
  // 失败的任务
  generateTask(10, 'failed', ['pdf', 'docx'], agents[0], 'ocr', 'agent'),
  generateTask(11, 'failed', ['docx', 'xlsx'], agents[1], 'ai', 'prompt'),
  
  // 失败任务示例（包含失败文件）
  failedTaskExample,
  
  // 未开始的任务
  generateTask(12, 'pending', ['pdf', 'docx'], agents[0], null, 'agent'),
  generateTask(13, 'pending', ['txt', 'md'], agents[4], null, 'field'),
  generateTask(14, 'pending', ['pdf'], agents[0], null, 'prompt'),
]

// 导出工具函数
export const getFileTypeIcon = (fileType) => {
  const iconMap = {
    pdf: 'Document',
    docx: 'Document',
    doc: 'Document',
    xlsx: 'Document',
    xls: 'Document',
    pptx: 'Document',
    ppt: 'Document',
    txt: 'Document',
    md: 'Document'
  }
  return iconMap[fileType] || 'Document'
}

// 格式化日期时间
export const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return '-'
  const date = new Date(dateTimeString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export const getStatusType = (status) => {
  const typeMap = {
    pending: 'info',
    processing: 'primary',
    completed: 'success',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

export const getStatusText = (status) => {
  const textMap = {
    pending: '未开始',
    processing: '进行中',
    completed: '已完成',
    failed: '失败'
  }
  return textMap[status] || status
}

export default mockTasks


