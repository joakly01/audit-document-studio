<template>
  <div
    class="prepaid-expenses-prototype"
    :class="{ 'prepaid-expenses-prototype--embedded': isResultViewMode }"
    v-loading="resultViewLoading"
    element-loading-text="加载任务详情..."
  >
    <!-- 左侧：公共侧边栏 -->
    <div
      class="left-sidebar-shell resizable-left-sidebar"
      :style="{ width: leftSidebarWidth + 'px' }"
    >
      <PrepaidExpensesLeftSidebar
        :bindings="leftSidebarBindings"
        :readonly="isResultViewMode"
        :on-folder-expand="isResultViewMode ? null : handleFolderExpandInTree"
        :empty-description="isResultViewMode ? '暂无任务文件' : '暂无文件，请点击「选择文件」添加'"
      >
        <template v-if="showLeftExecuteButton" #footer>
          <el-button
            type="primary"
            class="ocr-footer-btn"
            :disabled="executeButtonDisabled"
            :loading="analyzing"
            @click="handleExecute"
          >
            {{ executeButtonLabel }}
          </el-button>
        </template>
      </PrepaidExpensesLeftSidebar>
    </div>

    <div
      class="resizer resizer-left"
      title="拖拽调整宽度"
      @mousedown="startLeftSidebarResize"
    >
      <el-icon class="resize-icon"><DArrowRight /></el-icon>
    </div>

    <!-- 中间：文件预览 / 计费约定 -->
    <div v-show="showFilePreview" class="center-viewer">
      <div
        v-if="centerViewMode === 'billing'"
        class="viewer-header ocr-column-head"
      >
        <div class="page-controls page-controls--placeholder" />
        <div class="header-actions-slot">
          <el-button
            type="default"
            size="small"
            @click="centerViewMode = 'preview'"
          >
            文件预览
          </el-button>
          <el-button
            type="primary"
            size="small"
            @click="centerViewMode = 'billing'"
          >
            计费约定
          </el-button>
          <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
        </div>
      </div>

      <div
        class="center-body"
        :class="{ 'center-body--fill': centerViewMode === 'preview' }"
      >
        <template v-if="centerViewMode === 'preview'">
          <PreviewFile
            ref="previewFileRef"
            :current-file="currentPreviewFile"
            :current-highlighted-field="null"
            @refresh="handlePreviewRefresh"
            @download="handlePreviewDownload"
          >
            <template #headerActions>
              <el-button
                :type="centerViewMode === 'preview' ? 'primary' : 'default'"
                size="small"
                @click="centerViewMode = 'preview'"
              >
                文件预览
              </el-button>
              <el-button
                :type="centerViewMode === 'billing' ? 'primary' : 'default'"
                size="small"
                class="center-view-mode-btn"
                @click="centerViewMode = 'billing'"
              >
                计费约定
              </el-button>
              <el-button type="primary" :icon="List" size="small" @click="handleGoToTaskCenter">任务中心</el-button>
            </template>
          </PreviewFile>
        </template>

        <template v-else>
          <div class="billing-agreement-panel">
            <el-alert
              v-if="taskResultLoadError"
              type="error"
              :closable="false"
              show-icon
              class="prepaid-task-alert"
              :title="taskResultLoadError"
            />
            <div class="billing-agreement-head">
              <span>计费约定</span>
              <el-tag v-if="agentOutput" size="small" type="success" effect="plain">已提取</el-tag>
              <el-tag v-else-if="extractOutputLoading" size="small" type="warning" effect="plain">提取中</el-tag>
              <el-tag v-else size="small" type="info" effect="plain">待执行</el-tag>
            </div>

            <div class="billing-agreement-section">
              <div class="billing-agreement-label">智能体输出</div>
              <div
                v-loading="extractOutputLoading"
                element-loading-text="正在提取计费约定..."
                class="agent-output-box"
              >
                <pre v-if="agentOutput" class="agent-output-content">{{ agentOutput }}</pre>
                <el-empty
                  v-else
                  description="请在右侧选择费用类型并点击「执行」，第一个智能体提取的计费约定将展示于此"
                  :image-size="72"
                />
              </div>
            </div>

            <div class="billing-agreement-section">
              <div class="billing-agreement-label">请输入计费基数：</div>
              <el-input
                v-model="billingBase"
                placeholder="请输入计费基数"
                clearable
                :disabled="billingBaseReadonly"
              >
                <template #append>元</template>
              </el-input>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div
      v-show="showFilePreview"
      class="resizer"
      title="拖拽调整宽度"
      @mousedown="startRightSidebarResize"
    >
      <el-icon class="resize-icon"><DArrowLeft /></el-icon>
    </div>

    <!-- 右侧：功能配置 / 最终结果报告 -->
    <div
      class="right-viewer"
      :class="{ 'right-viewer-fullwidth': !showFilePreview }"
      :style="{ width: showFilePreview ? rightSidebarWidth + 'px' : '' }"
    >
      <div class="sidebar-tabs ocr-column-head">
        <el-tabs v-model="viewerTab">
          <el-tab-pane label="功能配置" name="config" />
          <el-tab-pane label="最终结果报告" name="report" />
        </el-tabs>
      </div>

      <div
        v-if="viewerTab === 'config'"
        class="field-mode-header ocr-column-head field-mode-header--stacked"
      >
        <div class="field-block field-block--compact">
          <div class="field-label-col field-label-col--block">
            <span class="field-label-text">选择费用类型</span>
          </div>
          <el-select
            v-model="expenseType"
            placeholder="请选择费用类型"
            class="field-input-full"
            :disabled="configReadonly"
          >
            <el-option
              v-for="item in expenseTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
      </div>

      <div v-show="viewerTab === 'config'" class="right-sidebar">
        <div class="config-panel-wrap">
          <el-alert
            v-if="taskResultLoadError"
            type="error"
            :closable="false"
            show-icon
            class="prepaid-task-alert"
            :title="taskResultLoadError"
          />
          <div class="config-form">
            <div class="rule-config">
              <div class="rule-header rule-header--section">
                <span class="rule-title">选择提示词</span>
              </div>
              <div v-loading="promptTreeLoading" class="prompt-config">
                <div class="prompt-group">
                  <div class="field-block">
                    <div class="field-label-col field-label-col--block">
                      <span class="field-label-text">提取计费约定</span>
                    </div>
                    <div
                      v-if="!promptTreeLoading && billingAgreementPromptApiTotal === 0"
                      class="prompt-tree-empty-hint"
                    >
                      当前无可用提示词。请在「提示词管理」中为「监理费」等条目设置所属功能值为
                      <code>billing_agreement_prompt</code>，并确保状态为启用。
                    </div>
                  </div>

                  <div class="field-block">
                    <div class="field-label-col field-label-col--block">
                      <span class="field-label-text">提示词内容</span>
                    </div>
                    <el-input
                      v-model="billingAgreementPromptContent"
                      type="textarea"
                      :rows="5"
                      :autosize="{ minRows: 5, maxRows: 12 }"
                      placeholder="请输入或修改提示词内容"
                      class="preserve-whitespace field-input-full"
                      :disabled="configReadonly"
                      @input="billingPromptTouched = true"
                    />
                  </div>
                </div>

                <div class="prompt-group prompt-group--divider">
                  <div class="field-block">
                    <div class="field-label-col field-label-col--block">
                      <span class="field-label-text">费用计算</span>
                    </div>
                    <div
                      v-if="!promptTreeLoading && costCalculationPromptApiTotal === 0"
                      class="prompt-tree-empty-hint"
                    >
                      当前无可用提示词。请在「提示词管理」中为条目设置所属功能值为
                      <code>cost_calculation_prompt</code>，并确保状态为启用。
                    </div>
                  </div>

                  <div class="field-block">
                    <div class="field-label-col field-label-col--block">
                      <span class="field-label-text">提示词内容</span>
                    </div>
                    <el-input
                      v-model="costCalculationPromptContent"
                      type="textarea"
                      :rows="5"
                      :autosize="{ minRows: 5, maxRows: 12 }"
                      placeholder="请输入或修改提示词内容"
                      class="preserve-whitespace field-input-full"
                      :disabled="configReadonly"
                      @input="costPromptTouched = true"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="config-hint">
              选择费用类型与提示词后点击「执行」，智能体提取的计费约定将展示在「计费约定」页；请在「计费约定」页填写计费基数（元）后再次点击「执行」生成报告。
            </div>

            <el-button
              v-if="showRightExecuteButton"
              type="primary"
              class="config-run-btn"
              :disabled="executeButtonDisabled"
              :loading="analyzing"
              @click="handleExecute"
            >
              {{ executeButtonLabel }}
            </el-button>
          </div>
        </div>
      </div>

      <div v-show="viewerTab === 'report'" class="right-sidebar">
        <div
          v-loading="calculateOutputLoading"
          element-loading-text="正在计算费用..."
          class="report-panel"
        >
          <el-alert
            v-if="taskResultLoadError"
            type="error"
            :closable="false"
            show-icon
            class="prepaid-task-alert"
            :title="taskResultLoadError"
          />
          <el-empty
            v-if="taskResultLoadError && !analysisDone"
            :description="taskResultLoadError"
            :image-size="80"
          />
          <el-empty
            v-else-if="!analysisDone"
            description="暂无报告，请先完成分析"
            :image-size="80"
          />
          <template v-else>
            <div v-if="calculateAgentOutput" class="report-agent-output-section">
              <div class="agent-output-box report-agent-output-box">
                <div
                  class="report-agent-output-md"
                  v-html="calculateAgentOutputHtml"
                />
              </div>
            </div>
            <el-empty
              v-else
              description="暂无费用计算结果"
              :image-size="80"
            />
          </template>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="taskMetaDialogVisible"
      title="任务信息"
      width="480px"
      align-center
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      @closed="onTaskMetaDialogClosed"
    >
      <el-form label-width="88px" label-position="right" size="default">
        <el-form-item label="任务名称" required>
          <el-input
            v-model="taskMetaForm.taskName"
            placeholder="请输入任务名称"
            maxlength="120"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item label="任务备注">
          <el-input
            v-model="taskMetaForm.taskNotes"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="选填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskMetaDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="taskMetaSubmitting"
          :disabled="taskMetaSubmitting"
          @click="confirmTaskMetaAndRun"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import {
  DArrowRight,
  DArrowLeft,
  List
} from '@element-plus/icons-vue'
import { getFileListAPI, previewFileAPI } from '@/api/fileManager.js'
import {
  batchExecuteByFilterAPI,
  getTaskSchedulesAPI,
  prepaidExpensesContinueAPI
} from '@/api/task.js'
import { eventBus } from '@/utils/eventBus.js'
import { useHomeStore } from '@/stores/home'
import PrepaidExpensesLeftSidebar from '@/views/document-mining/components/PrepaidExpensesLeftSidebar.vue'
import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
import { useSimpleOcrLeftSidebar } from '@/views/file-manager-code/composables/useSimpleOcrLeftSidebar.js'
import { useTaskCenterPreviewSidebar } from '@/views/file-manager-code/composables/useTaskCenterPreviewSidebar.js'
import { buildToolBatchExecutePayload } from '@/views/file-manager-code/composables/buildToolBatchExecutePayload.js'
import {
  openTaskCenterWithRefresh,
  runBatchExecuteWithTimeoutNav
} from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'
import { emitFileManagerProgressStop } from '@/views/file-manager-code/utils/fileManagerTaskProgressEvents.js'
import {
  getFileIdentifier,
  buildFolderFileListQueryParams,
  normalizeFolderPathForTree
} from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import {
  parsePrepaidDisposal,
  hasPrepaidExtractText,
  hasPrepaidCalculateResults,
  resolveEffectivePrepaidPhase,
  extractCalculateResultText,
  collectPrepaidCalculateTexts,
} from '@/views/document-mining/prepaidTaskProgressUtils.js'

