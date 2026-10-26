<template>
  <div class="config-panel-wrapper">
    <div class="config-panel">
      <!-- 提示词卡片 -->
      <div class="config-card">
        <div class="config-card-header">
          <el-icon><EditPen /></el-icon>
          <span>提示词</span>
        </div>
        <div class="config-card-body">
          <!-- 提示词选择器 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">系统提示词</label>
              <el-tree-select
                :key="'system-prompt-' + promptTreeSelectKey"
                v-model="selectedPromptId"
                @change="handlePromptSelect"
                :data="promptTreeData"
                placeholder="选择模板"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
                filterable
                :filter-node-method="filterPromptNode"
                style="width: 100%"
                size="small"
                :disabled="false"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">
                    {{ data.name }}
                  </span>
                </template>
              </el-tree-select>
            </div>
          </div>
          <!-- 提示词内容 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">提示词内容</label>
              <div class="prompt-preview-wrapper">
                <div class="prompt-preview">
                  {{ localConfig.prompt || '未设置提示词' }}
                </div>
                <el-button type="primary" size="small" class="prompt-view-btn" @click="handleView('system')">查看</el-button>
              </div>
            </div>
          </div>

          <!-- 风险分析提示词选择器 -->
          <div class="config-row">
            <div class="config-item">
              <label>风险分析提示词:</label>
              <el-tree-select
                :key="'risk-prompt-' + riskPromptTreeSelectKey"
                v-model="selectedRiskPromptId"
                @change="handleRiskPromptSelect"
                :data="riskPromptTreeData"
                placeholder="选择模板"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
                filterable
                :filter-node-method="filterPromptNode"
                style="width: 100%"
                size="small"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">
                    {{ data.name }}
                  </span>
                </template>
              </el-tree-select>
            </div>
          </div>
          <!-- 风险分析提示词内容 -->
          <div class="config-row">
            <div class="config-item">
              <div class="prompt-preview-wrapper">
                <div class="prompt-preview">
                  {{ localConfig.riskPrompt || '未设置风险分析提示词' }}
                </div>
                <el-button type="primary" size="small" class="prompt-view-btn" @click="handleView('risk')">查看</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 解析配置卡片 -->
      <div class="config-card">
        <div class="config-card-header">
          <el-icon><Setting /></el-icon>
          <span>解析配置</span>
        </div>
        <div class="config-card-body">
          <!-- 相似度阈值 -->
          <div class="config-row">
            <div class="config-item field-block config-item-flex">
              <label class="field-label-text">相似度阈值</label>
              <div class="config-control">
                <el-slider v-model="localConfig.similarityThreshold" :min="0" :max="100" :step="1" />
                <span class="config-display">{{ localConfig.similarityThreshold }}%</span>
              </div>
            </div>
          </div>
          
          <!-- 最小聚类数 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">最小聚类数</label>
              <el-input-number
                v-model="localConfig.minClusterSize"
                :min="1"
                :max="20"
                :precision="0"
                :controls="true"
                size="small"
                style="width: 140px"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 筛选条件卡片 -->
      <div class="config-card" :class="{ 'config-card--disabled': filtersDisabled }">
        <div class="config-card-header">
          <el-icon><Search /></el-icon>
          <span>筛选条件</span>
        </div>
        <div class="config-card-body">
          <!-- 参会人员 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">参会人员</label>
              <el-input
                v-model="localFilters.participants"
                placeholder="姓名,多个用|分隔"
                size="small"
                :disabled="filtersDisabled"
              />
            </div>
          </div>

          <!-- 时间范围 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">时间范围</label>
              <div class="range-input">
                <el-date-picker
                  v-model="localFilters.dateStart"
                  type="date"
                  placeholder="开始..."
                  size="small"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  clearable
                  :disabled="filtersDisabled"
                />
                <span>至</span>
                <el-date-picker
                  v-model="localFilters.dateEnd"
                  type="date"
                  placeholder="结束..."
                  size="small"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  clearable
                  :disabled="filtersDisabled"
                />
              </div>
            </div>
          </div>

          <!-- 金额范围 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">金额范围</label>
              <div class="range-input">
                <el-input v-model="localFilters.amountMin" placeholder="最小..." size="small" :disabled="filtersDisabled" />
                <span>至</span>
                <el-input v-model="localFilters.amountMax" placeholder="最大..." size="small" :disabled="filtersDisabled" />
              </div>
            </div>
          </div>

          <!-- 关键字搜索 -->
          <div class="config-row">
            <div class="config-item field-block">
              <label class="field-label-text">关键字搜索</label>
              <div class="keyword-group">
                <el-input
                  v-model="localFilters.keywords"
                  placeholder="在议题名称..."
                  size="small"
                  :disabled="filtersDisabled"
                />
                <el-checkbox v-model="localFilters.regularExpression" size="small" :disabled="filtersDisabled">
                  正则
                </el-checkbox>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 操作按钮 - 固定在底部 -->
    <div class="config-actions">
      <div class="config-actions__row">
        <el-button
          type="primary"
          size="small"
          class="action-btn"
          :disabled="filtersDisabled"
          @click="handleApplyFilters"
        >应用筛选</el-button>
        <el-button
          type="info"
          size="small"
          class="action-btn"
          :disabled="filtersDisabled"
          @click="handleClearFilters"
        >清除筛选</el-button>
      </div>
      <div class="config-actions__row config-actions__row--triple">
        <el-button type="primary" size="small" class="action-btn" @click="handleViewResult">
          查看结果
        </el-button>
        <el-button
          type="success"
          size="small"
          class="action-btn export-btn"
          :loading="exportLoading"
          @click="handleExportCommand('excel')"
        >
          <span v-if="!exportLoading">结果导出</span>
        </el-button>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleImport"
          :accept="supportedFileTypes"
          :disabled="readonly"
          class="import-upload"
        >
          <el-button type="warning" size="small" class="action-btn" :disabled="readonly">结果导入</el-button>
        </el-upload>
      </div>
    </div>

    <!-- 查看提示词对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      :title="viewDialogType === 'risk' ? '风险分析提示词详情' : '提示词详情'"
      width="600px"
      :close-on-click-modal="true"
      destroy-on-close
    >
      <div class="prompt-dialog-content">
        <pre class="prompt-text">{{ viewDialogContent }}</pre>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, watch, computed, ref, onMounted, nextTick } from 'vue'
