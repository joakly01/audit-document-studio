<template>
  <div class="config-container">
    <div class="rule-config">
      <div class="rule-header" style="border: none">
        <span class="rule-title">分析参数配置</span>
      </div>
      <div v-loading="promptTreeLoading" class="rule-config-body">
        <el-form label-position="top" size="small">
          <div class="config-block">
            <div class="config-block__title">重复项目检测</div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">提示词模板</span>
              </div>
              <el-tree-select
                :model-value="normalizedPrompt.engineering_repeat_project.key"
                @update:model-value="updateEngineeringRepeatProjectKey"
                :data="engineeringRepeatProjectList"
                placeholder="请选择提示词模板"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
                :disabled="isSecondaryExecution"
                class="field-input-full"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">{{ data.name }}</span>
                </template>
              </el-tree-select>
              <div
                v-if="!isSecondaryExecution && normalizedPrompt.engineering_repeat_project.key"
                class="config-status-hint config-status-hint--ok"
              >
                已选择重复项目模板
              </div>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">判定阈值</span>
              </div>
              <span v-if="isSecondaryExecution" class="config-readonly-value">
                {{ normalizedPrompt.duplicate_detection.threshold }}
              </span>
              <el-input-number
                v-else
                :model-value="normalizedPrompt.duplicate_detection.threshold"
                @update:model-value="updateDuplicateThreshold"
                :min="0"
                :max="5"
                :step="0.05"
                :precision="2"
                controls-position="right"
                style="width: 160px"
              />
            </div>
            <SingleTableFieldMappingEditor
              :config="dupSingleTableConfig"
              mode="duplicate"
              :readonly="isSecondaryExecution"
              @update:config="updateDuplicateSingleTableConfig"
            />
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">补充提示词</span>
              </div>
              <el-input
                :model-value="normalizedPrompt.duplicate_detection.prompt"
                @update:model-value="updateDuplicateAppendPrompt"
                type="textarea"
                :rows="4"
                :autosize="{ minRows: 3, maxRows: 10 }"
                :disabled="isSecondaryExecution"
                placeholder="可选。将追加到服务端根据权重与评分规则动态生成的提示词之后"
                class="preserve-whitespace field-input-full"
              />
            </div>
          </div>

          <div class="config-block config-block--spaced">
            <div class="config-block__title">主子项目分析</div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">提示词模板</span>
              </div>
              <el-tree-select
                :model-value="normalizedPrompt.engineering_sub_project.key"
                @update:model-value="updateEngineeringSubProjectKey"
                :data="engineeringSubProjectList"
                placeholder="请选择提示词模板"
                :props="treeProps"
                :render-after-expand="false"
                check-strictly
                :check-on-click-node="true"
                :disabled="isSecondaryExecution"
                class="field-input-full"
              >
                <template #default="{ data }">
                  <span :class="getNodeClass(data)">{{ data.name }}</span>
                </template>
              </el-tree-select>
              <div
                v-if="!isSecondaryExecution && normalizedPrompt.engineering_sub_project.key"
                class="config-status-hint config-status-hint--ok"
              >
                已选择主子项目模板
              </div>
              <div
                v-if="!isSecondaryExecution && configReady"
                class="config-status-hint config-status-hint--ok"
              >
                提示词配置已就绪（适用于全部文件与文件夹）
              </div>
              <div
                v-else-if="!isSecondaryExecution && !configReady && !normalizedPrompt.engineering_sub_project.key"
                class="config-status-hint config-status-hint--hint"
              >
                请选择主子项目提示词；两项均配置完成后左侧「批量执行」将处理全部文件与文件夹
              </div>
              <div v-if="isSecondaryExecution" class="config-status-hint config-status-hint--readonly">
                以下为任务执行时的提示词与字段配置（只读）
              </div>
            </div>
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">判定阈值</span>
              </div>
              <span v-if="isSecondaryExecution" class="config-readonly-value">
                {{ normalizedPrompt.parent_child_analysis.threshold }}
              </span>
              <el-input-number
                v-else
                :model-value="normalizedPrompt.parent_child_analysis.threshold"
                @update:model-value="updateParentChildThreshold"
                :min="0"
                :max="5"
                :step="0.05"
                :precision="2"
                controls-position="right"
                style="width: 160px"
              />
            </div>
            <SingleTableFieldMappingEditor
              :config="pcSingleTableConfig"
              mode="parent_child"
              :readonly="isSecondaryExecution"
              @update:config="updateParentChildSingleTableConfig"
            />
            <div class="field-block">
              <div class="field-label-col field-label-col--block">
                <span class="field-label-text">补充提示词</span>
              </div>
              <el-input
                :model-value="normalizedPrompt.parent_child_analysis.prompt"
                @update:model-value="updateParentChildAppendPrompt"
                type="textarea"
                :rows="4"
                :autosize="{ minRows: 3, maxRows: 10 }"
                :disabled="isSecondaryExecution"
                placeholder="可选。将追加到服务端根据权重与评分规则动态生成的提示词之后"
                class="preserve-whitespace field-input-full"
              />
            </div>
          </div>
        </el-form>
      </div>
    </div>

    <div class="config-actions-bottom" v-if="!noExecute && !isSecondaryExecution">
      <el-button type="primary" @click="handleExecute" :loading="loading">执行</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import SingleTableFieldMappingEditor from './SingleTableFieldMappingEditor.vue'