defineOptions({ name: 'PrepaidExpensesPrototype' })

const PREPAID_TASK_POLL_INTERVAL_MS = 2000
const PREPAID_FULL_FETCH_MAX_RETRIES = 3
let prepaidTaskPollTimer = null
let prepaidTaskPollToken = 0
let prepaidFullFetchRetryCount = 0

const PREPAID_EXPENSES_BIZ_TYPE = 'prepaidExpenses'
const PREPAID_EXPENSES_TASK_TYPE = 10
const PREPAID_EXPENSES_TOOL_UUID = 'prepaid-expenses'
/** 与提示词管理 function_type 一致（对标合同 compliance_analysis_prompt / information_extraction_prompt） */
const BILLING_AGREEMENT_PROMPT_FUNCTION_TYPE = 'billing_agreement_prompt'
const COST_CALCULATION_PROMPT_FUNCTION_TYPE = 'cost_calculation_prompt'
const PREPAID_EXPENSES_EXTENSIONS = ['.pdf', '.doc', '.docx', '.wps']
const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560

const props = defineProps({
  files: { type: String, default: '' },
  names: { type: String, default: '' },
  toolLabel: { type: String, default: '待摊费用' },
  taskId: { type: [String, Number], default: '' },
  isSecondaryExecution: { type: Boolean, default: false },
  eventKey: { type: String, default: '' }
})

const emit = defineEmits(['close-dialog'])
const route = useRoute()
const router = useRouter()
const homeStore = useHomeStore()

let batchExecuteAborted = false
let activeBatchExecuteAbortController = null
const isViewerActive = ref(true)

const resolvedTaskId = computed(() => {
  const fromProp = props.taskId != null && String(props.taskId).trim()
  if (fromProp) return String(props.taskId).trim()
  const q = route.query.taskId && String(route.query.taskId).trim()
  return q || ''
})

const isResultViewMode = computed(() => !!resolvedTaskId.value)
const resultViewLoading = ref(false)
const taskResultLoadError = ref('')
const awaitingTaskResults = ref(false)
const prepaidPhase = ref('')
const taskNameSnapshot = ref('')
const lastCreatedTaskUuid = ref('')
const cachedExtractOutput = ref('')
const continueInFlight = ref(false)
/** 阶段②已提交、等待服务端 prepaid_phase 追上 calculating/completed */
const phase2Submitted = ref(false)
const billingPromptTouched = ref(false)
const costPromptTouched = ref(false)

const taskMetaDialogVisible = ref(false)
const taskMetaSubmitting = ref(false)
const taskMetaForm = reactive({
  taskName: '',
  taskNotes: ''
})

const expenseTypeOptions = [
  { value: 'supervision_engineering', label: '工程监理费' },
  { value: 'design', label: '工程设计费' },
  { value: 'agency_management', label: '代建管理费' },
  { value: 'cost_consulting', label: '造价咨询服务费' },
  { value: 'survey_mapping', label: '勘察费、测绘费' },
  { value: 'bidding_agency', label: '招标代理费' }
]

/** 费用类型 value → 提示词管理叶子 name（需与提示词管理命名一致；同名唯一） */
const EXPENSE_TYPE_TO_PROMPT_NAME = {
  supervision_engineering: '监理费',
  design: '设计费',
  agency_management: '代建管理费',
  cost_consulting: '造价咨询服务费',
  survey_mapping: '勘察费、测绘费',
  bidding_agency: '招标代理费'
}

const billingAgreementPromptTree = ref([])
const costCalculationPromptTree = ref([])
const billingAgreementPromptApiTotal = ref(-1)
const costCalculationPromptApiTotal = ref(-1)
const billingAgreementPromptTreeVersion = ref(0)
const costCalculationPromptTreeVersion = ref(0)
const promptTreeLoading = ref(false)

const promptTreeSelectProps = {
  children: 'children',
  label: 'name',
  value: 'id',
  disabled: (data) => {
    if (data?.isPrompt) return false
    // 有子节点的目录需可点击展开；仅叶子非提示词项禁用
    if (Array.isArray(data?.children) && data.children.length > 0) return false
    return true
  }
}

const billingAgreementPromptId = ref(null)
const costCalculationPromptId = ref(null)
const lastBillingAgreementPromptId = ref(null)
const lastCostCalculationPromptId = ref(null)
const billingAgreementPromptContent = ref('')
const costCalculationPromptContent = ref('')

const centerViewMode = ref('preview')
const viewerTab = ref('config')
const expenseType = ref('')
const billingBase = ref('')
const analyzing = ref(false)
const analysisDone = ref(false)
const calculateAgentOutput = ref('')
const agentOutput = ref('')
const extractOutputLoading = ref(false)
const calculateOutputLoading = ref(false)

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true
})

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const targetIdx = token.attrIndex('target')
  if (targetIdx < 0) token.attrPush(['target', '_blank'])
  else token.attrs[targetIdx][1] = '_blank'
  token.attrPush(['rel', 'noopener noreferrer'])
  return self.renderToken(tokens, idx, options)
}

function unwrapOuterMarkdownFence(text) {
  let s = String(text || '').trim()
  if (!s) return s
  for (let i = 0; i < 3; i++) {
    if (!s.startsWith('```')) break
    const firstNl = s.indexOf('\n')
    if (firstNl === -1) break
    const firstLine = s.slice(0, firstNl).trim()
    if (!/^```[\w-]*\s*$/.test(firstLine)) break
    const body = s.slice(firstNl + 1)
    const close = body.lastIndexOf('```')
    if (close === -1) break
    s = body.slice(0, close).trim()
  }
  return s
}

const calculateAgentOutputHtml = computed(() => {
  const raw = calculateAgentOutput.value
  if (!raw || !String(raw).trim()) return ''
  const normalized = unwrapOuterMarkdownFence(String(raw).split('\\n').join('\n'))
  if (!normalized) return ''
  return md.render(normalized)
})

const uploadedFiles = ref([])
const previewFileRef = ref(null)
const currentPreviewFile = ref(null)
const previewUrlById = ref({})
const loadedFolderTreeKeys = ref(new Set())

const savedLeftW = localStorage.getItem('ocr-viewer-left-sidebar-width')
const parsedLeftSidebarW = savedLeftW ? parseInt(savedLeftW, 10) : NaN
const initialLeftSidebarW = Number.isFinite(parsedLeftSidebarW) ? parsedLeftSidebarW : 320
const leftSidebarWidth = ref(
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, initialLeftSidebarW))
)
const savedRightW = localStorage.getItem('prepaid-expenses-right-width')
const rightSidebarWidth = ref(savedRightW ? parseInt(savedRightW, 10) : 380)