import { EditPen, Setting, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getPromptTreeByFunctionTypeNewAPI,
  getPromptDetailAPI
} from '@/api/IcssPlatform/promptManagement.js'
import { importAnalysisResultAPI } from '@/api/meetingMinutesAnalysis.js'

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  filters: {
    type: Object,
    required: true
  },
  readonly: {
    type: Boolean,
    default: false
  },
  /** 分析未成功完成前禁用筛选区（含应用/清除按钮） */
  filtersDisabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['apply-filters', 'clear-filters', 'update:config', 'export', 'import-result', 'view-result'])

// 本地配置副本
const localConfig = reactive({ ...props.config })
const localFilters = reactive({ ...props.filters })

// 提示词选择相关
const selectedPromptId = ref(null)
const promptTreeData = ref([])
const promptTreeSelectKey = ref(0)

// 风险分析提示词（SDSSJT-1052:接入真实提示词树）
const selectedRiskPromptId = ref(null)
const riskPromptTreeData = ref([])
const riskPromptTreeSelectKey = ref(0)

// 树形选择器配置
const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => {
    // 只有 prompt 项（isPrompt: true）可以选择
    return !data.isPrompt
  }
}

// 获取节点样式类
const getNodeClass = (data) => {
  if (data.isPrompt) {
    return 'tree-node-prompt'
  }
  if (data.children && data.children.length > 0) {
    return 'tree-node-folder'
  }
  return 'tree-node-disabled'
}

// 提示词搜索过滤方法
const filterPromptNode = (value, data) => {
  if (!value) return true
  return data.name && data.name.toLowerCase().includes(value.toLowerCase())
}