import {
  prepareSingleTableConfig,
  ensureSingleTableShape,
  sumFieldWeights as sumSingleTableWeights
} from './engineeringSingleTableConfigHelpers.js'
import {
  createEmptyDuplicateDetectionConfig,
  createEmptyParentChildAnalysisConfig,
  DEFAULT_DUPLICATE_THRESHOLD,
  DEFAULT_PARENT_CHILD_THRESHOLD,
  sumFieldWeights,
  mergeFieldRulesWithWeights
} from './engineeringProjectConstants.js'
import {
  buildDetectionFromPromptNode,
  findPromptInTree,
  migrateRulesOnWeightChange,
  resolveInitialPromptNode
} from './engineeringPromptConfig.js'

const props = defineProps({
  prompt: {
    type: Object,
    default: () => ({
      engineering_repeat_project: { key: '', prompt: '' },
      engineering_sub_project: { key: '', prompt: '' },
      duplicate_detection: createEmptyDuplicateDetectionConfig(),
      parent_child_analysis: createEmptyParentChildAnalysisConfig()
    })
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
  /** 重复项目与主子项目提示词是否均已选择 */
  configReady: {
    type: Boolean,
    default: false
  }
})

const engineeringRepeatProjectList = ref([])
const engineeringSubProjectList = ref([])
const repeatDefaultPrompt = ref(null)
const subDefaultPrompt = ref(null)
const duplicateTemplateDefaults = ref(null)
const parentChildTemplateDefaults = ref(null)
const promptTreeLoading = ref(false)

const treeProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => !data.isPrompt
}

/**
 * 根据树节点类型返回展示样式类名
 * @param {Object} data 树节点数据
 * @returns {string} CSS 类名
 */
const getNodeClass = (data) => {
  if (data.isPrompt) return 'tree-node-prompt'
  if (data.children && data.children.length > 0) return 'tree-node-folder'
  return 'tree-node-disabled'
}

const emit = defineEmits(['execute', 'update:prompt'])

const dupSingleTableConfig = computed(() =>
  ensureSingleTableShape(props.prompt?.duplicate_detection, 'duplicate')
)
const pcSingleTableConfig = computed(() =>
  ensureSingleTableShape(props.prompt?.parent_child_analysis, 'parent_child')
)

const updateDuplicateSingleTableConfig = (cfg) => {
  const th = cfg.threshold ?? cfg.llm_config?.threshold
  patchPrompt({
    duplicate_detection: {
      ...cfg,
      threshold: th,
      llm_config: {
        ...(cfg.llm_config || {}),
        ...(th != null && th !== '' ? { threshold: Number(th) } : {})
      },
      prompt: cfg.llm_config?.additional_prompt || ''
    }
  })
}