const isResizingLeft = ref(false)
const isResizingRight = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const configReadonly = computed(() => isResultViewMode.value)
const billingBaseReadonly = computed(() => {
  if (!isResultViewMode.value) return false
  return prepaidPhase.value !== 'awaiting_billing_base'
})

const parsedBillingBase = computed(() => {
  const num = parseFloat(String(billingBase.value || '').replace(/,/g, ''))
  return Number.isFinite(num) && num > 0 ? num : 0
})

const currentExpenseLabel = computed(() => {
  const hit = expenseTypeOptions.find((x) => x.value === expenseType.value)
  return hit?.label || '—'
})

const hasExecuteTargets = computed(() => uploadedFiles.value.length > 0)

const canExecute = computed(() => {
  if (isResultViewMode.value) {
    return prepaidPhase.value === 'awaiting_billing_base'
  }
  return hasExecuteTargets.value && !!expenseType.value
})

const showExecuteButton = computed(() => {
  if (prepaidPhase.value === 'completed') return false
  if (isResultViewMode.value && prepaidPhase.value === 'pending_extract') return false
  if (isResultViewMode.value && prepaidPhase.value === 'calculating') return false
  return true
})

/**
 * 是否在左侧底栏展示「执行」（文件管理首次创建任务）
 * @returns {boolean} 非任务详情模式且允许执行时为 true
 */
const showLeftExecuteButton = computed(() => showExecuteButton.value && !isResultViewMode.value)

/**
 * 是否在右侧配置区展示「执行」（阶段①完成后填写计费基数二次执行）
 * @returns {boolean} 任务详情且等待填写计费基数时为 true
 */
const showRightExecuteButton = computed(() => {
  return isResultViewMode.value && prepaidPhase.value === 'awaiting_billing_base'
})

const executeButtonDisabled = computed(() => {
  if (analyzing.value) return true
  if (isResultViewMode.value) {
    return prepaidPhase.value !== 'awaiting_billing_base' || parsedBillingBase.value <= 0
  }
  return !canExecute.value
})

const executeButtonLabel = computed(() => {
  if (isResultViewMode.value && prepaidPhase.value === 'awaiting_billing_base') {
    return '执行'
  }
  if (isResultViewMode.value && prepaidPhase.value === 'pending_extract') {
    return '提取中'
  }
  return '执行'
})

function getPromptNodeClass(data) {
  if (data?.isPrompt) return 'tree-node-prompt'
  if (Array.isArray(data?.children) && data.children.length > 0) return 'tree-node-folder'
  return 'tree-node-disabled'
}

function hasMatchingPromptInTree(node, keyword) {
  if (node?.isPrompt) {
    return String(node.name || '').toLowerCase().includes(keyword)
  }
  if (Array.isArray(node?.children) && node.children.length > 0) {
    return node.children.some((child) => hasMatchingPromptInTree(child, keyword))
  }
  return false
}

function filterPromptNode(value, data) {
  if (!value) return true
  const keyword = String(value).toLowerCase()
  if (data?.isPrompt) {
    return String(data.name || '').toLowerCase().includes(keyword)
  }
  if (data?.id && String(data.id).startsWith('space-')) {
    return hasMatchingPromptInTree(data, keyword)
  }
  return hasMatchingPromptInTree(data, keyword)
}