// 从树中查找提示词节点（id 类型不敏感，String 比较）
const findPromptInTree = (nodes, id) => {
  if (!nodes || id === null || id === undefined) return null
  const strId = String(id).trim()
  if (!strId) return null
  for (const node of nodes) {
    if (String(node.id) === strId && node.isPrompt) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

// 按正文匹配提示词（id 在树中找不到时的兜底）
const findPromptByContent = (nodes, content) => {
  const normalized = (content || '').trim()
  if (!nodes || !normalized) return null
  for (const node of nodes) {
    if (node.isPrompt && (node.content || '').trim() === normalized) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptByContent(node.children, content)
      if (found) return found
    }
  }
  return null
}

/** id 优先，正文兜底 */
const resolvePromptInTree = (nodes, id, content) => {
  if (!nodes || !nodes.length) return null
  return findPromptInTree(nodes, id) || findPromptByContent(nodes, content)
}

/** 强制 tree-select 重新解析 label（避免先绑 id 后加载树时只显示数字） */
const applyTreeSelectValue = async (selectedRef, node) => {
  if (!node) {
    selectedRef.value = null
    return
  }
  selectedRef.value = null
  await nextTick()
  selectedRef.value = node.id
}

/** 历史任务引用的提示词不在当前可见树中时，补一条虚拟节点以便展示名称 */
const ensureOrphanPromptNode = async (treeRef, selectKeyRef, id, content) => {
  if (!id || findPromptInTree(treeRef.value, id)) return
  try {
    const res = await getPromptDetailAPI(id)
    const prompt = res?.data
    if (!prompt?.id) return
    treeRef.value = [
      ...treeRef.value,
      {
        id: prompt.id,
        name: prompt.name || `提示词 #${id}`,
        content: prompt.content || content || '',
        isPrompt: true,
        isOrphan: true
      }
    ]
    selectKeyRef.value += 1
  } catch (error) {
    console.warn('[ConfigPanel] 无法补全历史提示词节点:', id, error)
  }
}

const applyPromptSelection = async ({
  treeRef,
  selectKeyRef,
  selectedRef,
  promptId,
  promptContent,
  configIdKey,
  configContentKey
}) => {
  if (!treeRef.value.length) return

  if (!promptId && !promptContent) {
    await applyTreeSelectValue(selectedRef, null)
    return
  }

  let matchNode = resolvePromptInTree(treeRef.value, promptId, promptContent)
  if (!matchNode && promptId) {
    await ensureOrphanPromptNode(treeRef, selectKeyRef, promptId, promptContent)
    matchNode = resolvePromptInTree(treeRef.value, promptId, promptContent)
  }

  await applyTreeSelectValue(selectedRef, matchNode)
  if (matchNode) {
    if (promptContent && !localConfig[configContentKey] && matchNode.content) {
      localConfig[configContentKey] = matchNode.content
    }
    if (String(localConfig[configIdKey] ?? '') !== String(matchNode.id)) {
      localConfig[configIdKey] = matchNode.id
    }
  }
}

/** 将 config 中的 promptId 同步到 tree-select（必须使用树节点 id 类型，否则显示数字而非名称） */
const syncPromptSelectorsFromConfig = async () => {
  await applyPromptSelection({
    treeRef: promptTreeData,
    selectKeyRef: promptTreeSelectKey,
    selectedRef: selectedPromptId,
    promptId: localConfig.promptId,
    promptContent: localConfig.prompt,
    configIdKey: 'promptId',
    configContentKey: 'prompt'
  })

  await applyPromptSelection({
    treeRef: riskPromptTreeData,
    selectKeyRef: riskPromptTreeSelectKey,
    selectedRef: selectedRiskPromptId,
    promptId: localConfig.riskPromptId,
    promptContent: localConfig.riskPrompt,
    configIdKey: 'riskPromptId',
    configContentKey: 'riskPrompt'
  })
}

// 获取提示词树（一次请求获取完整树结构）
const getPromptTree = async () => {
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI('meeting_minutes')
    const data = res.data

    if (!data || !data.items) {
      promptTreeData.value = []
      return
    }

    // 直接使用后端返回的树结构
    promptTreeData.value = data.items
    promptTreeSelectKey.value += 1

    await nextTick()

    // 树加载完成后，优先回写已有的 promptId（taskDetail 模式下 config 已填充）
    await applyPromptSelection({
      treeRef: promptTreeData,
      selectKeyRef: promptTreeSelectKey,
      selectedRef: selectedPromptId,
      promptId: localConfig.promptId,
      promptContent: localConfig.prompt,
      configIdKey: 'promptId',
      configContentKey: 'prompt'
    })

    if (!localConfig.promptId && data.defaultPrompt) {
      if (!selectedPromptId.value) {
        if (!localConfig.prompt) {
          await applyTreeSelectValue(selectedPromptId, data.defaultPrompt)
          localConfig.prompt = data.defaultPrompt.content
          localConfig.promptId = data.defaultPrompt.id
          emit('update:config', { ...localConfig })
        } else if (localConfig.prompt === data.defaultPrompt.content) {
          await applyTreeSelectValue(selectedPromptId, data.defaultPrompt)
          localConfig.promptId = data.defaultPrompt.id
          emit('update:config', { ...localConfig })
        }
      }
    }
  } catch (error) {
    console.error('获取提示词树失败:', error)
    promptTreeData.value = []
  }
}