const updateParentChildSingleTableConfig = (cfg) => {
  const th = cfg.threshold ?? cfg.llm_config?.threshold
  patchPrompt({
    parent_child_analysis: {
      ...cfg,
      threshold: th,
      llm_config: {
        ...(cfg.llm_config || {}),
        ...(th != null && th !== '' ? { threshold: Number(th) } : {})
      },
      prompt: cfg.llm_config?.additional_prompt || '',
      strict_negative_prompt: cfg.llm_config?.strict_negative_prompt || ''
    }
  })
}

/**
 * 归一化 prompt，避免父组件 v-model 缺少 duplicate_detection / parent_child_analysis
 * @returns {Object} 完整配置对象
 */
const normalizedPrompt = computed(() => {
  const duplicateBase = {
    ...createEmptyDuplicateDetectionConfig(),
    ...(props.prompt?.duplicate_detection || {})
  }
  const parentChildBase = {
    ...createEmptyParentChildAnalysisConfig(),
    ...(props.prompt?.parent_child_analysis || {})
  }
  return {
    engineering_repeat_project: {
      key: '',
      prompt: '',
      ...(props.prompt?.engineering_repeat_project || {})
    },
    engineering_sub_project: {
      key: '',
      prompt: '',
      ...(props.prompt?.engineering_sub_project || {})
    },
    duplicate_detection: {
      ...duplicateBase,
      field_rules: mergeFieldRulesWithWeights(
        duplicateBase.field_weights,
        duplicateBase.field_rules
      )
    },
    parent_child_analysis: {
      ...parentChildBase,
      field_rules: mergeFieldRulesWithWeights(
        parentChildBase.field_weights,
        parentChildBase.field_rules
      )
    }
  }
})

/**
 * 合并并提交 prompt 局部更新
 * @param {Object} partial 局部配置
 * @returns {void}
 */
const patchPrompt = (partial) => {
  emit('update:prompt', { ...normalizedPrompt.value, ...partial })
}

/**
 * 缓存模板默认值快照
 * @param {string} module 模块标识 duplicate | parent_child
 * @param {Object} detection 检测配置
 * @returns {Object} 快照
 */
const storeTemplateDefaults = (module, detection) => {
  const snapshot = {
    threshold: detection.threshold,
    field_weights: { ...detection.field_weights },
    field_rules: { ...detection.field_rules },
    prompt: detection.prompt || ''
  }
  if (module === 'duplicate') duplicateTemplateDefaults.value = snapshot
  else parentChildTemplateDefaults.value = snapshot
  return snapshot
}

/**
 * 从提示词节点构建检测配置
 * @param {string} module 模块标识
 * @param {Object} node 提示词节点
 * @param {Object} defaultPrompt 默认提示词
 * @param {Object} options 选项
 * @returns {Object} 局部 prompt 更新
 */
const applyPromptTemplate = (module, node, defaultPrompt, { force = false, silent = false } = {}) => {
  const detection = buildDetectionFromPromptNode(node, defaultPrompt, module)
  storeTemplateDefaults(module, detection)

  if (module === 'duplicate') {
    return {
      engineering_repeat_project: {
        key: node?.id ?? '',
        prompt: detection.prompt
      },
      duplicate_detection: {
        ...detection,
        prompt: detection.prompt
      }
    }
  }

  return {
    engineering_sub_project: {
      key: node?.id ?? '',
      prompt: detection.prompt
    },
    parent_child_analysis: {
      ...detection,
      prompt: detection.prompt
    }
  }
}

/**
 * 提交提示词模板变更
 * @param {string} module 模块标识
 * @param {Object} node 提示词节点
 * @param {Object} defaultPrompt 默认提示词
 * @param {Object} options 选项
 * @returns {void}
 */
const commitPromptTemplate = (module, node, defaultPrompt, options = {}) => {
  const partial = applyPromptTemplate(module, node, defaultPrompt, options)
  patchPrompt(partial)
  if (options.force) ElMessage.success('已加载提示词模板配置')
}

/**
 * 确认后切换提示词模板
 * @param {string} module 模块标识
 * @param {Object} node 提示词节点
 * @param {Object} defaultPrompt 默认提示词
 * @param {string} previousKey 切换前的 key
 * @returns {Promise<void>}
 */
