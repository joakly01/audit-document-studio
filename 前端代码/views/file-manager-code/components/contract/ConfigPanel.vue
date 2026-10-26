<template>
  <div class="config-container">
    <el-select
      v-if="showTemplateSelect"
      v-model="localTemplate"
      placeholder="选择分析模板"
      style="width: 100%;"
      @change="handleTemplateChange"
      :disabled="loading || readonly"
    >
      <el-option label="自动" value="auto" />
      <el-option label="施工类合同" value="construction" />
      <el-option label="非施工类合同" value="non_construction" />
    </el-select>

    <div v-if="localTemplate !== 'auto'" class="config-body">
      <div class="config-scroll">
        <div class="rule-header rule-header--section">
          <span class="rule-title">选择提示词</span>
        </div>

        <div class="prompt-config">
          <div class="field-row">
            <div class="field-label-col">
              <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
              <span class="field-label-text">合规性分析</span>
            </div>
            <el-tree-select
              v-model="compliance_analysis_select"
              class="field-input"
              @change="handleCompliancePromptChange"
              :data="complianceAnalysisList"
              placeholder="请选择提示词"
              :props="treeProps"
              :render-after-expand="false"
              check-strictly
              :check-on-click-node="true"
              filterable
              :filter-method="filterPromptNode"
              :disabled="fieldDisabled"
            >
              <template #default="{ data }">
                <span :class="getNodeClass(data)">{{ data.name }}</span>
              </template>
            </el-tree-select>
          </div>
          <div class="field-block">
            <div class="field-label-col field-label-col--block">
              <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
              <span class="field-label-text">提示词内容</span>
            </div>
            <el-input
              :model-value="prompt.compliance_analysis_prompt"
              @update:model-value="handleCompliancePromptContentChange"
              type="textarea"
              :rows="5"
              :autosize="{ minRows: 5, maxRows: 15 }"
              placeholder="请输入或修改提示词内容"
              class="preserve-whitespace"
              :readonly="readonly"
            />
          </div>

          <div class="field-row">
            <div class="field-label-col">
              <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
              <span class="field-label-text">信息提取</span>
            </div>
            <el-tree-select
              v-model="information_extraction_select"
              class="field-input"
              @change="handleInformationPromptChange"
              :data="informationExtraction"
              placeholder="请选择提示词"
              :props="treeProps"
              :render-after-expand="false"
              check-strictly
              :check-on-click-node="true"
              filterable
              :filter-method="filterPromptNode"
              :disabled="fieldDisabled"
            >
              <template #default="{ data }">
                <span :class="getNodeClass(data)">{{ data.name }}</span>
              </template>
            </el-tree-select>
          </div>
          <div class="field-block">
            <div class="field-label-col field-label-col--block">
              <span class="field-required-mark field-required-mark--empty" aria-hidden="true">*</span>
              <span class="field-label-text">提示词内容</span>
            </div>
            <el-input
              :model-value="prompt.information_extraction_prompt"
              @update:model-value="handleInformationPromptContentChange"
              type="textarea"
              :rows="5"
              :autosize="{ minRows: 5, maxRows: 15 }"
              placeholder="请输入或修改提示词内容"
              class="preserve-whitespace"
              :readonly="readonly"
            />
          </div>
        </div>

        <div class="rule-header rule-header--section">
          <span class="rule-title">规则配置</span>
        </div>

        <div class="rule-list">
        <div 
          v-for="(rule, index) in localRuleList" 
          :key="index" 
          class="rule-item"
        >
          <div class="rule-item-header">
            <span class="rule-item-title">规则 {{ index + 1 }}</span>
            <el-button 
              v-show="!loading && !readonly"
              type="danger" 
              size="small" 
              :icon="Delete" 
              text
              @click="handleDeleteRule(index)"
            >
              删除
            </el-button>
          </div>
          
          <div class="rule-item-content">
            <el-form label-position="top" size="small">
              <el-form-item label="规则名称" required>
                <el-input 
                  v-model="rule.title" 
                  type="textarea"
                  :rows="2"
                  :autosize="{ minRows: 2 }"
                  placeholder="请输入规则名称（必填）"
                  :disabled="loading || readonly"
                  :class="{ 'is-error': validationErrors[`${index}_title`] }"
                />
                <div v-if="validationErrors[`${index}_title`]" class="error-message">
                  {{ validationErrors[`${index}_title`] }}
                </div>
              </el-form-item>
              
              <el-form-item label="规则描述" required>
                <el-input 
                  v-model="rule.description" 
                  type="textarea"
                  :rows="2"
                  :autosize="{ minRows: 2 }"
                  placeholder="请输入规则描述（必填）"
                  :disabled="loading || readonly"
                  :class="{ 'is-error': validationErrors[`${index}_description`] }"
                />
                <div v-if="validationErrors[`${index}_description`]" class="error-message">
                  {{ validationErrors[`${index}_description`] }}
                </div>
              </el-form-item>
              
              <el-form-item label="法规依据" required>
                <el-input 
                  v-model="rule.laws_and_regulations" 
                  type="textarea"
                  :rows="2"
                  :autosize="{ minRows: 2 }"
                  placeholder="请输入法规依据（必填）"
                  :disabled="loading || readonly"
                  :class="{ 'is-error': validationErrors[`${index}_laws_and_regulations`] }"
                />
                <div v-if="validationErrors[`${index}_laws_and_regulations`]" class="error-message">
                  {{ validationErrors[`${index}_laws_and_regulations`] }}
                </div>
              </el-form-item>
              
              <el-form-item label="判断标准" required>
                <el-input 
                  v-model="rule.judgment_rule" 
                  type="textarea"
                  :rows="2"
                  :autosize="{ minRows: 2 }"
                  placeholder="请输入判断标准（必填）"
                  :disabled="loading || readonly"
                  :class="{ 'is-error': validationErrors[`${index}_judgment_rule`] }"
                />
                <div v-if="validationErrors[`${index}_judgment_rule`]" class="error-message">
                  {{ validationErrors[`${index}_judgment_rule`] }}
                </div>
              </el-form-item>
              
              <el-form-item label="提取结果">
                <div class="extract-result-container">
                  <!-- 数据格式切换开关 -->
                  <div class="format-switch-wrapper">
                    <el-radio-group 
                      v-model="rule.data_format" 
                      size="small"
                      @change="handleDataFormatChange"
                      :disabled="loading || readonly"
                    >
                      <el-radio-button value="compliance" v-show="!loading">合规性</el-radio-button>
                      <el-radio-button value="completeness" v-show="!loading">完备性</el-radio-button>
                    </el-radio-group>
                    <span class="format-hint">
                      {{ rule.data_format === 'compliance' ? '(字符串格式)' : '(对象格式)' }}
                    </span>
                  </div>

                  <!-- 合规性模式：字符串输入 -->
                  <el-input 
                    v-if="rule.data_format === 'compliance'"
                    v-model="rule.extracted_value_compliance" 
                    @change="handleExtractedValueChange(rule)"
                    type="textarea"
                    :rows="3"
                    :autosize="{ minRows: 3 }"
                    placeholder="请输入提取结果（字符串格式）"
                    :readonly="readonly"
                  />

                  <!-- 完备性模式：key-value 编辑器 -->
                  <div v-else class="key-value-editor">
                    <div 
                      v-for="(value, key) in rule.extracted_value_completeness" 
                      :key="key"
                      class="key-value-item"
                    >
                      <!-- 查看模式 -->
                      <template v-if="!isEditing(rule, key)">
                        <div class="key-value-display">
                          <span class="key-text">{{ key }}</span>
                          <span class="separator">:</span>
                          <span class="value-text">{{ value }}</span>
                        </div>
                        <div class="button-group" v-show="!loading && !readonly">
                          <el-button 
                            type="primary" 
                            size="small"
                            :icon="Edit" 
                            circle 
                            @click="startEdit(rule, key, value)"
                          >
                          </el-button>
                          <el-button 
                            type="danger" 
                            :icon="Delete" 
                            circle 
                            size="small"
                            @click="deleteExtractedKeyValue(rule, key)"
                          />
                        </div>
                      </template>
                      
                      <!-- 编辑模式 -->
                      <template v-else>
                        <div class="input-group">
                          <el-input 
                            v-model="editingData[getEditKey(rule, key)].key"
                            placeholder="键"
                            class="key-input"
                          />
                          <el-input 
                            v-model="editingData[getEditKey(rule, key)].value"
                            placeholder="值"
                            class="value-input"
                          />
                        </div>
                        <div class="button-group" v-show="!loading && !readonly">
                          <el-button 
                            type="success" 
                            size="small"
                            :icon="Check"
                            circle
                            @click="saveEdit(rule, key)"
                          >
                          </el-button>
                          <el-button 
                            size="small"
                            :icon="Close"
                            circle
                            @click="cancelEdit(rule, key)"
                          >
                          </el-button>
                        </div>
                      </template>
                    </div>
                    <div v-show="!loading && !readonly" class="kv-add-field-bottom">
                      <el-button
                        class="ocr-select-files-btn ocr-footer-btn"
                        @click="addExtractedKeyValue(rule)"
                      >
                        <el-icon><Plus /></el-icon>
                        添加字段
                      </el-button>
                    </div>
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </div>
        </div>

        <el-empty
          v-if="localRuleList.length === 0"
          description="暂无规则，请点击底部按钮添加规则"
          :image-size="100"
        />
      </div>

      <div v-show="!loading && !readonly" class="ocr-sidebar-footer config-add-rule-bottom">
        <el-button class="ocr-select-files-btn ocr-footer-btn" @click="handleAddRule">
          <el-icon><Plus /></el-icon>
          添加规则
        </el-button>
      </div>
    </div>

    <div class="config-actions-bottom" v-if="!noExecute && !isSecondaryExecution">
      <el-button 
        type="primary"
        style="width: 100%;"
        @click="handleExecute" 
        :loading="loading"
      >
        执行
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, Check, Close } from '@element-plus/icons-vue'