// 提示词选择处理
const handlePromptSelect = (value) => {
  if (!value) {
    localConfig.prompt = ''
    localConfig.promptId = null
    emit('update:config', { ...localConfig })
    return
  }

  // 从树中查找提示词，直接使用 content
  const prompt = findPromptInTree(promptTreeData.value, value)
  if (prompt && prompt.content) {
    localConfig.prompt = prompt.content
    localConfig.promptId = value
    emit('update:config', { ...localConfig })
  }
}

// 风险分析提示词选择处理
const handleRiskPromptSelect = (value) => {
  if (!value) {
    localConfig.riskPrompt = ''
    localConfig.riskPromptId = null
    emit('update:config', { ...localConfig })
    return
  }

  const prompt = findPromptInTree(riskPromptTreeData.value, value)
  if (prompt && prompt.content) {
    localConfig.riskPrompt = prompt.content
    localConfig.riskPromptId = value
    emit('update:config', { ...localConfig })
  }
}

// 风险分析提示词树拉取（SDSSJT-1052:meeting_minutes_risk 类型码）
const getRiskPromptTree = async () => {
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI('meeting_minutes_risk')
    const data = res.data
    if (!data || !data.items) {
      riskPromptTreeData.value = []
      return
    }
    riskPromptTreeData.value = data.items
    riskPromptTreeSelectKey.value += 1
    await nextTick()

    await applyPromptSelection({
      treeRef: riskPromptTreeData,
      selectKeyRef: riskPromptTreeSelectKey,
      selectedRef: selectedRiskPromptId,
      promptId: localConfig.riskPromptId,
      promptContent: localConfig.riskPrompt,
      configIdKey: 'riskPromptId',
      configContentKey: 'riskPrompt'
    })

    if (!localConfig.riskPromptId && data.defaultPrompt) {
      if (!selectedRiskPromptId.value) {
        if (!localConfig.riskPrompt) {
          await applyTreeSelectValue(selectedRiskPromptId, data.defaultPrompt)
          localConfig.riskPrompt = data.defaultPrompt.content
          localConfig.riskPromptId = data.defaultPrompt.id
          emit('update:config', { ...localConfig })
        } else if (localConfig.riskPrompt === data.defaultPrompt.content) {
          await applyTreeSelectValue(selectedRiskPromptId, data.defaultPrompt)
          localConfig.riskPromptId = data.defaultPrompt.id
          emit('update:config', { ...localConfig })
        }
      }
    }
  } catch (err) {
    console.error('[ConfigPanel] getRiskPromptTree failed:', err)
    ElMessage.error('风险提示词加载失败,请稍后重试')
    riskPromptTreeData.value = []
  }
}

onMounted(async () => {
  await Promise.all([getPromptTree(), getRiskPromptTree()])
  await syncPromptSelectorsFromConfig()
})

// 监听props变化同步到本地
watch(() => props.config, async (newVal) => {
  Object.assign(localConfig, newVal)
  // 从任务中心跳转时 promptId 为字符串，须映射为树节点 id 才能显示名称
  await syncPromptSelectorsFromConfig()
}, { deep: true })

// 树加载晚于 config 回填时，再次同步选中项
watch(riskPromptTreeData, async (items) => {
  if (!items.length) return
  if (!localConfig.riskPromptId && !localConfig.riskPrompt) return
  await applyPromptSelection({
    treeRef: riskPromptTreeData,
    selectKeyRef: riskPromptTreeSelectKey,
    selectedRef: selectedRiskPromptId,
    promptId: localConfig.riskPromptId,
    promptContent: localConfig.riskPrompt,
    configIdKey: 'riskPromptId',
    configContentKey: 'riskPrompt'
  })
})