const confirmAndApplyTemplate = async (module, node, defaultPrompt, previousKey) => {
  if (!node) return
  try {
    await ElMessageBox.confirm(
      '切换模板将覆盖当前字段、权重、规则与补充提示词，是否继续？',
      '切换提示词模板',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    )
    commitPromptTemplate(module, node, defaultPrompt, { force: true })
  } catch {
    if (module === 'duplicate') {
      patchPrompt({
        engineering_repeat_project: {
          ...props.prompt.engineering_repeat_project,
          key: previousKey
        }
      })
    } else {
      patchPrompt({
        engineering_sub_project: {
          ...props.prompt.engineering_sub_project,
          key: previousKey
        }
      })
    }
  }
}

/**
 * 从提示词树引导模块初始配置
 * @param {string} module 模块标识
 * @param {Array} tree 提示词树
 * @param {Object} defaultPrompt 默认提示词
 * @param {string} existingKey 已有 key
 * @returns {Object|null} 局部更新
 */
const bootstrapModuleFromTree = (module, tree, defaultPrompt, existingKey) => {
  const key = existingKey != null && existingKey !== '' ? existingKey : null
  const node = key
    ? findPromptInTree(tree, key) || resolveInitialPromptNode(tree, defaultPrompt)
    : resolveInitialPromptNode(tree, defaultPrompt)

  if (!node) return null
  return applyPromptTemplate(module, node, defaultPrompt)
}

/**
 * 加载重复项目与主子项目提示词树
 * @returns {Promise<void>}
 */
const getPromptTree = async () => {
  promptTreeLoading.value = true
  try {
    const [repeatRes, subRes] = await Promise.all([
      getPromptTreeByFunctionTypeNewAPI('Engineering_Repeat_Detection'),
      getPromptTreeByFunctionTypeNewAPI('Engineering_Sub_Project_Detection')
    ])

    const repeatData = repeatRes?.data
    const subData = subRes?.data

    engineeringRepeatProjectList.value = Array.isArray(repeatData?.items) ? repeatData.items : []
    engineeringSubProjectList.value = Array.isArray(subData?.items) ? subData.items : []
    repeatDefaultPrompt.value = repeatData?.defaultPrompt ?? null
    subDefaultPrompt.value = subData?.defaultPrompt ?? null

    await nextTick()

    if (!props.isSecondaryExecution) {
      const duplicatePartial = bootstrapModuleFromTree(
        'duplicate',
        engineeringRepeatProjectList.value,
        repeatDefaultPrompt.value,
        props.prompt.engineering_repeat_project?.key
      )
      const parentChildPartial = bootstrapModuleFromTree(
        'parent_child',
        engineeringSubProjectList.value,
        subDefaultPrompt.value,
        props.prompt.engineering_sub_project?.key
      )

      if (duplicatePartial || parentChildPartial) {
        patchPrompt({
          ...(duplicatePartial || {}),
          ...(parentChildPartial || {})
        })
      }
    }
  } catch (e) {
    console.error(e)
    engineeringRepeatProjectList.value = []
    engineeringSubProjectList.value = []
    ElMessage.error('加载提示词失败')
  } finally {
    promptTreeLoading.value = false
  }
}

onMounted(() => {
  getPromptTree()
})

/**
 * 更新重复项目提示词 key
 * @param {string} value 提示词 id
 * @returns {void}
 */
const updateEngineeringRepeatProjectKey = (value) => {
  if (value == null || value === '') {
    patchPrompt({
      engineering_repeat_project: { key: '', prompt: '' },
      duplicate_detection: {
        ...createEmptyDuplicateDetectionConfig(),
        prompt: ''
      }
    })
    duplicateTemplateDefaults.value = null
    return
  }
  const node = findPromptInTree(engineeringRepeatProjectList.value, value)
  const previousKey = props.prompt.engineering_repeat_project?.key
  confirmAndApplyTemplate('duplicate', node, repeatDefaultPrompt.value, previousKey)
}

/**
 * 更新主子项目提示词 key
 * @param {string} value 提示词 id
 * @returns {void}
 */