function findPromptInTree(nodes, id) {
  if (!nodes || !Array.isArray(nodes) || id == null || id === '') return null
  for (const node of nodes) {
    if (node.isPrompt && (node.id === id || String(node.id) === String(id))) {
      return node
    }
    if (node.children && node.children.length > 0) {
      const found = findPromptInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

function findPromptByNameInTree(nodes, promptName) {
  const target = String(promptName || '').trim()
  if (!target || !nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node.isPrompt && String(node.name || '').trim() === target) {
      return node
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      const found = findPromptByNameInTree(node.children, target)
      if (found) return found
    }
  }
  return null
}

function setPromptTreeSelection(prompt, currentIdRef, contentRef, lastIdRef) {
  if (!prompt || prompt.id == null) return
  currentIdRef.value = prompt.id
  lastIdRef.value = prompt.id
  contentRef.value = prompt.content || ''
}

function clearPromptSlots() {
  billingAgreementPromptId.value = null
  lastBillingAgreementPromptId.value = null
  billingAgreementPromptContent.value = ''
  costCalculationPromptId.value = null
  lastCostCalculationPromptId.value = null
  costCalculationPromptContent.value = ''
}

function clearCachedExtractOutput() {
  cachedExtractOutput.value = ''
}

function buildDefaultTaskName() {
  return `${props.toolLabel}-${new Date().toLocaleString('zh-CN')}`
}

/**
 * 提示词树内按费用类型解析：精确名 → config.expense_type → 模糊
 * @param {Array} tree 提示词树
 * @param {string} expenseTypeValue 费用类型 value
 * @param {string} expenseLabel 费用类型展示名
 * @returns {object|null}
 */
function resolvePromptForTree(tree, expenseTypeValue, expenseLabel) {
  const exactName = EXPENSE_TYPE_TO_PROMPT_NAME[expenseTypeValue]
  if (exactName) {
    const byName = findPromptByNameInTree(tree, exactName)
    if (byName) return byName
  }

  let configMatched = null
  const walkConfig = (nodes) => {
    if (!Array.isArray(nodes) || configMatched) return
    for (const node of nodes) {
      if (node?.isPrompt) {
        const cfg = parsePromptConfig(node.config)
        const cfgExpense = String(cfg.expense_type || cfg.expenseType || '').trim()
        if (cfgExpense && cfgExpense === expenseTypeValue) {
          configMatched = node
          return
        }
      }
      if (Array.isArray(node?.children) && node.children.length) {
        walkConfig(node.children)
      }
    }
  }
  walkConfig(tree)
  if (configMatched) return configMatched

  return findPromptForExpenseType(tree, expenseTypeValue, expenseLabel)
}

/**
 * 按费用类型自动填充提示词（不覆盖用户手动选择）
 * @param {{ resetTouched?: boolean, notifyOnMiss?: boolean }} [options]
 */
function applyPromptsForExpenseType(options = {}) {
  const { resetTouched = false, notifyOnMiss = false } = options
  if (isResultViewMode.value) return

  const typeValue = expenseType.value
  const label = currentExpenseLabel.value

  if (!typeValue) {
    if (resetTouched) {
      billingPromptTouched.value = false
      costPromptTouched.value = false
      clearPromptSlots()
    }
    billingAgreementPromptTreeVersion.value += 1
    costCalculationPromptTreeVersion.value += 1
    return
  }

  if (resetTouched) {
    billingPromptTouched.value = false
    costPromptTouched.value = false
    clearPromptSlots()
  }

  const billing = resolvePromptForTree(billingAgreementPromptTree.value, typeValue, label)
  const calc = resolvePromptForTree(costCalculationPromptTree.value, typeValue, label)

  const missing = []
  if (!billing) missing.push('提取计费约定')
  if (!calc) missing.push('费用计算')

  if (!billingPromptTouched.value && billing) {
    setPromptTreeSelection(
      billing,
      billingAgreementPromptId,
      billingAgreementPromptContent,
      lastBillingAgreementPromptId
    )
  }
  if (!costPromptTouched.value && calc) {
    setPromptTreeSelection(
      calc,
      costCalculationPromptId,
      costCalculationPromptContent,
      lastCostCalculationPromptId
    )
  }

  if (notifyOnMiss && missing.length > 0) {
    const promptName = EXPENSE_TYPE_TO_PROMPT_NAME[typeValue] || label
    ElMessage.info(
      `未自动匹配到「${promptName}」相关提示词（${missing.join('、')}），请在提示词管理中补充`
    )
  }

  billingAgreementPromptTreeVersion.value += 1
  costCalculationPromptTreeVersion.value += 1
}

function findFirstPromptLeafInTree(nodes) {
  if (!nodes || !Array.isArray(nodes)) return null
  for (const node of nodes) {
    const hasKids = Array.isArray(node.children) && node.children.length > 0
    if (node.isPrompt && !hasKids) return node
    if (hasKids) {
      const found = findFirstPromptLeafInTree(node.children)
      if (found) return found
    }
  }
  return null
}

function pickDefaultPromptIdFromTree(tree) {
  const leaf = findFirstPromptLeafInTree(tree)
  return leaf?.id != null ? leaf.id : null
}

function parsePromptConfig(config) {
  if (!config) return {}
  if (typeof config === 'object') return config
  try {
    return JSON.parse(String(config))
  } catch (_e) {
    return {}
  }
}

function normalizeMatchText(text) {
  return String(text || '').trim().toLowerCase()
}

function promptMatchesExpenseType(node, expenseTypeValue, expenseLabel) {
  if (!node?.isPrompt) return false
  const cfg = parsePromptConfig(node.config)
  const cfgExpense = String(cfg.expense_type || cfg.expenseType || '').trim()
  if (cfgExpense && cfgExpense === expenseTypeValue) return true
  const name = normalizeMatchText(node.name)
  const label = normalizeMatchText(expenseLabel)
  if (!label) return false
  if (name === label || name.includes(label) || label.includes(name)) return true
  const labelCore = label.replace(/^工程/, '')
  if (labelCore && name.includes(labelCore)) return true
  if (label.includes('、')) {
    return label.split('、').some((part) => {
      const p = normalizeMatchText(part)
      return p && name.includes(p)
    })
  }
  return false
}

function findPromptForExpenseType(tree, expenseTypeValue, expenseLabel) {
  let matched = null
  const walk = (nodes) => {
    if (!Array.isArray(nodes) || matched) return
    for (const node of nodes) {
      if (node?.isPrompt && promptMatchesExpenseType(node, expenseTypeValue, expenseLabel)) {
        matched = node
        return
      }
      if (Array.isArray(node?.children) && node.children.length) {
        walk(node.children)
      }
    }
  }
  walk(tree)
  return matched
}

function applyPromptSelectionFromNode(node, currentIdRef, contentRef, lastIdRef) {
  if (!node) return
  currentIdRef.value = node.id
  lastIdRef.value = node.id
  contentRef.value = node.content || ''
}

function applyDefaultPromptSelection(tree, defaultPrompt, currentIdRef, contentRef, lastIdRef) {
  if (currentIdRef.value != null && currentIdRef.value !== '') return
  if (contentRef.value && String(contentRef.value).trim()) return
  if (defaultPrompt?.id != null && findPromptInTree(tree, defaultPrompt.id)) {
    currentIdRef.value = defaultPrompt.id
    lastIdRef.value = defaultPrompt.id
    if (defaultPrompt.content) {
      contentRef.value = defaultPrompt.content
    }
    return
  }
  const fallbackId = pickDefaultPromptIdFromTree(tree)
  if (fallbackId != null) {
    currentIdRef.value = fallbackId
    lastIdRef.value = fallbackId
    const node = findPromptInTree(tree, fallbackId)
    if (node?.content) {
      contentRef.value = node.content
    }
  }
}

function revertPromptTreeSelection(currentIdRef, lastIdRef) {
  nextTick(() => {
    currentIdRef.value = lastIdRef.value
  })
}

function handleBillingAgreementPromptChange(value) {
  billingPromptTouched.value = true
  if (value == null || value === '') {
    billingAgreementPromptContent.value = ''
    lastBillingAgreementPromptId.value = null
    return
  }
  const prompt = findPromptInTree(billingAgreementPromptTree.value, value)
  if (!prompt) {
    revertPromptTreeSelection(billingAgreementPromptId, lastBillingAgreementPromptId)
    return
  }
  lastBillingAgreementPromptId.value = value
  billingAgreementPromptContent.value = prompt.content || ''
}

function handleCostCalculationPromptChange(value) {
  costPromptTouched.value = true
  if (value == null || value === '') {
    costCalculationPromptContent.value = ''
    lastCostCalculationPromptId.value = null
    return
  }
  const prompt = findPromptInTree(costCalculationPromptTree.value, value)
  if (!prompt) {
    revertPromptTreeSelection(costCalculationPromptId, lastCostCalculationPromptId)
    return
  }
  lastCostCalculationPromptId.value = value
  costCalculationPromptContent.value = prompt.content || ''
}

async function loadPrepaidPromptTrees() {
  promptTreeLoading.value = true
  try {
    const [billingRes, calcRes] = await Promise.all([
      getPromptTreeByFunctionTypeNewAPI(BILLING_AGREEMENT_PROMPT_FUNCTION_TYPE),
      getPromptTreeByFunctionTypeNewAPI(COST_CALCULATION_PROMPT_FUNCTION_TYPE)
    ])
    const billingData = billingRes?.data
    const calcData = calcRes?.data
    billingAgreementPromptTree.value = Array.isArray(billingData?.items) ? billingData.items : []
    costCalculationPromptTree.value = Array.isArray(calcData?.items) ? calcData.items : []
    billingAgreementPromptApiTotal.value = Number(billingData?.total ?? 0)
    costCalculationPromptApiTotal.value = Number(calcData?.total ?? 0)
    billingAgreementPromptTreeVersion.value += 1
    costCalculationPromptTreeVersion.value += 1

    if (billingAgreementPromptApiTotal.value === 0) {
      console.warn(
        '[PrepaidExpenses] 提取计费约定提示词为空，functionType=%s，请在提示词管理配置所属功能 billing_agreement_prompt',
        BILLING_AGREEMENT_PROMPT_FUNCTION_TYPE
      )
    }
    if (costCalculationPromptApiTotal.value === 0) {
      console.warn(
        '[PrepaidExpenses] 费用计算提示词为空，functionType=%s，请在提示词管理配置所属功能 cost_calculation_prompt',
        COST_CALCULATION_PROMPT_FUNCTION_TYPE
      )
    }

    if (!isResultViewMode.value) {
      await nextTick()
      if (expenseType.value) {
        applyPromptsForExpenseType({ notifyOnMiss: false })
      } else {
        applyDefaultPromptSelection(
          billingAgreementPromptTree.value,
          billingData?.defaultPrompt,
          billingAgreementPromptId,
          billingAgreementPromptContent,
          lastBillingAgreementPromptId
        )
        applyDefaultPromptSelection(
          costCalculationPromptTree.value,
          calcData?.defaultPrompt,
          costCalculationPromptId,
          costCalculationPromptContent,
          lastCostCalculationPromptId
        )
      }
    }
  } catch (error) {
    console.error('[PrepaidExpenses] 加载提示词失败:', error)
    billingAgreementPromptTree.value = []
    costCalculationPromptTree.value = []
    billingAgreementPromptApiTotal.value = 0
    costCalculationPromptApiTotal.value = 0
    ElMessage.error('加载提示词列表失败')
  } finally {
    promptTreeLoading.value = false
    if (!isResultViewMode.value && expenseType.value) {
      applyPromptsForExpenseType({ notifyOnMiss: true })
    }
  }
}

function parseParameterSettings(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_e) {
    return {}
  }
}

function applyPromptSettingsFromResults(resultList) {
  const first = (resultList || [])[0]
  if (!first) return
  const settings = parseParameterSettings(first.parameter_settings)
  if (settings.expense_type) {
    expenseType.value = settings.expense_type
  }
  if (settings.billing_agreement_prompt_id != null && settings.billing_agreement_prompt_id !== '') {
    billingAgreementPromptId.value = settings.billing_agreement_prompt_id
    lastBillingAgreementPromptId.value = settings.billing_agreement_prompt_id
  }
  if (settings.billing_agreement_prompt_content != null) {
    billingAgreementPromptContent.value = settings.billing_agreement_prompt_content
  }
  if (settings.cost_calculation_prompt_id != null && settings.cost_calculation_prompt_id !== '') {
    costCalculationPromptId.value = settings.cost_calculation_prompt_id
    lastCostCalculationPromptId.value = settings.cost_calculation_prompt_id
  }
  if (settings.cost_calculation_prompt_content != null) {
    costCalculationPromptContent.value = settings.cost_calculation_prompt_content
  }
}

function mapSourceFileToDisplay(sourceFile) {
  const id = String(getFileIdentifier(sourceFile) || '')
  const name = sourceFile.file_name || sourceFile.name || `文件_${id}`
  return { id, name, sourceFile }
}

function getDisplayFileName(file) {
  if (!file) return ''
  return file.name || file.file_name || file.sourceFile?.file_name || file.sourceFile?.name || ''
}

function getFileTypeFromExtension(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (ext === 'wps') return 'doc'
  if (ext === 'txt') return 'txt'
  return 'text'
}

async function handleSidebarFileClick(sourceFile) {
  await selectFileForPreview(mapSourceFileToDisplay(sourceFile))
}

const sidebarCore = useSimpleOcrLeftSidebar({
  files: uploadedFiles,
  canSelectFileType: PREPAID_EXPENSES_EXTENSIONS,
  toolLabel: props.toolLabel,
  allowUnparsed: false,
  onFileClick: async (sourceFile) => {
    await handleSidebarFileClick(sourceFile)
  },
  isFileActive: (file) => {
    const fileId = String(getFileIdentifier(file) || '')
    return !!(
      fileId
      && currentPreviewFile.value
      && String(currentPreviewFile.value.id) === fileId
    )
  },
  onFilesRemoved: (removedFileIds) => {
    const curId = currentPreviewFile.value ? String(currentPreviewFile.value.id) : ''
    if (curId && removedFileIds.includes(curId)) {
      currentPreviewFile.value = null
    }
    if (!uploadedFiles.value.length && !isResultViewMode.value) {
      analysisDone.value = false
      calculateAgentOutput.value = ''
      agentOutput.value = ''
    }
  },
  afterFileSelectConfirm: () => {
    const list = uploadedFiles.value || []
    loadedFolderTreeKeys.value = new Set()
    if (list.length === 0) return
    showFilePreview.value = true
    centerViewMode.value = 'preview'
  }
})

const {
  addFilesFromManager,
  showFilePreview,
  leftSidebarBindings: sidebarBindingsBase,
  getSidebarExecuteContext
} = sidebarCore

function folderTreeNodeHasChildren(treeNode) {
  return Array.isArray(treeNode?.children) && treeNode.children.length > 0
}

function mergeRemoteFilesIntoUploaded(rawFiles, folderPath) {
  const normalizedPath = normalizeFolderPathForTree(folderPath || '')
  const existingIds = new Set(
    (uploadedFiles.value || []).map((f) => String(getFileIdentifier(f)))
  )

  ;(rawFiles || []).forEach((raw) => {
    const name = raw.file_name || raw.original_name || ''
    const ext = name.includes('.') ? String(name.split('.').pop()).toLowerCase() : ''
    if (!['pdf', 'doc', 'docx', 'wps'].includes(ext)) return

    const fileId = String(raw.file_id || '')
    if (!fileId || existingIds.has(fileId)) return

    uploadedFiles.value.push({
      file_id: fileId,
      fileId,
      id: fileId,
      name,
      file_name: name,
      folder_path: normalizedPath,
      folderPath: normalizedPath,
      type: getFileTypeFromExtension(name),
      parse_status: raw.parse_status
    })
    existingIds.add(fileId)
  })
}

async function handleFolderExpandInTree(treeNode) {
  if (!treeNode || treeNode.nodeType !== 'folder') return
  if (folderTreeNodeHasChildren(treeNode)) return

  const treeKey = treeNode.treeKey || ''
  if (treeKey && loadedFolderTreeKeys.value.has(treeKey)) return

  const folderId = treeNode.folderId || ''
  const folderPath = treeNode.folderPath || ''

  if (folderId) {
    try {
      const res = await getFileListAPI(
        buildFolderFileListQueryParams(
          { folder_id: folderId, page: 1, page_size: 100 },
          { allowUnparsed: false, fileExtensions: PREPAID_EXPENSES_EXTENSIONS }
        )
      )
      if (res?.code === 200 && Array.isArray(res?.data?.files)) {
        mergeRemoteFilesIntoUploaded(res.data.files, folderPath)
      }
    } catch (error) {
      console.error('[PrepaidExpenses] 文件夹文件加载失败:', error)
      ElMessage.error('文件夹文件加载失败')
    }
  }

  if (treeKey) {
    loadedFolderTreeKeys.value = new Set([...loadedFolderTreeKeys.value, treeKey])
  }
}

async function handleSidebarTreeNodeClick(treeNode, event) {
  if (!treeNode || treeNode.nodeType !== 'file') return
  const sourceFile = treeNode.sourceFile
  if (!sourceFile) return
  await handleSidebarFileClick(sourceFile)
  void event
}

async function handleTaskPreviewTreeNodeClick(treeNode, event) {
  if (!treeNode || treeNode.nodeType !== 'file') return
  const sourceFile = taskPreviewCore.resolveSourceFileFromTreeNode(treeNode)
  if (!sourceFile) return
  await handleSidebarFileClick(sourceFile)
  void event
}

const taskPreviewCore = useTaskCenterPreviewSidebar({
  taskId: resolvedTaskId,
  taskName: computed(() => taskNameSnapshot.value || props.toolLabel),
  showFilePreview,
  isFileActive: (file) => {
    const fileId = String(getFileIdentifier(file) || '')
    return !!(
      fileId
      && currentPreviewFile.value
      && String(currentPreviewFile.value.id) === fileId
    )
  },
  handleTreeNodeClick: handleTaskPreviewTreeNodeClick
})

const { taskPreviewSidebarBindings, loadTaskCenterPreviewSidebar } = taskPreviewCore

const leftSidebarBindings = computed(() => {
  if (isResultViewMode.value) {
    const preview = taskPreviewSidebarBindings.value || {}
    return {
      ...sidebarBindingsBase,
      ...preview,
      showFilePreview: preview.showFilePreview ?? showFilePreview,
      searchKeyword: preview.searchKeyword ?? sidebarBindingsBase.searchKeyword,
      fileTreeData: preview.fileTreeData ?? sidebarBindingsBase.fileTreeData,
      fileTreeRenderKey: preview.fileTreeRenderKey ?? sidebarBindingsBase.fileTreeRenderKey,
      handleTreeNodeClick: handleTaskPreviewTreeNodeClick,
      isFileActive: preview.isFileActive ?? sidebarBindingsBase.isFileActive,
      isFilePendingDelete: () => false,
      icons: preview.icons ?? sidebarBindingsBase.icons
    }
  }
  return {
    ...sidebarBindingsBase,
    handleTreeNodeClick: handleSidebarTreeNodeClick,
    isFilePendingDelete: () => false
  }
})

function buildPrepaidExecConfig() {
  return {
    exec_mode: 'custom',
    custom_config: {
      parameter_settings: {
        exec_phase: 'extract',
        expense_type: expenseType.value,
        expense_type_label: currentExpenseLabel.value,
        billing_agreement_prompt_id: billingAgreementPromptId.value || '',
        billing_agreement_prompt_content: billingAgreementPromptContent.value || '',
        cost_calculation_prompt_id: costCalculationPromptId.value || '',
        cost_calculation_prompt_content: costCalculationPromptContent.value || '',
        billing_base_wan: null
      },
      parameter_template: '',
      prompt_uuid: 'prompt'
    }
  }
}

function invalidateBatchExecute() {
  batchExecuteAborted = true
  if (activeBatchExecuteAbortController) {
    activeBatchExecuteAbortController.abort()
    activeBatchExecuteAbortController = null
  }
}

async function runPrepaidBatchExecute(taskName, taskRemark = '') {
  if (resolvedTaskId.value) {
    if (prepaidPhase.value === 'awaiting_billing_base') {
      return runPrepaidContinueExecute()
    }
    ElMessage.warning('当前任务已创建；阶段①完成后请填写计费基数，再点击「执行」进入费用计算')
    return false
  }

  clearCachedExtractOutput()

  const taskDataPayload = buildToolBatchExecutePayload({
    taskName,
    taskRemark: taskRemark || '',
    toolLabel: props.toolLabel,
    bizType: PREPAID_EXPENSES_BIZ_TYPE,
    taskType: PREPAID_EXPENSES_TASK_TYPE,
    toolUuid: PREPAID_EXPENSES_TOOL_UUID,
    taskSwitch: 2,
    buildExecConfig: buildPrepaidExecConfig,
    sidebarContext: getSidebarExecuteContext(),
    parseStatus: ['parsed'],
    fileExtensions: PREPAID_EXPENSES_EXTENSIONS
  })

  batchExecuteAborted = false
  isViewerActive.value = true
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  let succeeded = false
  let keepExtractLoading = false
  analyzing.value = true
  extractOutputLoading.value = true
  try {
    await runBatchExecuteWithTimeoutNav({
      taskName,
      requestFn: () => batchExecuteByFilterAPI(taskDataPayload, {
        signal: activeBatchExecuteAbortController ? activeBatchExecuteAbortController.signal : undefined
      }),
      openTaskCenter: () => {
        invalidateBatchExecute()
        emit('close-dialog')
        openTaskCenterWithRefresh(router, homeStore)
      },
      onError: (error) => {
        ElMessage.error('创建任务失败: ' + (error.message || '未知错误'))
      },
      onResponse: (response, { timeoutFallbackTriggered }) => {
        if (response.code === 200 || response.code === 201) {
          const taskUuid = response?.data?.task_uuid || response?.task_uuid || ''
          if (taskUuid) {
            lastCreatedTaskUuid.value = taskUuid
          }
          if (
            taskUuid
            && props.eventKey
            && !batchExecuteAborted
            && isViewerActive.value
            && !timeoutFallbackTriggered
          ) {
            eventBus.emit(props.eventKey, { taskUuid, taskName, taskOther: {} })
            keepExtractLoading = true
            startPrepaidTaskPoll(taskUuid)
          }
          if (!timeoutFallbackTriggered) {
            ElMessage.success('任务已创建，正在提取计费约定')
          }
          succeeded = true
          return
        }
        if (!timeoutFallbackTriggered) {
          ElMessage.error(response.message || '任务创建失败')
        }
      }
    })
  } finally {
    analyzing.value = false
    if (!keepExtractLoading) {
      extractOutputLoading.value = false
    }
  }
  return succeeded
}

function emitProgressStop() {
  const key = String(props.eventKey || '').trim()
  if (key === 'file-manager-progress-start') {
    emitFileManagerProgressStop()
  } else if (key === 'task-center-progress-start') {
    eventBus.emit('task-center-progress-stop')
  }
}

async function runPrepaidContinueExecute() {
  if (parsedBillingBase.value <= 0) {
    ElMessage.warning('请先填写计费基数（元）')
    centerViewMode.value = 'billing'
    return false
  }
  const taskUuid = resolvedTaskId.value
  if (!taskUuid) return false

  continueInFlight.value = true
  if (props.eventKey) {
    eventBus.emit(props.eventKey, {
      taskUuid,
      taskName: taskNameSnapshot.value || props.toolLabel,
      taskOther: {}
    })
  }

  analyzing.value = true
  extractOutputLoading.value = false
  try {
    const res = await prepaidExpensesContinueAPI({
      task_uuid: taskUuid,
      billing_base_wan: parsedBillingBase.value
    })
    if (res.code !== 200 && res.code !== 201) {
      emitProgressStop()
      continueInFlight.value = false
      phase2Submitted.value = false
      ElMessage.error(res.message || '提交费用计算失败')
      return false
    }
    prepaidPhase.value = 'calculating'
    phase2Submitted.value = true
    calculateOutputLoading.value = true
    continueInFlight.value = false
    startPrepaidTaskPoll(taskUuid)
    ElMessage.success('已提交费用计算')
    return true
  } catch (error) {
    emitProgressStop()
    continueInFlight.value = false
    phase2Submitted.value = false
    ElMessage.error('提交费用计算失败: ' + (error.message || '未知错误'))
    return false
  } finally {
    analyzing.value = false
  }
}

function hydrateReportFromResults(resultList) {
  const joined = collectPrepaidCalculateTexts(resultList)
  calculateAgentOutput.value = joined
  analysisDone.value = !!calculateAgentOutput.value
  return analysisDone.value
}

function resolvePrepaidTaskFailureMessage(td, resultList) {
  const notes = String(td?.task_notes || td?.TASK_NOTES || '').trim()
  if (notes) return notes
  const messages = []
  ;(resultList || []).forEach((item) => {
    const msg = item?.error_message || item?.ERROR_MESSAGE
    if (msg) messages.push(String(msg).trim())
  })
  const unique = [...new Set(messages.filter(Boolean))]
  if (unique.length) return unique.join('；')
  return '任务处理失败，请查看任务配置或联系管理员'
}

function findFirstFileTreeNode(nodes) {
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node?.nodeType === 'file') return node
    if (Array.isArray(node?.children) && node.children.length > 0) {
      const found = findFirstFileTreeNode(node.children)
      if (found) return found
    }
  }
  return null
}