watch(promptTreeData, async (items) => {
  if (!items.length) return
  if (!localConfig.promptId && !localConfig.prompt) return
  await applyPromptSelection({
    treeRef: promptTreeData,
    selectKeyRef: promptTreeSelectKey,
    selectedRef: selectedPromptId,
    promptId: localConfig.promptId,
    promptContent: localConfig.prompt,
    configIdKey: 'promptId',
    configContentKey: 'prompt'
  })
})

// 监听本地提示词变化，实时同步到父组件（确保立即执行时能获取最新值）
watch(() => localConfig.prompt, (newVal, oldVal) => {
  // 只有值真正变化时才同步，避免循环触发
  if (newVal !== oldVal && newVal !== props.config.prompt) {
    emit('update:config', { ...localConfig })
  }
})

watch(() => props.filters, (newVal) => {
  Object.assign(localFilters, newVal)
}, { deep: true })

// 只读模式下的显示文本
const promptPreview = computed(() => {
  const prompt = localConfig.prompt || '未设置提示词'
  const maxLength = 100
  if (prompt.length <= maxLength) return prompt
  return prompt.substring(0, maxLength) + '...'
})

// 应用筛选
const handleApplyFilters = () => {
  if (props.filtersDisabled) {
    ElMessage.warning('请先完成分析后再使用筛选条件')
    return
  }
  emit('apply-filters', { config: localConfig, filters: localFilters })
  ElMessage.success('筛选条件已应用')
}

// 清除筛选
const handleClearFilters = () => {
  if (props.filtersDisabled) {
    return
  }
  localFilters.participants = ''
  localFilters.dateStart = ''
  localFilters.dateEnd = ''
  localFilters.amountMin = ''
  localFilters.amountMax = ''
  localFilters.keywords = ''
  localFilters.regularExpression = false
  
  emit('clear-filters', localFilters)
  ElMessage.info('筛选条件已清除')
}

// 查看结果
const handleViewResult = () => {
  emit('view-result')
}

// 查看对话框控制
const viewDialogVisible = ref(false)
const viewDialogType = ref('system')

const viewDialogContent = computed(() => {
  if (viewDialogType.value === 'risk') {
    return localConfig.riskPrompt || ''
  }
  return localConfig.prompt || ''
})

// 查看
const handleView = (type = 'system') => {
  const content = type === 'risk' ? localConfig.riskPrompt : localConfig.prompt
  const emptyTip = type === 'risk' ? '暂无风险分析提示词内容' : '暂无提示词内容'
  if (!content) {
    ElMessage.warning(emptyTip)
    return
  }
  viewDialogType.value = type
  viewDialogVisible.value = true
}

// 支持的导入文件类型
const supportedFileTypes = '.xlsx,.json'

// 导出loading状态
const exportLoading = ref(false)

// 导出命令处理
const handleExportCommand = async (format) => {
  exportLoading.value = true
  emit('export', {
    format,
    onDone: () => { exportLoading.value = false }
  })
}

// 导入
const handleImport = async (file) => {
  const fileName = file.name || ''
  const fileExt = fileName.split('.').pop().toLowerCase()

  // 校验文件类型
  if (!['xlsx', 'json'].includes(fileExt)) {
    ElMessage.error('不支持的文件格式，请上传 .xlsx 或 .json 文件')
    return
  }

  // 文件大小校验 (10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 10MB')
    return
  }

  try {
    const response = await importAnalysisResultAPI(file.raw)

    if (response.data?.success) {
      const { analysis_id, meetings, clusters } = response.data
      if (!meetings || !Array.isArray(meetings)) {
        ElMessage.error('导入失败：数据格式错误')
        return
      }
      // 通知父组件直接使用导入的数据
      emit('import-result', { analysisId: analysis_id, meetings, clusters })
      ElMessage.success('导入成功')
    } else {
      // 显示错误信息
      const errors = response.data?.errors || []
      if (errors.length > 0) {
        const errorMsg = errors.map(e => {
          if (e.sheet) {
            return `[${e.sheet}] 第${e.row}行：${e.field} - ${e.error}`
          }
          return e.error
        }).join('\n')
        ElMessage.error({
          message: '导入失败：\n' + errorMsg,
          duration: 5000,
          showClose: true
        })
      } else {
        ElMessage.error('导入失败，请检查文件格式')
      }
    }
  } catch (error) {
    console.error('导入分析结果失败:', error)
    ElMessage.error('导入失败：' + (error.message || '网络错误'))
  }
}
</script>