const updateEngineeringSubProjectKey = (value) => {
  if (value == null || value === '') {
    patchPrompt({
      engineering_sub_project: { key: '', prompt: '' },
      parent_child_analysis: {
        ...createEmptyParentChildAnalysisConfig(),
        prompt: ''
      }
    })
    parentChildTemplateDefaults.value = null
    return
  }
  const node = findPromptInTree(engineeringSubProjectList.value, value)
  const previousKey = props.prompt.engineering_sub_project?.key
  confirmAndApplyTemplate('parent_child', node, subDefaultPrompt.value, previousKey)
}

/**
 * 更新重复项目补充提示词
 * @param {string} value 提示词文本
 * @returns {void}
 */
const updateDuplicateAppendPrompt = (value) => {
  patchPrompt({
    engineering_repeat_project: {
      ...props.prompt.engineering_repeat_project,
      prompt: value
    },
    duplicate_detection: {
      ...props.prompt.duplicate_detection,
      prompt: value
    }
  })
}

/**
 * 更新主子项目补充提示词
 * @param {string} value 提示词文本
 * @returns {void}
 */
const updateParentChildAppendPrompt = (value) => {
  patchPrompt({
    engineering_sub_project: {
      ...props.prompt.engineering_sub_project,
      prompt: value
    },
    parent_child_analysis: {
      ...props.prompt.parent_child_analysis,
      prompt: value
    }
  })
}

/**
 * 更新重复项目判定阈值
 * @param {number} value 阈值
 * @returns {void}
 */
const updateDuplicateThreshold = (value) => {
  const th = value ?? DEFAULT_DUPLICATE_THRESHOLD
  const prev = props.prompt.duplicate_detection || {}
  patchPrompt({
    duplicate_detection: {
      ...prev,
      threshold: th,
      // 分析侧读 llm_config.threshold，须与顶层判定阈值同步
      llm_config: {
        ...(prev.llm_config || {}),
        threshold: th
      }
    }
  })
}

/**
 * 更新主子项目分析阈值
 * @param {number} value 阈值
 * @returns {void}
 */
const updateParentChildThreshold = (value) => {
  const th = value ?? DEFAULT_PARENT_CHILD_THRESHOLD
  const prev = props.prompt.parent_child_analysis || {}
  patchPrompt({
    parent_child_analysis: {
      ...prev,
      threshold: th,
      llm_config: {
        ...(prev.llm_config || {}),
        threshold: th
      }
    }
  })
}

/**
 * 根据提示词 id 取树节点展示名称（供批量执行弹窗摘要）
 * @param {string} key 提示词 id
 * @returns {string} 名称
 */
const getPromptNameByKey = (key) => {
  if (!key) return ''
  const node =
    findPromptInTree(engineeringRepeatProjectList.value, key) ||
    findPromptInTree(engineeringSubProjectList.value, key)
  return node ? String(node.name || node.title || '') : ''
}

/**
 * 更新重复项目字段权重
 * @param {Object} weights 权重对象
 * @returns {void}
 */
const updateDuplicateFieldWeights = (weights) => {
  const prev = props.prompt.duplicate_detection?.field_weights || {}
  patchPrompt({
    duplicate_detection: {
      ...props.prompt.duplicate_detection,
      field_weights: weights,
      field_rules: migrateRulesOnWeightChange(prev, weights, props.prompt.duplicate_detection?.field_rules)
    }
  })
}

/**
 * 更新主子项目字段权重
 * @param {Object} weights 权重对象
 * @returns {void}
 */
const updateParentChildFieldWeights = (weights) => {
  const prev = props.prompt.parent_child_analysis?.field_weights || {}
  patchPrompt({
    parent_child_analysis: {
      ...props.prompt.parent_child_analysis,
      field_weights: weights,
      field_rules: migrateRulesOnWeightChange(prev, weights, props.prompt.parent_child_analysis?.field_rules)
    }
  })
}

/**
 * 更新重复项目字段评分规则
 * @param {Object} rules 规则对象
 * @returns {void}
 */
const updateDuplicateFieldRules = (rules) => {
  patchPrompt({
    duplicate_detection: {
      ...props.prompt.duplicate_detection,
      field_rules: rules
    }
  })
}