async function trySelectFirstTaskPreviewFile() {
  if (!isResultViewMode.value) return
  await nextTick()
  const tree = taskPreviewSidebarBindings.value?.fileTreeData?.value || []
  const firstFileNode = findFirstFileTreeNode(tree)
  if (firstFileNode) {
    await handleTaskPreviewTreeNodeClick(firstFileNode, null)
    return
  }
  showFilePreview.value = true
}

function applyTaskContextFromDetail(td, resultList) {
  const list = resultList || []
  const serverPhase = resolveEffectivePrepaidPhase(td.prepaid_phase, list)
  const localPhase = prepaidPhase.value
  const hasCalcResults = hasPrepaidCalculateResults(list)

  if (phase2Submitted.value || localPhase === 'calculating' || hasCalcResults) {
    if (serverPhase === 'completed' || serverPhase === 'failed') {
      prepaidPhase.value = serverPhase
      phase2Submitted.value = false
    } else if (serverPhase === 'calculating') {
      prepaidPhase.value = 'calculating'
      phase2Submitted.value = false
    } else {
      prepaidPhase.value = 'calculating'
    }
  } else if (localPhase === 'completed') {
    prepaidPhase.value = 'completed'
  } else if (
    (localPhase === 'calculating' || localPhase === 'awaiting_billing_base')
    && (serverPhase === 'pending_extract' || serverPhase === 'awaiting_billing_base')
    && serverPhase !== 'calculating'
    && serverPhase !== 'completed'
    && serverPhase !== 'failed'
  ) {
    // 保持本地阶段，避免服务端滞后覆盖
  } else {
    prepaidPhase.value = serverPhase
  }
  let ctx = td.prepaid_context || {}
  if (!ctx.expense_type && td.selection_snapshot) {
    let snap = td.selection_snapshot
    if (typeof snap === 'string') {
      try {
        snap = JSON.parse(snap)
      } catch (_e) {
        snap = null
      }
    }
    if (snap?.prepaid_context && typeof snap.prepaid_context === 'object') {
      ctx = { ...ctx, ...snap.prepaid_context }
    }
  }
  if (ctx.expense_type) expenseType.value = ctx.expense_type
  const serverBase = ctx.billing_base_wan
  if (serverBase != null && serverBase !== '') {
    billingBase.value = String(serverBase)
  }
  taskNameSnapshot.value = td.task_name || props.toolLabel
  applyPromptSettingsFromResults(resultList)

  const texts = []
  list.forEach((item) => {
    const disposal = parsePrepaidDisposal(item.disposal_result)
    const text = disposal?.text_1 || disposal?.billing_agreement_text
    if (text) texts.push(String(text))
  })
  const joined = texts.join('\n\n---\n\n')
  if (joined) {
    cachedExtractOutput.value = joined
    agentOutput.value = joined
  } else if (cachedExtractOutput.value) {
    agentOutput.value = cachedExtractOutput.value
  } else {
    agentOutput.value = ''
  }

  extractOutputLoading.value = prepaidPhase.value === 'pending_extract'
  if (agentOutput.value && prepaidPhase.value === 'awaiting_billing_base') {
    extractOutputLoading.value = false
  }
  if (prepaidPhase.value === 'calculating') {
    extractOutputLoading.value = false
    calculateOutputLoading.value = true
  } else if (prepaidPhase.value === 'completed') {
    calculateOutputLoading.value = false
  }
}