const props = defineProps({
  template: {
    type: String,
    default: 'auto'
  },
  ruleList: {
    type: Array,
    default: () => []
  },
  prompt: {
    type: Object,
    default: () => {}
  },
  templateRuleList: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  noExecute: {
    type: Boolean,
    default: false
  },
  isSecondaryExecution: {
    type: Boolean,
    default: false
  },
  /** 是否在面板内展示模板下拉（顶栏已展示时传 false） */
  showTemplateSelect: {
    type: Boolean,
    default: true
  },
  /** 预览/任务详情只读，禁止编辑提示词与规则 */
  readonly: {
    type: Boolean,
    default: false
  }
})

/**
 * 表单控件是否禁用（加载中或只读预览）
 * @returns {boolean} 禁用时为 true
 */
const fieldDisabled = computed(() => props.loading || props.readonly)

const complianceAnalysisList = ref([])
const informationExtraction = ref([])

// 树形选择器配置
const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => {
    // 只有 prompt 项（isPrompt: true）可以选择
    // 文件夹和普通节点都不可选择
    return !data.isPrompt
  }
}

// 获取节点样式类
const getNodeClass = (data) => {
  // 如果是 prompt 项（可选择的节点）
  if (data.isPrompt) {
    return 'tree-node-prompt'
  }
  // 如果有 children，表示是文件夹或分组
  if (data.children && data.children.length > 0) {
    return 'tree-node-folder'
  }
  // 否则是不可选择的普通节点
  return 'tree-node-disabled'
}