<style scoped lang="scss">
.config-panel-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.config-panel {
  padding: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f0f2f5;
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 2px;
    &:hover {
      background: #909399;
    }
  }
}

.config-panel > * + * {
  margin-top: 12px;
}

.config-card {
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.config-card + .config-card {
  margin-top: 8px;
}

.config-card--disabled {
  opacity: 0.72;
}

.config-card-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  font-weight: 600;
  font-size: 13px;
  color: var(--sd-primary, #195fb4);
}

.config-card-header > * + * {
  margin-left: 6px;
}

.config-card-header .el-icon {
  font-size: 14px;
  color: var(--sd-primary, #195fb4);
}

.config-card-body {
  padding: 12px;
  background: var(--sd-canvas, #ffffff);
}

.config-row {
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.field-block > * + * {
  margin-top: 8px;
}

.field-label-text {
  display: block;
  font-size: 13px;
  color: #606266;
  font-weight: 600;
  line-height: 1.4;
}

.config-item {
  width: 100%;
}

.config-item :deep(.el-textarea__inner) {
  min-height: 50px;
  max-height: 120px;
  resize: vertical;
  line-height: 1.4;
  word-break: break-word;
  white-space: pre-wrap;
  padding: 6px 8px;
  font-size: 12px;
  overflow-y: auto;
}

/* 提示词预览容器 */
.prompt-preview-wrapper {
  position: relative;
}

/* 只读模式下的提示词预览样式 */
.prompt-preview {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px 8px 32px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
  white-space: pre-wrap;
  word-break: break-word;
  height: calc(12px * 1.5 * 6 + 16px + 24px);
  overflow-y: scroll;
  resize: none;
  cursor: default;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f0f2f5;
    border-radius: 2px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 2px;
    &:hover {
      background: #909399;
    }
  }
}

/* 查看按钮定位在右下角 */
.prompt-view-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 1;
}

/* 只读模式下的值显示样式 */
.readonly-value {
  font-size: 12px;
  color: #303133;
  word-break: break-word;
  list-style: none;
}

.readonly-value::before {
  display: none;
}

.config-item-flex {
  display: flex;
  flex-direction: column;
}

.config-control {
  display: flex;
  align-items: center;
}

.config-control > * + * {
  margin-left: 12px;
}

.config-control .el-slider {
  flex: 1;
}

.config-display {
  min-width: 40px;
  text-align: center;
  color: var(--sd-primary, #195fb4);
  font-weight: 700;
  font-size: 12px;
  padding: 0 4px;
  flex-shrink: 0;
}

.range-input {
  display: flex;
  align-items: center;
}

.range-input > * + * {
  margin-left: 6px;
}

.range-input .el-input {
  flex: 1;
}

.range-input span {
  color: #909399;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
  padding: 0 2px;
}

.keyword-group {
  display: flex;
  align-items: center;
}

.keyword-group > * + * {
  margin-left: 8px;
}

.keyword-group .el-input {
  flex: 1;
}

.keyword-group .el-checkbox {
  flex-shrink: 0;
  white-space: nowrap;
}

.config-actions {
  padding: 12px;
  background: var(--sd-canvas, #ffffff);
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
  overflow: hidden;
}

.config-actions__row {
  display: flex;
  align-items: center;
  width: 100%;
}

.config-actions__row > * + * {
  margin-left: 8px;
}

.config-actions__row + .config-actions__row {
  margin-top: 8px;
}

.config-actions__row .action-btn {
  flex: 1;
  min-width: 0;
}

.config-actions__row--triple .import-upload {
  flex: 1;
  min-width: 0;
  display: block;
}

.config-actions__row--triple .import-upload :deep(.el-upload) {
  width: 100%;
  display: block;
}

.config-actions__row--triple .import-upload :deep(.el-button) {
  width: 100%;
}

/* 树形选择器节点样式 */
:deep(.tree-node-folder) {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
}

:deep(.tree-node-prompt) {
  color: #67c23a;
  font-size: 12px;
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

/* 提示词查看对话框样式 */
.prompt-dialog-content {
  max-height: 60vh;
  overflow-y: auto;
}

.prompt-text {
  margin: 0;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}
</style>