function refreshFromTaskDetail(td, resultList) {
  if (!td) return
  applyTaskContextFromDetail(td, resultList || td.task_schedule_result_list || [])
  if (prepaidPhase.value === 'awaiting_billing_base') {
    awaitingTaskResults.value = false
    extractOutputLoading.value = false
  } else if (prepaidPhase.value === 'calculating') {
    awaitingTaskResults.value = false
    extractOutputLoading.value = false
    calculateOutputLoading.value = true
  } else if (prepaidPhase.value === 'completed') {
    awaitingTaskResults.value = false
    extractOutputLoading.value = false
    calculateOutputLoading.value = false
    finalizePrepaidDisplay(resultList || td.task_schedule_result_list || [])
  } else if (prepaidPhase.value === 'failed') {
    awaitingTaskResults.value = false
    extractOutputLoading.value = false
    calculateOutputLoading.value = false
  }
}

function formatAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function initFilesFromProps() {
  const filesParam = String(props.files || '').trim()
  const namesParam = String(props.names || '').trim()
  if (!filesParam) return

  const sep = filesParam.includes('||') ? '||' : ','
  const ids = filesParam.split(sep).filter(Boolean)
  const names = namesParam ? namesParam.split(sep).filter(Boolean) : []

  await addFilesFromManager(ids.map((id, index) => ({
    file_id: id,
    file_name: names[index] || `文件_${id}`,
    folder_path: ''
  })))

  if (uploadedFiles.value.length) {
    await selectFileForPreview(mapSourceFileToDisplay(uploadedFiles.value[0]))
  }
}

async function selectFileForPreview(displayRow) {
  if (!displayRow?.id) return
  showFilePreview.value = true
  centerViewMode.value = 'preview'

  const fileName = displayRow.name || ''
  const fileType = getFileTypeFromExtension(fileName)

  let previewUrl = previewUrlById.value[displayRow.id] || ''
  if (displayRow.id && !previewUrl) {
    try {
      const previewRes = await previewFileAPI(displayRow.id)
      if (previewRes.code === 200 && previewRes.data?.preview_url) {
        previewUrl = previewRes.data.preview_url
        previewUrlById.value = { ...previewUrlById.value, [displayRow.id]: previewUrl }
      }
    } catch (e) {
      console.warn('获取预览URL失败:', e)
    }
  }

  currentPreviewFile.value = {
    id: displayRow.id,
    name: fileName,
    file_name: fileName,
    type: fileType,
    fileId: displayRow.id,
    previewUrl
  }
}

function handlePreviewRefresh() {
  if (currentPreviewFile.value && previewFileRef.value) {
    previewFileRef.value.loadFile(currentPreviewFile.value)
    ElMessage.success('已刷新')
  }
}

function handlePreviewDownload() {
  ElMessage.info('下载功能将在正式版本中接入')
}

function validatePhase1ExecutePreconditions() {
  if (!hasExecuteTargets.value) {
    ElMessage.warning('请先在左侧添加文件或文件夹')
    return false
  }
  if (!expenseType.value) {
    ElMessage.warning('请先选择费用类型')
    return false
  }
  if (!String(billingAgreementPromptContent.value || '').trim()) {
    ElMessage.warning('请手动选择或填写提取计费约定提示词')
    return false
  }
  if (!String(costCalculationPromptContent.value || '').trim()) {
    ElMessage.warning('请手动选择或填写费用计算提示词')
    return false
  }
  return true
}

function shouldDeferPrepaidProgressFinish() {
  return continueInFlight.value
    || phase2Submitted.value
    || prepaidPhase.value === 'calculating'
}