/**
 * 更新主子项目字段评分规则
 * @param {Object} rules 规则对象
 * @returns {void}
 */
const updateParentChildFieldRules = (rules) => {
  patchPrompt({
    parent_child_analysis: {
      ...props.prompt.parent_child_analysis,
      field_rules: rules
    }
  })
}

const updateDuplicateRoleFields = (roleFields) => {
  patchPrompt({
    duplicate_detection: {
      ...props.prompt.duplicate_detection,
      role_fields: roleFields
    }
  })
}

const updateParentChildRoleFields = (roleFields) => {
  patchPrompt({
    parent_child_analysis: {
      ...props.prompt.parent_child_analysis,
      role_fields: roleFields
    }
  })
}

/**
 * 校验配置是否完整
 * @returns {boolean} 是否通过
 */
const validateRules = () => {
  if (!props.prompt.engineering_repeat_project?.key) {
    ElMessage.warning('请选择重复项目提示词模板')
    return false
  }
  if (!props.prompt.engineering_sub_project?.key) {
    ElMessage.warning('请选择主子项目提示词模板')
    return false
  }
  const ddCfg = ensureSingleTableShape(props.prompt.duplicate_detection, 'duplicate')
  const pcCfg = ensureSingleTableShape(props.prompt.parent_child_analysis, 'parent_child')
  const ddWeights = ddCfg.llm_config?.field_weights
  const pcWeights = pcCfg.llm_config?.field_weights
  const ddKeys = Object.keys(ddCfg.field_mapping || {})
  const pcKeys = Object.keys(pcCfg.field_mapping || {})
  if (!ddKeys.length) {
    ElMessage.warning('重复项目至少需要一个字段映射')
    return false
  }
  if (!pcKeys.length) {
    ElMessage.warning('主子项目至少需要一个字段映射')
    return false
  }
  const ddSum = sumSingleTableWeights(ddWeights)
  const pcSum = sumSingleTableWeights(pcWeights)
  if (Math.abs(ddSum - 1) > 0.02) {
    ElMessage.warning(`重复项目字段权重之和应为 1，当前为 ${ddSum.toFixed(2)}`)
    return false
  }
  if (Math.abs(pcSum - 1) > 0.02) {
    ElMessage.warning(`主子项目字段权重之和应为 1，当前为 ${pcSum.toFixed(2)}`)
    return false
  }

  try {
    prepareSingleTableConfig(props.prompt.duplicate_detection || {}, { mode: 'duplicate' })
    prepareSingleTableConfig(props.prompt.parent_child_analysis || {}, { mode: 'parent_child' })
  } catch (e) {
    ElMessage.warning(e?.message || '配置校验失败')
    return false
  }

  return true
}

/**
 * 触发执行
 * @returns {void}
 */
const handleExecute = () => {
  if (!validateRules()) return
  emit('execute')
}

defineExpose({
  getPromptNameByKey,
  validateRules
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

.config-actions-bottom {
  padding: 12px 16px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-shrink: 0;
  margin-top: auto;
}

.rule-config {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.rule-config-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
  min-height: 0;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px 8px;
  background: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.field-block {
  margin-bottom: 16px;
}

.field-block:last-child {
  margin-bottom: 0;
}

.field-block > * + * {
  margin-top: 8px;
}

.field-label-col--block {
  display: flex;
  align-items: center;
  width: auto;
}

.field-label-text {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  line-height: 1.4;
}

.field-input-full {
  width: 100%;
}

.config-status-hint {
  font-size: 12px;
  line-height: 1.5;
}

.config-status-hint--ok {
  color: #67c23a;
}

.config-status-hint--hint {
  color: #e6a23c;
}

.config-status-hint--readonly {
  color: #909399;
  margin-bottom: 12px;
}

.config-block {
  padding: 12px;
  margin-bottom: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.config-block--spaced {
  margin-top: 0;
  padding-top: 12px;
  border-top: none;
}

.config-readonly-value {
  display: inline-block;
  min-width: 80px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  line-height: 1.4;
}

.config-block__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
}

:deep(.tree-node-folder) {
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
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

.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
}
</style>