// 树形选择器过滤方法
const filterPromptNode = (value, data) => {
  if (!value) return true
  const keyword = value.toLowerCase()
  // 只匹配提示词节点（isPrompt=true）
  if (data.isPrompt) {
    return data.name.toLowerCase().includes(keyword)
  }
  // 空间节点始终显示
  if (data.id && String(data.id).startsWith('space-')) {
    // 检查该空间下是否有匹配的提示词
    return hasMatchingPromptInTree(data, keyword)
  }
  // 分类节点：检查是否有匹配的子节点（提示词或子分类）
  return hasMatchingPromptInTree(data, keyword)
}

// 递归检查树中是否有匹配的提示词
const hasMatchingPromptInTree = (node, keyword) => {
  // 如果是提示词节点，检查是否匹配
  if (node.isPrompt) {
    return node.name.toLowerCase().includes(keyword)
  }
  // 如果有子节点，递归检查
  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasMatchingPromptInTree(child, keyword))
  }
  // 既不是提示词也没有子节点
  return false
}

// 从树中查找提示词节点
const findPromptInTree = (nodes, id) => {
  for (const node of nodes) {
    if (node.id === id && node.isPrompt) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

// 获取提示词树（一次请求获取完整树结构）
const getPromptTree = async () => {
  try {
    // 并行获取两种类型的提示词树
    const [complianceRes, infoRes] = await Promise.all([
      getPromptTreeByFunctionTypeNewAPI('compliance_analysis_prompt'),
      getPromptTreeByFunctionTypeNewAPI('information_extraction_prompt')
    ])

    // 处理合规性分析提示词树
    const complianceData = complianceRes.data
    if (complianceData && complianceData.items) {
      complianceAnalysisList.value = complianceData.items
      // 设置默认值
      if (complianceData.defaultPrompt && !props.prompt.compliance_analysis_prompt) {
        // 等待树数据渲染完成后再设置选中值
        await nextTick()
        compliance_analysis_select.value = complianceData.defaultPrompt.id
        emit('update:prompt', {
          ...props.prompt,
          compliance_analysis_prompt: complianceData.defaultPrompt.content
        })
      }
    }

    // 处理信息提取提示词树
    const infoData = infoRes.data
    if (infoData && infoData.items) {
      informationExtraction.value = infoData.items
      // 设置默认值
      if (infoData.defaultPrompt && !props.prompt.information_extraction_prompt) {
        // 等待树数据渲染完成后再设置选中值
        await nextTick()
        information_extraction_select.value = infoData.defaultPrompt.id
        emit('update:prompt', {
          ...props.prompt,
          information_extraction_prompt: infoData.defaultPrompt.content
        })
      }
    }
  } catch (error) {
    console.error('加载提示词树失败:', error)
    ElMessage.error('加载提示词列表失败')
    complianceAnalysisList.value = []
    informationExtraction.value = []
  }
}

onMounted(() => {
  getPromptTree()
})

const emit = defineEmits(['update:template', 'update:ruleList', 'update:prompt', 'execute', 'save'])

const compliance_analysis_select = ref(null)
const information_extraction_select = ref(null)

// 提示词变化处理
const handleCompliancePromptChange = (value) => {
  const prompt = findPromptInTree(complianceAnalysisList.value, value)
  if (prompt && prompt.content) {
    emit('update:prompt', {
      ...props.prompt,
      compliance_analysis_prompt: prompt.content
    })
  }
}

// 合规性分析提示词内容直接修改处理
const handleCompliancePromptContentChange = (value) => {
  emit('update:prompt', {
    ...props.prompt,
    compliance_analysis_prompt: value
  })
}

const handleInformationPromptChange = (value) => {
  const prompt = findPromptInTree(informationExtraction.value, value)
  if (prompt && prompt.content) {
    emit('update:prompt', {
      ...props.prompt,
      information_extraction_prompt: prompt.content
    })
  }
}

// 信息提取提示词内容直接修改处理
const handleInformationPromptContentChange = (value) => {
  emit('update:prompt', {
    ...props.prompt,
    information_extraction_prompt: value
  })
}

// 本地状态
const localTemplate = ref(props.template)
const localRuleList = ref([])

// 标志位，防止循环更新
const isUpdatingFromProps = ref(false)

// 编辑状态管理
const editingData = ref({})

// 校验错误状态
const validationErrors = ref({})

// 转换规则数据格式（将旧格式的 extracted_value 转换为新格式）
const normalizeRuleData = (rule) => {
  const newRule = { ...rule }
  
  // 如果存在旧字段 extracted_value，需要转换到新字段
  if ('extracted_value' in newRule && !('extracted_value_compliance' in newRule)) {
    const extractedValue = newRule.extracted_value
    
    // 根据 data_format 或数据类型判断应该放到哪个字段
    if (newRule.data_format === 'compliance' || typeof extractedValue === 'string') {
      // 合规性模式：字符串格式
      newRule.extracted_value_compliance = extractedValue || ''
      newRule.extracted_value_completeness = {}
      newRule.data_format = 'compliance'
    } else {
      // 完备性模式：对象格式
      newRule.extracted_value_compliance = ''
      newRule.extracted_value_completeness = extractedValue || {}
      newRule.data_format = 'completeness'
    }
  } else {
    // 如果是新格式，确保两个字段都存在
    if (!('extracted_value_compliance' in newRule)) {
      newRule.extracted_value_compliance = ''
    }
    if (!('extracted_value_completeness' in newRule)) {
      newRule.extracted_value_completeness = {}
    }
  }
  
  // 确保 data_format 字段存在
  if (!newRule.data_format) {
    newRule.data_format = 'compliance'
  }
  
  return newRule
}

// 初始化本地规则列表
localRuleList.value = props.ruleList.map(normalizeRuleData)

// 生成编辑键
const getEditKey = (rule, key) => {
  const ruleIndex = localRuleList.value.indexOf(rule)
  return `${ruleIndex}_${key}`
}

// 判断是否正在编辑
const isEditing = (rule, key) => {
  const editKey = getEditKey(rule, key)
  return !!editingData.value[editKey]
}

// 开始编辑
const startEdit = (rule, key, value) => {
  const editKey = getEditKey(rule, key)
  editingData.value[editKey] = {
    key: key,
    value: value,
    originalKey: key,
    originalValue: value
  }
}

// 提取结果变化处理
const handleExtractedValueChange = (rule) => {
  rule.extracted_value = '' + rule.extracted_value_compliance
}

// 保存编辑
const saveEdit = (rule, originalKey) => {
  const editKey = getEditKey(rule, originalKey)
  const edited = editingData.value[editKey]
  
  if (!edited) return
  
  const newKey = edited.key.trim()
  const newValue = edited.value
  
  if (!newKey) {
    ElMessage.warning('键名不能为空')
    return
  }
  
  const obj = getExtractedValueObject(rule.extracted_value_completeness)
  
  // 如果键名改变了，检查新键名是否已存在
  if (newKey !== originalKey) {
    if (newKey in obj) {
      ElMessage.warning('该键名已存在')
      return
    }
    
    // 创建新对象，保持顺序，替换旧键
    const newObj = {}
    for (const key in obj) {
      if (key === originalKey) {
        newObj[newKey] = newValue
      } else {
        newObj[key] = obj[key]
      }
    }
    rule.extracted_value_completeness = newObj
    rule.extracted_value = JSON.parse(JSON.stringify(newObj))
  } else {
    // 只更新值
    obj[originalKey] = newValue
    rule.extracted_value_completeness = obj
    rule.extracted_value = JSON.parse(JSON.stringify(obj))
  }
  
  // 清除编辑状态
  delete editingData.value[editKey]
  
  ElMessage.success('保存成功')
}

// 取消编辑
const cancelEdit = (rule, key) => {
  const editKey = getEditKey(rule, key)
  delete editingData.value[editKey]
}

// 监听 props 变化
watch(() => props.template, (newVal) => {
  isUpdatingFromProps.value = true
  localTemplate.value = newVal
  // 使用 nextTick 确保在下一个 tick 重置标志位
  setTimeout(() => {
    isUpdatingFromProps.value = false
  }, 0)
})

watch(() => props.ruleList, (newVal) => {
  isUpdatingFromProps.value = true
  localRuleList.value = newVal.map(normalizeRuleData)
  setTimeout(() => {
    isUpdatingFromProps.value = false
  }, 0)
}, { deep: true })

// 监听本地状态变化，同步到父组件
watch(localTemplate, (newVal) => {
  if (!isUpdatingFromProps.value) {
    emit('update:template', newVal)
  }
})

watch(localRuleList, (newVal) => {
  if (!isUpdatingFromProps.value) {
    emit('update:ruleList', newVal)
  }
  // 当规则列表变化时，清除所有校验错误（因为内容可能已经修改）
  clearValidationErrors()
}, { deep: true })

// 模板变化处理
const handleTemplateChange = () => {
  const templateRules = props.templateRuleList[localTemplate.value] || []
  const normalized = templateRules.map(normalizeRuleData)
  // 解除 props.template 回写时设置的标志位，避免 localRuleList watcher 跳过 emit
  isUpdatingFromProps.value = false
  localRuleList.value = normalized
}

// 添加规则
const handleAddRule = () => {
  localRuleList.value.push({
    title: '',
    description: '',
    laws_and_regulations: '',
    judgment_rule: '',
    extracted_value: null, // 最终提取结果
    extracted_value_compliance: '', // 合规性模式的数据
    extracted_value_completeness: {}, // 完备性模式的数据
    data_format: 'compliance' // 默认为合规性模式
  })
}

// 删除规则
const handleDeleteRule = (index) => {
  ElMessageBox.confirm(
    '确定要删除这条规则吗？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    localRuleList.value.splice(index, 1)
    ElMessage.success('删除成功')
  }).catch(() => {
    // 用户取消删除
  })
}

// 数据格式切换处理
const handleDataFormatChange = () => {
  // 切换模式时，两个字段的数据都会保留，不需要清空
  // 只是显示不同的字段而已
}

// 获取提取值对象
const getExtractedValueObject = (value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value || {}
}

// 删除键值对
const deleteExtractedKeyValue = (rule, key) => {
  ElMessageBox.confirm(
    `确定要删除字段"${key}"吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    const obj = getExtractedValueObject(rule.extracted_value_completeness)
    delete obj[key]
    
    rule.extracted_value_completeness = obj
    
    ElMessage.success('删除成功')
  }).catch(() => {
    // 用户取消删除
  })
}

// 添加键值对
const addExtractedKeyValue = (rule) => {
  const obj = getExtractedValueObject(rule.extracted_value_completeness)
  
  // 生成不重复的键名
  let newKey = '新字段'
  let counter = 1
  while (newKey in obj) {
    newKey = `新字段${counter}`
    counter++
  }
  
  obj[newKey] = ''
  
  rule.extracted_value_completeness = obj
  
  ElMessage.success('添加成功')
}

// 执行
const handleExecute = () => {
  emit('execute')
}

// 清空校验错误
const clearValidationErrors = () => {
  validationErrors.value = {}
}

// 校验单个字段
const validateField = (index, field, value, fieldLabel) => {
  const key = `${index}_${field}`
  
  // 对于非 extracted_value 字段，检查是否为空
  if (field !== 'extracted_value' && field !== 'data_format') {
    if (!value || (typeof value === 'string' && !value.trim())) {
      validationErrors.value[key] = `${fieldLabel}不能为空`
      return false
    }
  }
  
  // 清除该字段的错误
  delete validationErrors.value[key]
  return true
}

const RULE_FIELD_CONFIGS = [
  { field: 'title', label: '规则名称' },
  { field: 'description', label: '规则描述' },
  { field: 'laws_and_regulations', label: '法规依据' },
  { field: 'judgment_rule', label: '判断标准' }
]

/** 单条规则四字段是否均已填写 */
const isRuleEntryComplete = (rule) => {
  if (!rule || typeof rule !== 'object') return false
  return RULE_FIELD_CONFIGS.every(({ field }) => {
    const value = rule[field]
    return value != null && (typeof value !== 'string' || !!value.trim())
  })
}

/** 返回当前规则列表快照（供父组件批量校验/提交） */
const getRuleList = () => localRuleList.value.map((item) => ({ ...item }))

/** 静默校验：非 auto 模板下规则列表非空且字段完整 */
const areRulesComplete = () => {
  if (localTemplate.value === 'auto') return true
  if (!localRuleList.value.length) return false
  return localRuleList.value.every(isRuleEntryComplete)
}

// 校验所有规则
const validateRules = () => {
  // 清空之前的错误
  clearValidationErrors()

  // 如果是自动模式，不需要校验规则
  if (localTemplate.value === 'auto') {
    return true
  }

  // 如果没有规则，提示需要添加规则
  if (localRuleList.value.length === 0) {
    ElMessage.warning('请至少添加一条规则')
    return false
  }

  let isValid = true

  // 遍历所有规则进行校验
  localRuleList.value.forEach((rule, index) => {
    RULE_FIELD_CONFIGS.forEach(({ field, label }) => {
      const fieldValid = validateField(index, field, rule[field], label)
      if (!fieldValid) {
        isValid = false
      }
    })
  })

  // 如果有错误，提示用户
  if (!isValid) {
    ElMessage.error('请填写所有必填项')
    // 滚动到第一个错误位置
    setTimeout(() => {
      const firstError = document.querySelector('.is-error')
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  return isValid
}

// 暴露方法给父组件
defineExpose({
  validateRules,
  clearValidationErrors,
  handleTemplateChange,
  getRuleList,
  areRulesComplete
})
</script>

<style scoped>
.config-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.config-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.config-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 12px 12px;
}

.config-add-rule-bottom {
  width: 100%;
}

.kv-add-field-bottom {
  margin-top: 8px;
}

.field-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.field-block {
  margin-bottom: 12px;
}

.field-block > * + * {
  margin-top: 6px;
}

.field-label-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  width: 72px;
  padding-right: 10px;
  box-sizing: border-box;
  white-space: nowrap;
}

.field-label-col--block {
  justify-content: flex-start;
  width: auto;
  padding-right: 0;
}

.field-label-text {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}

.field-required-mark {
  flex-shrink: 0;
  width: 8px;
  margin-right: 2px;
  font-size: 12px;
  line-height: 1;
  color: #f56c6c;
  text-align: center;
}

.field-required-mark--empty {
  visibility: hidden;
}

.field-input {
  flex: 1;
  min-width: 0;
}

.prompt-config {
  margin-bottom: 8px;
}

.ocr-select-files-btn {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.ocr-select-files-btn:hover,
.ocr-select-files-btn:focus {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}

.ocr-footer-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
}

.ocr-sidebar-footer {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.config-actions-bottom {
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-shrink: 0;
  margin-top: auto;
}

.rule-header--section {
  margin-top: 8px;
}

/* 规则配置样式 */
.rule-config {
  display: flex;
  flex-direction: column;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.rule-list {
  flex: 1;
  padding: 12px 0;
}

.rule-item {
  border-radius: 4px;
  margin-bottom: 12px;
  overflow: hidden;
}

.rule-item:last-child {
  margin-bottom: 0;
}

.rule-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background: #f5f7fa;
  border-radius: 5px;
}

.rule-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.rule-item-content {
  padding: 5px;
}

.rule-item-content .el-form-item {
  margin-bottom: 5px;
}

.rule-item-content .el-form-item :deep(.el-form-item__label) {
  margin-bottom: 0;
}

.rule-item-content .el-form-item:last-child {
  margin-bottom: 0;
}

.extract-result-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}

/* 格式切换开关样式 */
.format-switch-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.format-hint {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

/* Key-Value 编辑器样式 */
.key-value-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;
  padding: 12px;
  border-radius: 4px;
}

.key-value-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
  flex-direction: column;
}

.key-value-item .key-input {
  flex: 0 0 120px;
  min-width: 120px;
}

.key-value-item .value-input {
  flex: 1;
  min-width: 0;
}

.key-value-item .key-value-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  background: #f5f7fa;
  border-radius: 4px;
  min-height: 32px;
}

.key-value-item .key-text {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.key-value-item .separator {
  color: #909399;
  margin: 0 4px;
}

.key-value-item .value-text {
  color: #606266;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.key-value-item .button-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  justify-content: flex-end
}

.key-value-editor .add-btn {
  align-self: flex-start;
  margin-top: 4px;
}

/* 校验错误样式 */
.error-message {
  color: #f56c6c;
  font-size: 12px;
  line-height: 1;
  margin-top: 4px;
  animation: shake 0.3s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

:deep(.is-error .el-textarea__inner),
:deep(.is-error .el-input__inner) {
  border-color: #f56c6c !important;
}

:deep(.is-error .el-textarea__inner:focus),
:deep(.is-error .el-input__inner:focus) {
  border-color: #f56c6c !important;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2) !important;
}

/* 必填项标识 */
.rule-item-content :deep(.el-form-item.is-required:not(.is-no-asterisk) > .el-form-item__label:before) {
  content: '*';
  color: #f56c6c;
  margin-right: 4px;
}

/* 树形选择器节点样式 */
:deep(.tree-node-folder) {
  font-weight: 600;
  color: #409eff;
}

:deep(.tree-node-selectable) {
  color: #303133;
  font-weight: 500;
}

:deep(.tree-node-prompt) {
  color: #67c23a;
  font-size: 13px;
  padding-left: 4px;
}

:deep(.tree-node-prompt)::before {
  content: '📄';
  margin-right: 4px;
}

:deep(.tree-node-disabled) {
  color: #c0c4cc;
}

/* 保留空格和换行符样式 */
.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
}
</style>