function isPrepaidPhase2InProgress() {
  return phase2Submitted.value || prepaidPhase.value === 'calculating'
}

function stopPrepaidTaskPoll() {
  prepaidTaskPollToken++
  if (prepaidTaskPollTimer) {
    clearInterval(prepaidTaskPollTimer)
    prepaidTaskPollTimer = null
  }
}

async function refreshPrepaidTaskFull(taskUuid) {
  if (!taskUuid) return null
  try {
    const res = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: false,
      include_results: true,
      include_result_details: true,
      include_selection_summary: true,
      include_task_steps: true
    })
    if (res.code !== 200 || !res.data) return null
    return res.data
  } catch (e) {
    console.error('[PrepaidExpenses] 全量刷新任务失败:', e)
    return null
  }
}

function handlePrepaidPollTerminal(phase) {
  stopPrepaidTaskPoll()
  emitProgressStop()
  if (phase === 'awaiting_billing_base') {
    extractOutputLoading.value = false
  }
}

async function tickPrepaidTaskPoll(taskUuid) {
  const token = prepaidTaskPollToken
  if (!taskUuid || !isViewerActive.value) return

  await refreshPrepaidTaskLight(taskUuid)
  if (token !== prepaidTaskPollToken) return

  const phase = prepaidPhase.value
  if (phase === 'failed') {
    handlePrepaidPollTerminal('failed')
    return
  }
  if (phase === 'awaiting_billing_base') {
    handlePrepaidPollTerminal('awaiting_billing_base')
    return
  }
  if (phase === 'completed') {
    if (analysisDone.value) {
      finalizePrepaidDisplay([], { fromPoll: true })
      return
    }
    if (prepaidFullFetchRetryCount < PREPAID_FULL_FETCH_MAX_RETRIES) {
      prepaidFullFetchRetryCount++
      const td = await refreshPrepaidTaskFull(taskUuid)
      if (token !== prepaidTaskPollToken) return
      if (td) {
        await loadTaskCenterPreviewSidebar(td)
        const resultList = td.task_schedule_result_list || []
        refreshFromTaskDetail(td, resultList)
        if (analysisDone.value) {
          finalizePrepaidDisplay(resultList, { fromPoll: true })
          return
        }
      }
    } else {
      taskResultLoadError.value = '结果同步中，请稍后刷新'
      calculateOutputLoading.value = false
      stopPrepaidTaskPoll()
      emitProgressStop()
    }
  }
}

function startPrepaidTaskPoll(taskUuid) {
  const uuid = String(taskUuid || lastCreatedTaskUuid.value || resolvedTaskId.value || '').trim()
  if (!uuid) return
  stopPrepaidTaskPoll()
  prepaidFullFetchRetryCount = 0
  const token = ++prepaidTaskPollToken
  prepaidTaskPollTimer = setInterval(() => {
    if (token !== prepaidTaskPollToken) return
    void tickPrepaidTaskPoll(uuid)
  }, PREPAID_TASK_POLL_INTERVAL_MS)
  void tickPrepaidTaskPoll(uuid)
}

function finalizePrepaidDisplay(taskScheduleResultList, options = {}) {
  const list = taskScheduleResultList || []
  const hasReport = list.length ? hydrateReportFromResults(list) : analysisDone.value
  if (!hasReport) {
    calculateOutputLoading.value = true
    return false
  }
  taskResultLoadError.value = ''
  awaitingTaskResults.value = false
  prepaidPhase.value = 'completed'
  extractOutputLoading.value = false
  calculateOutputLoading.value = false
  continueInFlight.value = false
  phase2Submitted.value = false
  if (options.fromPoll) {
    emitProgressStop()
  }
  return true
}

function onTaskMetaDialogClosed() {
  taskMetaSubmitting.value = false
}

async function confirmTaskMetaAndRun() {
  const name = (taskMetaForm.taskName || '').trim()
  if (!name) {
    ElMessage.warning('请输入任务名称')
    return
  }
  if (taskMetaSubmitting.value) return
  taskMetaSubmitting.value = true
  taskMetaDialogVisible.value = false
  const notes = (taskMetaForm.taskNotes || '').trim()
  try {
    await runPrepaidBatchExecute(name, notes)
  } finally {
    taskMetaSubmitting.value = false
  }
}

async function handleExecute() {
  if (isResultViewMode.value) {
    if (prepaidPhase.value === 'awaiting_billing_base') {
      await runPrepaidContinueExecute()
    }
    return
  }
  if (!validatePhase1ExecutePreconditions()) return
  taskMetaForm.taskName = buildDefaultTaskName()
  taskMetaForm.taskNotes = ''
  taskMetaDialogVisible.value = true
}

const setResult = async (taskScheduleResultList) => {
  const list = taskScheduleResultList || []
  if (!hasPrepaidCalculateResults(list)) {
    const taskUuid = resolvedTaskId.value || lastCreatedTaskUuid.value
    if (taskUuid) {
      calculateOutputLoading.value = true
      const td = await refreshPrepaidTaskFull(taskUuid)
      if (td) {
        await loadTaskCenterPreviewSidebar(td)
        const fullList = td.task_schedule_result_list || []
        refreshFromTaskDetail(td, fullList)
        if (finalizePrepaidDisplay(fullList)) return
      }
    }
    calculateOutputLoading.value = true
    prepaidPhase.value = 'calculating'
    startPrepaidTaskPoll(taskUuid)
    return
  }
  finalizePrepaidDisplay(list)
}

const taskError = () => {
  stopPrepaidTaskPoll()
  awaitingTaskResults.value = false
  analyzing.value = false
  extractOutputLoading.value = false
  calculateOutputLoading.value = false
  continueInFlight.value = false
  phase2Submitted.value = false
  clearCachedExtractOutput()
}

defineExpose({
  setResult,
  taskError,
  refreshFromTaskDetail,
  shouldDeferPrepaidProgressFinish,
  isPrepaidPhase2InProgress,
  finalizePrepaidDisplay,
  loadPrepaidTaskById
})

async function refreshPrepaidTaskLight(taskUuid) {
  if (!taskUuid) return
  try {
    const res = await getTaskSchedulesAPI(taskUuid, {
      prefer_runtime: true,
      include_results: true,
      include_selection_summary: true,
      include_task_steps: true
    })
    if (res.code !== 200 || !res.data) return
    const td = res.data
    await loadTaskCenterPreviewSidebar(td)
    refreshFromTaskDetail(td, td.task_schedule_result_list || [])
  } catch (e) {
    console.error('[PrepaidExpenses] 轻量刷新任务失败:', e)
  }
}

async function loadPrepaidTaskById() {
  const id = resolvedTaskId.value
  if (!id) return
  resultViewLoading.value = true
  taskResultLoadError.value = ''
  awaitingTaskResults.value = false
  try {
    const res = await getTaskSchedulesAPI(id, {
      prefer_runtime: true,
      include_results: true,
      include_selection_summary: true,
      include_task_steps: true
    })
    if (res.code !== 200 || !res.data) {
      taskResultLoadError.value = res.message || '获取任务详情失败'
      return
    }
    const td = res.data
    await loadTaskCenterPreviewSidebar(td)
    const resultList = td.task_schedule_result_list || []
    applyTaskContextFromDetail(td, resultList)

    const st = Number(td.task_status)
    const hasFailedFile = (resultList || []).some(
      (item) => Number(item?.processing_status ?? item?.PROCESSING_STATUS ?? 0) === 3
    )
    if (st === 3 || prepaidPhase.value === 'failed' || hasFailedFile) {
      taskResultLoadError.value = resolvePrepaidTaskFailureMessage(td, resultList)
      prepaidPhase.value = 'failed'
      extractOutputLoading.value = false
      calculateOutputLoading.value = false
      showFilePreview.value = true
      await trySelectFirstTaskPreviewFile()
      return
    }

    if (st === 2 || prepaidPhase.value === 'completed') {
      if (finalizePrepaidDisplay(resultList)) {
        viewerTab.value = 'report'
        return
      }
      await trySelectFirstTaskPreviewFile()
      startPrepaidTaskPoll(id)
      return
    }

    if (prepaidPhase.value === 'awaiting_billing_base') {
      showFilePreview.value = true
      centerViewMode.value = 'billing'
      extractOutputLoading.value = false
      return
    }

    await trySelectFirstTaskPreviewFile()

    if (prepaidPhase.value === 'pending_extract' || prepaidPhase.value === 'calculating') {
      awaitingTaskResults.value = true
      startPrepaidTaskPoll(id)
      if (props.isSecondaryExecution && String(props.eventKey || '').trim()) {
        eventBus.emit(props.eventKey, {
          taskUuid: id,
          taskName: td.task_name || props.toolLabel,
          taskOther: {}
        })
      }
    }
  } catch (e) {
    console.error(e)
    taskResultLoadError.value = e?.message || '加载任务失败'
  } finally {
    resultViewLoading.value = false
  }
}

function handleGoToTaskCenter() {
  openTaskCenterWithRefresh(router, homeStore)
  emit('close-dialog')
}

function startLeftSidebarResize(e) {
  isResizingLeft.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
}

function handleLeftSidebarResize(e) {
  if (!isResizingLeft.value) return
  const diff = e.clientX - resizeStartX.value
  const next = resizeStartWidth.value + diff
  if (next >= LEFT_SIDEBAR_WIDTH_MIN && next <= LEFT_SIDEBAR_WIDTH_MAX) {
    leftSidebarWidth.value = next
  }
}

function stopLeftSidebarResize() {
  if (isResizingLeft.value) {
    localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
  }
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
}

function startRightSidebarResize(e) {
  isResizingRight.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = rightSidebarWidth.value
  document.addEventListener('mousemove', handleRightSidebarResize)
  document.addEventListener('mouseup', stopRightSidebarResize)
  document.body.classList.add('resizing')
}

function handleRightSidebarResize(e) {
  if (!isResizingRight.value) return
  const diff = resizeStartX.value - e.clientX
  const next = resizeStartWidth.value + diff
  if (next >= 300 && next <= 640) {
    rightSidebarWidth.value = next
  }
}

function stopRightSidebarResize() {
  if (isResizingRight.value) {
    localStorage.setItem('prepaid-expenses-right-width', String(rightSidebarWidth.value))
  }
  isResizingRight.value = false
  document.removeEventListener('mousemove', handleRightSidebarResize)
  document.removeEventListener('mouseup', stopRightSidebarResize)
  document.body.classList.remove('resizing')
}

watch(resolvedTaskId, async (id, prev) => {
  if (!id || id === prev) return
  if (id === lastCreatedTaskUuid.value) {
    await refreshPrepaidTaskLight(id)
    if (!prepaidTaskPollTimer && (prepaidPhase.value === 'pending_extract' || prepaidPhase.value === 'calculating')) {
      startPrepaidTaskPoll(id)
    }
    return
  }
  await loadPrepaidTaskById()
})

watch(expenseType, (val) => {
  if (isResultViewMode.value) return
  agentOutput.value = ''
  clearCachedExtractOutput()
  analysisDone.value = false
  calculateAgentOutput.value = ''
  applyPromptsForExpenseType({ resetTouched: true, notifyOnMiss: !!val })
})

onMounted(async () => {
  await loadPrepaidPromptTrees()
  if (isResultViewMode.value) {
    await loadPrepaidTaskById()
  } else {
    await initFilesFromProps()
  }
})

onBeforeUnmount(() => {
  isViewerActive.value = false
  stopPrepaidTaskPoll()
  invalidateBatchExecute()
  stopLeftSidebarResize()
  stopRightSidebarResize()
})
</script>

<style scoped>
.prepaid-expenses-prototype {
  display: flex;
  align-items: stretch;
  height: calc(100vh - 75px);
  overflow: hidden;
  background: var(--sd-surface-1, #f4f4f4);
}

.prepaid-expenses-prototype--embedded {
  height: 100%;
  min-height: 0;
  flex: 1;
}

.prepaid-task-alert {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.ocr-column-head {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.field-mode-header.ocr-column-head {
  justify-content: flex-start;
}

.left-sidebar-shell {
  align-self: stretch;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  background: var(--sd-canvas, #ffffff);
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.left-sidebar-shell :deep(.prepaid-left-sidebar) {
  border-right: none;
}

.center-viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--sd-canvas, #ffffff);
  overflow: hidden;
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.page-controls--placeholder {
  flex: 1;
  min-width: 0;
}

.header-actions-slot {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.header-actions-slot > * + * {
  margin-left: 8px;
}

.center-view-mode-btn {
  margin-left: 8px;
}

.center-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.center-body--fill {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.center-body--fill :deep(.preview-file-wrapper) {
  flex: 1;
  min-height: 0;
}

.center-body--fill :deep(.viewer-header.ocr-column-head) {
  height: 56px;
  min-height: 56px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.billing-agreement-panel {
  max-width: 820px;
  margin: 0 auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.billing-agreement-head {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.billing-agreement-head > * + * {
  margin-left: 8px;
}

.billing-agreement-section {
  margin-bottom: 16px;
}

.billing-agreement-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.agent-output-box {
  min-height: 280px;
  max-height: 420px;
  overflow: auto;
  padding: 12px 16px;
  background: #fafafa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.agent-output-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.75;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
}

.right-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 260px;
  max-width: 700px;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.right-viewer-fullwidth {
  flex: 1;
  max-width: none !important;
  min-width: 0 !important;
}

.sidebar-tabs {
  flex-shrink: 0;
}

.sidebar-tabs.ocr-column-head {
  padding: 0 12px;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__header) {
  margin: 0;
}

.sidebar-tabs.ocr-column-head :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.right-sidebar {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.config-panel-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

.config-form {
  display: flex;
  flex-direction: column;
}

.rule-config {
  margin-top: 0;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: var(--sd-canvas, #ffffff);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.rule-header--section {
  margin-top: 0;
  margin-bottom: 12px;
  border: none;
  padding-top: 0;
  padding-bottom: 0;
}

.field-mode-header.ocr-column-head {
  justify-content: flex-start;
  align-items: stretch;
  height: auto;
  min-height: 56px;
  padding-top: 10px;
  padding-bottom: 10px;
}

.field-mode-header--stacked .field-block--compact {
  width: 100%;
  margin-bottom: 0;
}

.rule-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.prompt-config {
  margin-top: 4px;
}

.prompt-group + .prompt-group {
  margin-top: 4px;
}

.prompt-group--divider {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
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
  display: block;
  width: auto;
  padding-right: 0;
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

.preserve-whitespace :deep(.el-textarea__inner) {
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
}

.config-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.config-label--gap {
  margin-top: 16px;
}

.config-hint {
  margin-top: 20px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
  background: var(--sd-surface-1, #f4f4f4);
  border-radius: 4px;
}

.config-run-btn {
  width: 100%;
  margin-top: 16px;
}

.report-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}

.report-agent-output-section {
  margin-top: 0;
}

.report-agent-output-box {
  min-height: 160px;
  max-height: none;
  padding: 0;
  background: transparent;
  border: none;
}

.report-agent-output-md {
  padding: 16px 20px;
  line-height: 1.7;
  color: #303133;
  font-size: 14px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  word-break: break-word;
}

.report-agent-output-md :deep(h1) {
  font-size: 1.35em;
  margin: 0.6em 0 0.4em;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 0.25em;
}

.report-agent-output-md :deep(h2) {
  font-size: 1.2em;
  margin: 0.85em 0 0.45em;
  font-weight: 600;
  color: #1f2d3d;
}

.report-agent-output-md :deep(h3) {
  font-size: 1.05em;
  margin: 0.75em 0 0.35em;
  font-weight: 600;
  color: #303133;
}

.report-agent-output-md :deep(p) {
  margin: 0.55em 0;
}

.report-agent-output-md :deep(ul),
.report-agent-output-md :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.report-agent-output-md :deep(li) {
  margin: 0.25em 0;
}

.report-agent-output-md :deep(strong) {
  font-weight: 600;
  color: #1f2d3d;
}

.report-agent-output-md :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid #e4e7ed;
}

.report-agent-output-md :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.25em 0 0.25em 0.85em;
  border-left: 4px solid #dcdfe6;
  color: #606266;
  background: #fff;
}

.report-agent-output-md :deep(pre) {
  margin: 0.75em 0;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
}

.report-agent-output-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
}

.report-agent-output-md :deep(p code),
.report-agent-output-md :deep(li code) {
  padding: 0.15em 0.4em;
  background: #f0f2f5;
  border-radius: 3px;
}

.report-agent-output-md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75em 0;
  font-size: 13px;
}

.report-agent-output-md :deep(th),
.report-agent-output-md :deep(td) {
  border: 1px solid #e4e7ed;
  padding: 8px 10px;
  text-align: left;
}

.report-agent-output-md :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

.resizer {
  width: 4px;
  background: var(--sd-hairline, #e0e0e0);
  cursor: col-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background-color 0.2s;
  z-index: 10;
}

.resizer-left {
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
}

.resizer:hover {
  background: var(--sd-primary, #195fb4);
}

.resize-icon {
  font-size: 12px;
  color: #909399;
  pointer-events: none;
}

.resizer:hover .resize-icon {
  color: var(--sd-primary, #195fb4);
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer {
  background-color: var(--sd-primary, #195fb4);
  opacity: 1;
}

:deep(.tree-node-prompt) {
  color: #67c23a;
  font-size: 13px;
  padding-left: 4px;
  font-weight: 500;
}

:deep(.tree-node-prompt)::before {
  content: '📄';
  margin-right: 4px;
}

:deep(.tree-node-folder) {
  color: #606266;
  font-weight: 500;
}

:deep(.tree-node-disabled) {
  color: #c0c4cc;
}

.prompt-tree-empty-hint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #e6a23c;
}

.prompt-tree-empty-hint code {
  margin: 0 2px;
  padding: 0 4px;
  font-size: 11px;
  color: #c45600;
  background: #fdf6ec;
  border-radius: 2px;
}
</style>
