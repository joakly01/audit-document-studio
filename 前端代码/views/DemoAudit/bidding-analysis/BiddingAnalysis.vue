<template>
  <div class="bidding-analysis">
    <!-- 结果页：项目列表 / 项目详情 -->
    <BiddingAnalysisResultProjectList
      v-if="showResultView && !selectedResultProjectId"
      v-loading="resultOverviewLoading"
      :projects="resultProjectList"
      :analysis-modes="resultAnalysisModes"
      @back="closeResultView"
      @select="openResultProjectDetail"
    />
    <BiddingAnalysisResultView
      v-else-if="showResultView && selectedResultProject"
      :project="selectedResultProject"
      :analysis-modes="resultAnalysisModes"
      :analysis-id="activeAnalysisId"
      :use-api="!!activeAnalysisId"
      @back="selectedResultProjectId = null"
    />

    <template v-else>
    <div class="bidding-analysis-layout">
      <!-- 左侧：招标文件 / 投标文件分开上传 -->
      <aside class="bidding-analysis-sidebar">
        <div class="bidding-analysis-sidebar-scroll">
        <div class="bidding-analysis-sidebar-title-row">
          <div class="bidding-analysis-sidebar-title">招投标分析</div>
          <div v-if="projects.length > 1" class="bidding-analysis-collapse-actions">
            <el-button plain @click="expandAllProjects">全部展开</el-button>
            <el-button plain @click="collapseAllProjects">全部收起</el-button>
          </div>
        </div>

        <div
          v-for="(proj, projIndex) in projects"
          :key="proj.id"
          class="bidding-analysis-project-block"
          :class="{ 'is-collapsed': !isProjectExpanded(proj.id) }"
        >
          <div class="bidding-analysis-project-head">
            <el-button
              link
              type="primary"
              class="bidding-analysis-toggle-btn"
              :title="isProjectExpanded(proj.id) ? '收起' : '展开'"
              @click="toggleProjectExpand(proj.id)"
            >
              <el-icon :size="16">
                <ArrowUp v-if="isProjectExpanded(proj.id)" />
                <ArrowDown v-else />
              </el-icon>
            </el-button>
            <div class="bidding-analysis-project-head-main">
              <span class="bidding-analysis-project-index">{{ formatProjectLabel(projIndex) }}</span>
              <span
                v-if="proj.projectNameExtracting"
                class="bidding-analysis-project-name-tag bidding-analysis-project-name-loading"
              >
                <el-icon class="is-loading"><Loading /></el-icon>
                <span>分析中</span>
              </span>
              <span
                v-else-if="proj.name"
                class="bidding-analysis-project-name-tag"
                :title="proj.name"
              >
                {{ proj.name }}
              </span>
              <span
                v-if="!isProjectExpanded(proj.id)"
                class="bidding-analysis-collapse-summary"
                :title="getProjectCollapseSummary(proj)"
              >
                {{ getProjectCollapseSummary(proj) }}
              </span>
            </div>
            <el-button
              v-if="projects.length > 1"
              type="danger"
              link
              class="bidding-analysis-collapse-delete bidding-analysis-icon-btn"
              @click="removeProject(proj.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>

          <div v-show="isProjectExpanded(proj.id)" class="bidding-analysis-project-body">
          <div class="bidding-analysis-section">
            <div class="bidding-analysis-section-head">招标文件</div>
            <div class="bidding-analysis-field">
              <div class="bidding-analysis-field-label">文件</div>
              <div class="bidding-analysis-field-body">
                <div v-if="proj.biddingFile" class="bidding-analysis-file-chip">
                  <el-icon><Document /></el-icon>
                  <span class="bidding-analysis-file-name" :title="proj.biddingFile.name">
                    {{ proj.biddingFile.name }}
                  </span>
                  <span v-if="proj.biddingFile.size" class="bidding-analysis-file-size">
                    {{ proj.biddingFile.size }}
                  </span>
                </div>
                <div v-if="proj.biddingFile" class="bidding-analysis-bidding-actions">
                  <el-button type="primary" plain @click="openBiddingFileSelect(proj.id)">
                    更换文件
                  </el-button>
                  <el-button type="danger" plain @click="removeBiddingFile(proj.id)">
                    删除文件
                  </el-button>
                </div>
                <el-button
                  v-else
                  type="primary"
                  class="bidding-analysis-select-file-btn"
                  plain
                  @click="openBiddingFileSelect(proj.id)"
                >
                  选择文件
                </el-button>
              </div>
            </div>
          </div>

          <div class="bidding-analysis-section">
            <div class="bidding-analysis-section-head">投标文件</div>
            <div
              v-for="(company, companyIndex) in proj.tenderCompanies"
              :key="company.id"
              class="bidding-analysis-company"
            >
              <div class="bidding-analysis-company-title-row">
                <span class="bidding-analysis-company-title">投标单位 {{ companyIndex + 1 }}</span>
                <el-button
                  v-if="proj.tenderCompanies.length > 1"
                  type="danger"
                  link
                  class="bidding-analysis-icon-btn"
                  @click="removeCompany(proj.id, company.id)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
              <div class="bidding-analysis-field">
                <div class="bidding-analysis-field-label">单位名称</div>
                <div class="bidding-analysis-field-body">
                  <el-input
                    v-model="company.name"
                    class="bidding-analysis-company-name"
                    placeholder="公司名称"
                  />
                </div>
              </div>
              <div class="bidding-analysis-field bidding-analysis-field--last">
                <div class="bidding-analysis-field-label">投标文件</div>
                <div class="bidding-analysis-field-body">
                  <el-button
                    type="primary"
                    class="bidding-analysis-select-file-btn"
                    plain
                    @click="openTenderFileSelect(proj.id, company.id)"
                  >
                    选择文件
                  </el-button>
                  <div
                    v-for="file in company.files"
                    :key="file.uid"
                    class="bidding-analysis-file-chip bidding-analysis-file-chip--small"
                  >
                    <el-icon><Document /></el-icon>
                    <span class="bidding-analysis-file-name" :title="file.name">{{ file.name }}</span>
                    <span v-if="file.size" class="bidding-analysis-file-size">{{ file.size }}</span>
                    <el-button type="danger" link class="bidding-analysis-icon-btn" @click="removeTenderFile(proj.id, company.id, file.uid)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
            <div class="bidding-analysis-field-body">
              <el-button class="bidding-analysis-add-company" plain @click="addCompany(proj.id)">
                <el-icon><Plus /></el-icon>
                新增投标单位
              </el-button>
            </div>
          </div>
          </div>
        </div>

        <el-button class="bidding-analysis-add-project" plain @click="addProject">
          <el-icon><Plus /></el-icon>
          新增项目
        </el-button>
        </div>
        <div class="bidding-analysis-sidebar-footer">
          <p v-if="startBlockedReason" class="bidding-analysis-sidebar-footer-tip">
            {{ startBlockedReason }}
          </p>
          <el-button
            type="primary"
            :loading="analyzing && progressDialogVisible"
            :disabled="sidebarPrimaryDisabled"
            @click="handleSidebarPrimaryClick"
          >
            {{ sidebarPrimaryLabel }}
          </el-button>
        </div>
      </aside>

      <!-- 主内容区 -->
      <main class="bidding-analysis-main">
        <el-card shadow="never" class="bidding-analysis-card">
          <el-form label-width="100px" class="bidding-analysis-form">
            <el-form-item v-if="configuredProjects.length" label="项目清单">
              <div class="bidding-analysis-project-list-summary">
                <div
                  v-for="(proj, index) in configuredProjects"
                  :key="proj.id"
                  class="bidding-analysis-project-list-item"
                >
                  <span class="bidding-analysis-project-list-index">{{ index + 1 }}.</span>
                  <span class="bidding-analysis-project-list-name">
                    <span
                      v-if="proj.projectNameExtracting"
                      class="bidding-analysis-project-name-loading"
                    >
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span>分析中</span>
                    </span>
                    <span v-else>{{ proj.name || formatProjectLabel(index) }}</span>
                  </span>
                  <span v-if="proj.biddingFile" class="bidding-analysis-project-list-file">
                    {{ proj.biddingFile.name }}
                  </span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="分析范围">
              <div class="bidding-analysis-scope-summary">
                <el-tag type="info" effect="plain">{{ projectCountLabel }}</el-tag>
                <el-tag type="info" effect="plain">{{ biddingFileScopeLabel }}</el-tag>
                <el-tag type="info" effect="plain">{{ totalTenderCompanyCount }} 个投标单位</el-tag>
                <el-tag type="info" effect="plain">{{ totalTenderFileCount }} 份投标文件</el-tag>
                <span class="bidding-analysis-scope-tip">{{ scopeTipText }}</span>
              </div>
            </el-form-item>
            <el-form-item label="模式">
              <el-checkbox-group v-model="analysisModes" class="bidding-analysis-mode-group">
                <div
                  v-for="item in modeOptions"
                  :key="item.value"
                  class="bidding-analysis-mode-item"
                >
                  <el-checkbox :label="item.value" class="bidding-analysis-mode-checkbox" />
                  <button
                    type="button"
                    class="bidding-analysis-mode-name"
                    :class="{ 'is-selected': normalizedAnalysisModes.includes(item.value) }"
                    @click="toggleAnalysisMode(item.value)"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </el-checkbox-group>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card
          v-for="mode in normalizedAnalysisModes"
          :key="mode"
          shadow="never"
          class="bidding-analysis-card bidding-analysis-mode-card"
        >
          <template #header>
            <span class="bidding-analysis-card-title">{{ getModeLabel(mode) }}</span>
          </template>
          <el-form label-width="100px" class="bidding-analysis-form">
            <el-form-item label="选择分析模板">
              <el-select
                v-model="modePromptIds[mode]"
                class="bidding-analysis-form-select"
                placeholder="请选择分析模板"
                :loading="!promptTreeLoaded"
                :disabled="!getPromptOptionsForMode(promptTreeItems, mode).length"
              >
                <el-option
                  v-for="item in getPromptOptionsForMode(promptTreeItems, mode)"
                  :key="item.promptId || item.id"
                  :label="item.name"
                  :value="item.promptId"
                />
              </el-select>
              <div
                v-if="promptTreeLoaded && !getPromptOptionsForMode(promptTreeItems, mode).length"
                class="bidding-analysis-prompt-empty-tip"
              >
                未找到「{{ getModeLabel(mode) }}」提示词，请在提示词管理（所属功能：招投标分析）中配置
              </div>
            </el-form-item>
            <BiddingAnalysisRulePromptPanel
              :ref="(el) => setModePanelRef(mode, el)"
              :template="getTemplateForMode(mode)"
              @change="(payload) => handleModePromptChange(mode, payload)"
            />
          </el-form>
        </el-card>
      </main>
    </div>
    </template>

    <FileSelectDialog
      v-model="fileSelectDialogVisible"
      :can-select-file-type="['.pdf', '.doc', '.docx', '.zip', '.wps']"
      :allow-unparsed="false"
      :allow-folder-select="false"
      :single-select="fileSelectSingleMode"
      @confirm="handleManagerFileConfirm"
    />

    <!-- 分析进度弹框：以任务阶段步骤为准，不展示百分比进度条 -->
    <el-dialog
      v-model="progressDialogVisible"
      title="任务进度"
      width="560px"
      align-center
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      class="bidding-analysis-progress-dialog sd-dialog"
      @close="onProgressDialogClose"
    >
      <div class="bidding-analysis-progress-body">
        <div class="bidding-analysis-progress-header">
          <div class="bidding-analysis-progress-left">
            <span class="bidding-analysis-progress-title">{{ progressDialogTitleText }}</span>
            <span v-if="progressElapsedText" class="bidding-analysis-progress-elapsed">{{ progressElapsedText }}</span>
          </div>
          <el-tag size="small" type="primary" effect="plain">{{ progressStatusLabel }}</el-tag>
        </div>
        <div class="bidding-analysis-progress-steps">
          <div
            v-for="step in progressSteps"
            :key="step.key"
            :class="['bidding-analysis-progress-step', `is-${step.status}`]"
          >
            <div class="bidding-analysis-progress-step-left">
              <el-icon v-if="step.status === 'done'" class="bidding-analysis-progress-step-icon"><CircleCheck /></el-icon>
              <el-icon v-else-if="step.status === 'failed'" class="bidding-analysis-progress-step-icon is-failed"><CircleClose /></el-icon>
              <el-icon v-else-if="step.status === 'running'" class="bidding-analysis-progress-step-icon is-loading"><Loading /></el-icon>
              <el-icon v-else class="bidding-analysis-progress-step-icon is-muted"><Clock /></el-icon>
              <span>{{ step.label }}</span>
            </div>
            <el-tag size="small" effect="plain" :type="step.tagType">{{ step.tagText }}</el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="sd-dialog-footer">
          <el-button class="sd-dialog-btn-cancel" @click="closeProgressDialog">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Delete, Plus, ArrowUp, ArrowDown, Loading, CircleCheck, CircleClose, Clock } from '@element-plus/icons-vue'
import FileSelectDialog from '@/components/common/FileSelectDialog.vue'
import BiddingAnalysisResultView from './components/BiddingAnalysisResultView.vue'
import BiddingAnalysisResultProjectList from './components/BiddingAnalysisResultProjectList.vue'
import BiddingAnalysisRulePromptPanel from './components/BiddingAnalysisRulePromptPanel.vue'
import {
  createBiddingAnalysisAPI,
  extractBiddingProjectNameAPI,
  getBiddingAnalysisAPI,
  unwrapBiddingApiData,
} from '@/api/biddingAnalysis.js'
import { getTaskSchedulesAPI } from '@/api/task.js'
import { getPromptTreeByFunctionTypeNewAPI } from '@/api/IcssPlatform/promptManagement.js'
import { useBiddingAnalysisResults } from './composables/useBiddingAnalysisResults.js'
import {
  BIDDING_PROMPT_FUNCTION_TYPE,
  buildMergedTemplateFromPrompts,
  countBiddingPromptTemplates,
  getDefaultPromptIdForMode,
  getPromptOptionsForMode,
  getRuleNameById,
  resolveTemplateForMode,
} from './utils/biddingAnalysisPromptConfig.js'
import {
  createEmptyProject,
  createEmptyTenderCompany,
} from './mock/biddingAnalysisUploadMock.js'
import {
  ANALYSIS_MODES,
  BIDDING_RULE_META,
  TENDER_RULE_META,
  JOINT_RULE_META,
  DEFAULT_ANALYSIS_MODES,
  hasBiddingAnalysis,
  hasJointAnalysis,
  hasTenderAnalysis,
  needsBiddingFiles,
  needsTenderFiles,
  normalizeAnalysisModes,
} from './mock/biddingAnalysisTemplateMock.js'
import {
  buildBiddingAnalysisProgressPlan,
  mapBiddingProgressSteps,
} from './utils/biddingAnalysisProgress.js'

defineOptions({ name: 'BiddingAnalysis' })

const props = defineProps({
  /** 文件管理工具箱传入的预选文件 ID（原型预留） */
  files: { type: String, default: '' },
  names: { type: String, default: '' },
})

const modeOptions = ANALYSIS_MODES
const biddingRuleOptions = BIDDING_RULE_META
const tenderRuleOptions = TENDER_RULE_META
const jointRuleOptions = JOINT_RULE_META

let projectIdSeed = 1
let companyIdSeed = 1

const formatProjectLabel = (index) => {
  if (projects.value.length <= 1) return '项目'
  return `项目 ${index + 1}`
}

const fileSelectDialogVisible = ref(false)
const fileSelectContext = ref({
  type: 'bidding',
  projectId: null,
  companyId: null,
})

/**
 * 文件选择弹窗是否单选：招标仅 1 个文件，投标可多选
 * @returns {boolean} 招标文件为 true，投标文件为 false
 */
const fileSelectSingleMode = computed(() => fileSelectContext.value.type === 'bidding')

const normalizeProject = (item) => {
  let biddingFile = item.biddingFile ? { ...item.biddingFile } : null
  if (!biddingFile && item.biddingFiles?.length) {
    biddingFile = { ...item.biddingFiles[0] }
  }

  return {
    ...item,
    biddingFile,
    tenderCompanies: (item.tenderCompanies || []).map((company) => ({
      id: company.id,
      name: company.name,
      files: (company.files || []).map((file) => ({ ...file })),
    })),
  }
}

const projects = ref([normalizeProject(createEmptyProject(1, '1-1'))])

const toProjectCollapseId = (projectId) => String(projectId)

const expandedProjectIds = ref(projects.value.map((p) => toProjectCollapseId(p.id)))

const isProjectExpanded = (projectId) =>
  expandedProjectIds.value.includes(toProjectCollapseId(projectId))

const toggleProjectExpand = (projectId) => {
  const id = toProjectCollapseId(projectId)
  if (isProjectExpanded(projectId)) {
    expandedProjectIds.value = expandedProjectIds.value.filter((item) => item !== id)
  } else {
    expandedProjectIds.value = [...expandedProjectIds.value, id]
  }
}

const syncExpandedProjectIds = () => {
  const validIds = new Set(projects.value.map((p) => toProjectCollapseId(p.id)))
  expandedProjectIds.value = expandedProjectIds.value.filter((id) => validIds.has(id))
}

const expandAllProjects = () => {
  expandedProjectIds.value = projects.value.map((p) => toProjectCollapseId(p.id))
}

const collapseAllProjects = () => {
  expandedProjectIds.value = []
}

const getProjectTenderFileCount = (proj) =>
  proj.tenderCompanies.reduce((sum, company) => sum + company.files.length, 0)

const getProjectCollapseSummary = (proj) => {
  if (proj.name) return proj.name
  if (proj.biddingFile?.name) return proj.biddingFile.name
  const tenderCount = getProjectTenderFileCount(proj)
  if (tenderCount > 0) return `已配置 ${tenderCount} 份投标文件`
  return '未配置招标文件'
}

const analysisModes = ref([...DEFAULT_ANALYSIS_MODES])
const promptTreeItems = ref([])
const promptTreeLoaded = ref(false)
const modePromptIds = ref({
  bidding_only: null,
  tender_only: null,
  joint_only: null,
})

const analyzing = ref(false)
const analysisStarted = ref(false)
const progressDialogVisible = ref(false)
const progressElapsedSeconds = ref(0)
let progressElapsedTimer = null

const extractProjectNameForProject = async (projectId) => {
  const target = findProject(projectId)
  if (!target?.biddingFile?.documentId) return

  target.projectNameExtracting = true
  target.name = ''
  target.projectNameMeta = null
  try {
    const res = await extractBiddingProjectNameAPI({
      file_uuid: target.biddingFile.documentId,
      file_name: target.biddingFile.name || '',
    })
    const data = res?.data || res
    const projectName = String(data?.project_name || '').trim()
    target.name = projectName
    target.projectNameMeta = {
      confidence: data?.confidence || '',
      source: data?.source || '',
    }
    if (projectName) {
      ElMessage.success(`已识别项目名称：${projectName}`)
    } else {
      ElMessage.warning('未能识别项目名称，请稍后手动确认')
    }
  } catch (error) {
    target.name = ''
    target.projectNameMeta = null
    ElMessage.error(error?.message || '项目名称提取失败')
  } finally {
    target.projectNameExtracting = false
  }
}

/** 本次分析启动时冻结的模式列表，用于进度步骤展示 */
const analysisProgressModes = ref([])
const analysisTaskStepProgress = ref([])

const progressElapsedText = computed(() => {
  const total = progressElapsedSeconds.value
  const seconds = Math.floor(total)
  const tenths = Math.floor((total % 1) * 10)
  return `${seconds}.${tenths}s`
})

const stopAnalysisProgressTimers = () => {
  if (progressElapsedTimer) {
    clearInterval(progressElapsedTimer)
    progressElapsedTimer = null
  }
}

const analysisResults = ref([])
const currentAnalysisId = ref('')
const activeAnalysisId = ref('')
const analysisCompleted = ref(false)
const { loadOverview, projectCards, analysisDetail, loading: resultOverviewLoading } = useBiddingAnalysisResults()
const showResultView = ref(false)
const selectedResultProjectId = ref(null)
const modePromptPanelRefs = ref({})
const modePromptPayloads = ref({})
let skipTemplatePromptConfirm = false

const setModePanelRef = (mode, el) => {
  if (el) {
    modePromptPanelRefs.value[mode] = el
    return
  }
  const next = { ...modePromptPanelRefs.value }
  delete next[mode]
  modePromptPanelRefs.value = next
}

const getModePanel = (mode) => modePromptPanelRefs.value[mode]

const resultProjectList = computed(() => projectCards.value)

const resultAnalysisModes = computed(() => {
  const fromApi = analysisDetail.value?.analysis_modes
  if (Array.isArray(fromApi) && fromApi.length) return fromApi
  return normalizedAnalysisModes.value
})

const selectedResultProject = computed(() =>
  resultProjectList.value.find((item) => item.id === selectedResultProjectId.value) || null
)

const analysisDone = computed(
  () => analysisCompleted.value && !analyzing.value && !!activeAnalysisId.value
)

const normalizedAnalysisModes = computed(() => normalizeAnalysisModes(analysisModes.value))

const getModeLabel = (mode) => modeOptions.find((item) => item.value === mode)?.label || mode

const progressStepPlan = computed(() =>
  buildBiddingAnalysisProgressPlan(
    analysisProgressModes.value.length ? analysisProgressModes.value : normalizedAnalysisModes.value,
    getModeLabel
  )
)

const progressSteps = computed(() =>
  mapBiddingProgressSteps(progressStepPlan.value, analysisTaskStepProgress.value)
)

const progressStatusLabel = computed(() => {
  const steps = progressSteps.value || []
  if (steps.length && steps.every((step) => step.status === 'done')) return '已完成'
  if (steps.some((step) => step.status === 'failed')) return '失败'
  return '进行中'
})

const progressCurrentStepLabel = computed(() => {
  const steps = progressSteps.value || []
  if (steps.length && steps.every((step) => step.status === 'done')) return '分析完成'
  const running = steps.find((step) => step.status === 'running')
  if (running) return running.label
  const pending = steps.find((step) => step.status === 'pending')
  if (pending) return pending.label
  return '招投标分析'
})

const progressDialogTitleText = computed(() => {
  const status = progressStatusLabel.value
  if (status === '已完成') return `${progressCurrentStepLabel.value}`
  if (status === '失败') return `${progressCurrentStepLabel.value} 已失败`
  return `${progressCurrentStepLabel.value} 执行中...`
})

/** 仅关闭弹窗，不中止后台轮询；侧栏可点「查看进度」再打开 */
const closeProgressDialog = () => {
  progressDialogVisible.value = false
}

const onProgressDialogClose = () => {
  // v-model 已同步；保留钩子便于后续扩展（如埋点）
}

const getTemplateForMode = (mode) =>
  resolveTemplateForMode(promptTreeItems.value, mode, modePromptIds.value[mode])

const currentTemplate = computed(() =>
  buildMergedTemplateFromPrompts(
    normalizedAnalysisModes.value,
    modePromptIds.value,
    promptTreeItems.value
  )
)

const showBiddingRules = computed(() => hasBiddingAnalysis(normalizedAnalysisModes.value))
const showTenderRules = computed(() => hasTenderAnalysis(normalizedAnalysisModes.value))
const showJointRules = computed(() => hasJointAnalysis(normalizedAnalysisModes.value))

const scopeTipText = computed(() => {
  const modes = normalizedAnalysisModes.value
  if (!modes.length) return '请至少选择一种分析模式'
  const tips = []
  if (needsBiddingFiles(modes)) {
    tips.push('涉及招标侧分析的项目需上传招标文件')
  }
  if (needsTenderFiles(modes)) {
    tips.push('涉及投标侧分析的项目需配置投标单位与标书')
  }
  if (hasJointAnalysis(modes)) {
    tips.push('联合分析需在项目内同时有招标与投标文件')
  }
  return tips.join('；')
})

const toggleAnalysisMode = (mode) => {
  const current = normalizeAnalysisModes(analysisModes.value)
  if (current.includes(mode)) {
    if (current.length <= 1) {
      ElMessage.warning('请至少选择一种分析模式')
      return
    }
    analysisModes.value = current.filter((item) => item !== mode)
    return
  }
  analysisModes.value = normalizeAnalysisModes([...current, mode])
}

const selectedBiddingRules = computed(() => currentTemplate.value?.biddingRules || [])
const selectedTenderRules = computed(() => currentTemplate.value?.tenderRules || [])
const selectedJointRules = computed(() => currentTemplate.value?.jointRules || [])

const getBiddingRuleName = (ruleId) =>
  getRuleNameById(ruleId, currentTemplate.value) ||
  biddingRuleOptions.find((r) => r.id === ruleId)?.name ||
  ruleId

const getTenderRuleName = (ruleId) =>
  getRuleNameById(ruleId, currentTemplate.value) ||
  tenderRuleOptions.find((r) => r.id === ruleId)?.name ||
  ruleId

const getJointRuleName = (ruleId) =>
  getRuleNameById(ruleId, currentTemplate.value) ||
  jointRuleOptions.find((r) => r.id === ruleId)?.name ||
  ruleId

const getTenderCompaniesWithFiles = (item) =>
  item.tenderCompanies.filter((company) => company.files.length > 0)

const hasBiddingFile = (item) => !!item.biddingFile

const projectHasAnyFiles = (item) =>
  hasBiddingFile(item) || item.tenderCompanies.some((company) => company.files.length > 0)

const getFilesNotReadyReason = (item) => {
  const modes = normalizedAnalysisModes.value
  if (!modes.length) return '请至少选择一种分析模式'
  if (needsBiddingFiles(modes) && !hasBiddingFile(item)) return '请先上传招标文件'
  if (needsTenderFiles(modes) && !getTenderCompaniesWithFiles(item).length) {
    return '请为至少 1 个投标单位上传投标文件'
  }
  return null
}

const readyProjects = computed(() =>
  projects.value.filter((item) => projectFilesReady(item))
)

const configuredProjects = computed(() =>
  projects.value.filter((item) => item.biddingFile)
)

const projectCountLabel = computed(() => `${projects.value.length} 个项目`)

const biddingFileScopeLabel = computed(() => {
  const count = projects.value.filter((p) => p.biddingFile).length
  return `${count} 个招标文件`
})

const totalTenderCompanyCount = computed(() =>
  projects.value.reduce((sum, p) => sum + p.tenderCompanies.length, 0)
)

const totalTenderFileCount = computed(() =>
  projects.value.reduce(
    (sum, p) => sum + p.tenderCompanies.reduce((cSum, c) => cSum + c.files.length, 0),
    0
  )
)

const projectFilesReady = (item) => !getFilesNotReadyReason(item)

const filesReady = computed(() => {
  if (!readyProjects.value.length) return false
  const touched = projects.value.filter(projectHasAnyFiles)
  return touched.every((item) => projectFilesReady(item))
})

const getBatchBlockedReason = () => {
  if (!normalizedAnalysisModes.value.length) return '请至少选择一种分析模式'
  const touched = projects.value.filter(projectHasAnyFiles)
  if (!touched.length) {
    if (needsBiddingFiles(normalizedAnalysisModes.value) && !needsTenderFiles(normalizedAnalysisModes.value)) {
      return '请至少为 1 个项目上传招标文件'
    }
    if (needsTenderFiles(normalizedAnalysisModes.value) && !needsBiddingFiles(normalizedAnalysisModes.value)) {
      return '请至少为 1 个项目配置投标文件'
    }
    return '请至少完成 1 个项目的文件配置'
  }
  const incomplete = touched.find((item) => !projectFilesReady(item))
  if (incomplete) {
    const reason = getFilesNotReadyReason(incomplete)
    const projIndex = projects.value.findIndex((p) => p.id === incomplete.id) + 1
    const projLabel = incomplete.name || formatProjectLabel(projIndex - 1)
    return `「${projLabel}」：${reason || '文件配置未完成'}`
  }
  return ''
}

const rulesReady = computed(
  () =>
    normalizedAnalysisModes.value.length > 0 &&
    normalizedAnalysisModes.value.every((mode) => !!getTemplateForMode(mode))
)

const canStartAnalysis = computed(() => {
  return normalizedAnalysisModes.value.length > 0 && filesReady.value && rulesReady.value && !analyzing.value
})

const sidebarPrimaryLabel = computed(() => {
  if (analyzing.value) return '查看进度'
  if (analysisDone.value) return '查看结果'
  return '开始分析'
})

const sidebarPrimaryDisabled = computed(() => {
  if (analyzing.value) return false
  if (analysisDone.value) return false
  return !canStartAnalysis.value
})

const startBlockedReason = computed(() => {
  if (analysisDone.value || analyzing.value) return ''
  const batchReason = getBatchBlockedReason()
  if (batchReason) return batchReason
  if (!rulesReady.value) return '请选择分析模板'
  return ''
})

const handleModePromptChange = (mode, payload) => {
  modePromptPayloads.value = {
    ...modePromptPayloads.value,
    [mode]: payload || {},
  }
  resetAnalysisState()
}

const resetAllPromptPanels = (modes = normalizedAnalysisModes.value) => {
  modes.forEach((mode) => getModePanel(mode)?.resetPromptState?.())
}

const confirmRulePromptReset = async (message, targetMode = null) => {
  const panels = targetMode
    ? [getModePanel(targetMode)].filter(Boolean)
    : normalizedAnalysisModes.value.map((mode) => getModePanel(mode)).filter(Boolean)

  const hasCustomization = panels.some((panel) => panel?.hasPromptCustomization?.())
  if (!hasCustomization) {
    if (targetMode) {
      getModePanel(targetMode)?.resetPromptState?.()
    } else {
      resetAllPromptPanels()
    }
    return true
  }
  try {
    await ElMessageBox.confirm(message, '提示', {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning',
    })
    if (targetMode) {
      getModePanel(targetMode)?.resetPromptState?.()
    } else {
      resetAllPromptPanels()
    }
    return true
  } catch {
    return false
  }
}

watch(analysisModes, async (modes, oldModes) => {
  if (oldModes === undefined) return
  const normalized = normalizeAnalysisModes(modes)
  if (!normalized.length) {
    analysisModes.value = [...oldModes]
    ElMessage.warning('请至少选择一种分析模式')
    return
  }
  if (
    normalized.length === normalizeAnalysisModes(oldModes).length &&
    normalized.every((item, index) => item === normalizeAnalysisModes(oldModes)[index])
  ) {
    return
  }
  const ok = await confirmRulePromptReset('切换分析模式将丢失未保存的提示词修改，是否继续？')
  if (!ok) {
    analysisModes.value = [...oldModes]
    return
  }
  analysisStarted.value = false
  analysisResults.value = []
  resetAllPromptPanels()
  skipTemplatePromptConfirm = true
  nextTick(() => {
    skipTemplatePromptConfirm = false
  })
})

watch(
  modePromptIds,
  async (newVal, oldVal) => {
    if (!oldVal) return
    const changedMode = normalizedAnalysisModes.value.find(
      (mode) => newVal[mode] !== oldVal[mode]
    )
    if (!changedMode) return
    if (skipTemplatePromptConfirm) {
      getModePanel(changedMode)?.resetPromptState?.()
      resetAnalysisState()
      return
    }
    const ok = await confirmRulePromptReset(
      '切换模板将丢失未保存的提示词修改，是否继续？',
      changedMode
    )
    if (!ok) {
      modePromptIds.value[changedMode] = oldVal[changedMode]
      return
    }
    getModePanel(changedMode)?.resetPromptState?.()
    resetAnalysisState()
  },
  { deep: true }
)

const initModePromptDefaults = () => {
  DEFAULT_ANALYSIS_MODES.forEach((mode) => {
    const defaultId = getDefaultPromptIdForMode(promptTreeItems.value, mode)
    if (defaultId != null) {
      modePromptIds.value[mode] = defaultId
    }
  })
}

const loadPromptTree = async () => {
  try {
    const res = await getPromptTreeByFunctionTypeNewAPI(BIDDING_PROMPT_FUNCTION_TYPE)
    const data = res?.data || {}
    promptTreeItems.value = Array.isArray(data.items) ? data.items : []
    initModePromptDefaults()

    const templateCount = countBiddingPromptTemplates(promptTreeItems.value)
    if (!templateCount) {
      console.warn(
        '[招投标分析] 提示词树为空，functionType=%s，请确认已执行 bidding_analysis_prompt_seed 预置脚本',
        BIDDING_PROMPT_FUNCTION_TYPE
      )
      ElMessage.warning('未加载到招投标分析提示词，请先在提示词管理中配置（所属功能：招投标分析）')
    }
  } catch (error) {
    console.error('[招投标分析] 获取提示词树失败:', error)
    promptTreeItems.value = []
    ElMessage.error('加载提示词列表失败，请稍后重试')
  } finally {
    promptTreeLoaded.value = true
  }
}

onMounted(() => {
  loadPromptTree()
})

const findProject = (projectId) => projects.value.find((p) => p.id === projectId)

const resetAnalysisState = () => {
  analysisStarted.value = false
  analysisCompleted.value = false
  analysisFinishHandled = false
  analysisResults.value = []
  currentAnalysisId.value = ''
  activeAnalysisId.value = ''
  projectCards.value = []
  analysisDetail.value = null
  showResultView.value = false
  selectedResultProjectId.value = null
  stopAnalysisPollTimer()
}

const openBiddingFileSelect = (projectId) => {
  fileSelectContext.value = {
    type: 'bidding',
    projectId,
    companyId: null,
  }
  fileSelectDialogVisible.value = true
}

const openTenderFileSelect = (projectId, companyId) => {
  fileSelectContext.value = {
    type: 'tender',
    projectId,
    companyId,
  }
  fileSelectDialogVisible.value = true
}

const setBiddingFile = (projectId, files) => {
  const target = findProject(projectId)
  if (!target || !files?.length) return 0

  const file = files[0]
  const docId = file.file_id
  const name = file.file_name || ''
  if (!docId && !name) return 0

  target.biddingFile = {
    uid: docId || `bidding-${Date.now()}`,
    name,
    documentId: docId || undefined,
    size: null,
  }
  return 1
}

const appendTenderFiles = (projectId, companyId, files) => {
  const target = findProject(projectId)
  if (!target) return 0
  const company = target.tenderCompanies.find((item) => item.id === companyId)
  if (!company) return 0

  const existingIds = new Set(
    company.files.filter((file) => file.documentId).map((file) => file.documentId)
  )
  const newItems = []

  files.forEach((file) => {
    const docId = file.file_id
    const name = file.file_name || ''
    if (!docId || existingIds.has(docId)) return
    existingIds.add(docId)
    newItems.push({
      uid: docId,
      name,
      documentId: docId,
      size: null,
    })
  })

  if (!newItems.length) return 0
  company.files.push(...newItems)
  return newItems.length
}

const handleManagerFileConfirm = async (files) => {
  if (!files || files.length === 0) {
    fileSelectDialogVisible.value = false
    return
  }

  const ctx = fileSelectContext.value
  let added = 0
  if (ctx.type === 'bidding') {
    added = setBiddingFile(ctx.projectId, files)
    fileSelectDialogVisible.value = false
    if (added > 0) {
      resetAnalysisState()
      const target = findProject(ctx.projectId)
      if (target) {
        target.name = ''
        target.projectNameMeta = null
        target.projectNameExtracting = false
      }
      await extractProjectNameForProject(ctx.projectId)
    } else {
      ElMessage.info('未能更新招标文件')
    }
    return
  } else if (ctx.type === 'tender') {
    added = appendTenderFiles(ctx.projectId, ctx.companyId, files)
    if (added === 0) {
      ElMessage.info('没有新增文件')
    } else {
      resetAnalysisState()
      ElMessage.success(`已添加 ${added} 个文件`)
    }
  }

  fileSelectDialogVisible.value = false
}

const removeBiddingFile = (projectId) => {
  const target = findProject(projectId)
  if (!target) return
  target.biddingFile = null
  target.name = ''
  target.projectNameMeta = null
  target.projectNameExtracting = false
  resetAnalysisState()
}

const addProject = () => {
  projectIdSeed += 1
  companyIdSeed += 1
  const id = projectIdSeed
  projects.value.push(normalizeProject(createEmptyProject(id, `${id}-${companyIdSeed}`)))
  expandedProjectIds.value = [...expandedProjectIds.value, toProjectCollapseId(id)]
}

const removeProject = async (projectId) => {
  if (projects.value.length <= 1) {
    ElMessage.warning('至少保留 1 个项目')
    return
  }
  const target = findProject(projectId)
  if (!target) return
  try {
    await ElMessageBox.confirm(
      `确定删除「${formatProjectLabel(projects.value.findIndex((p) => p.id === projectId))}」及其招标文件、投标文件配置？`,
      '删除项目',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }
  projects.value = projects.value.filter((p) => p.id !== projectId)
  syncExpandedProjectIds()
  resetAnalysisState()
  ElMessage.success('已删除项目')
}

const removeTenderFile = (projectId, companyId, uid) => {
  const project = findProject(projectId)
  if (!project) return
  const company = project.tenderCompanies.find((c) => c.id === companyId)
  if (!company) return
  company.files = company.files.filter((f) => f.uid !== uid)
  resetAnalysisState()
}

const addCompany = (projectId) => {
  const target = findProject(projectId)
  if (!target) return
  companyIdSeed += 1
  target.tenderCompanies.push(createEmptyTenderCompany(projectId, `${projectId}-${companyIdSeed}`))
}

const removeCompany = (projectId, companyId) => {
  const target = findProject(projectId)
  if (!target) return
  target.tenderCompanies = target.tenderCompanies.filter((c) => c.id !== companyId)
}

const buildMockResults = () => {
  const rows = []
  projects.value.forEach((projectItem) => {
    const biddingFileName = projectItem.biddingFile?.name || '招标文件'
    if (showBiddingRules.value && projectItem.biddingFile) {
      selectedBiddingRules.value.forEach((ruleId) => {
        const rule = biddingRuleOptions.find((r) => r.id === ruleId)
        rows.push({
          projectId: projectItem.id,
          projectName: projectItem.name,
          company: '—',
          rule: rule ? rule.name : ruleId,
          result: Math.random() > 0.3 ? '通过' : '待复核',
          resultType: Math.random() > 0.3 ? 'success' : 'warning',
          detail: `${projectItem.name} 招标文件相关条款检查完成（原型演示）`,
        })
      })
    }
    if (showTenderRules.value) {
      projectItem.tenderCompanies.forEach((company) => {
        if (!company.files.length) return
        selectedTenderRules.value.forEach((ruleId) => {
          const rule = tenderRuleOptions.find((r) => r.id === ruleId)
          rows.push({
            projectId: projectItem.id,
            projectName: projectItem.name,
            company: company.name,
            rule: rule ? rule.name : ruleId,
            result: Math.random() > 0.4 ? '通过' : '异常',
            resultType: Math.random() > 0.4 ? 'success' : 'danger',
            detail: `${projectItem.name} / ${company.name} 投标文件分析结果（原型演示）`,
          })
        })
      })
    }
    if (showJointRules.value && projectItem.biddingFile) {
      projectItem.tenderCompanies.forEach((company) => {
        if (!company.files.length) return
        selectedJointRules.value.forEach((ruleId) => {
          const rule = jointRuleOptions.find((r) => r.id === ruleId)
          rows.push({
            projectId: projectItem.id,
            projectName: projectItem.name,
            company: company.name,
            rule: rule ? rule.name : ruleId,
            result: Math.random() > 0.5 ? '通过' : '应废未废',
            resultType: Math.random() > 0.5 ? 'success' : 'danger',
            detail: `${projectItem.name} / ${company.name} 与「${biddingFileName}」联合分析结果（原型演示）`,
          })
        })
      })
    }
  })
  return rows
}

const buildCreatePayload = () => {
  const modes = normalizedAnalysisModes.value

  const modeConfigs = modes.map((mode) => {
    const template = resolveTemplateForMode(promptTreeItems.value, mode, modePromptIds.value[mode])
    const promptPayload =
      getModePanel(mode)?.buildPayload?.() || modePromptPayloads.value[mode] || {}
    const ruleIds =
      mode === 'bidding_only'
        ? template?.biddingRules || []
        : mode === 'tender_only'
          ? template?.tenderRules || []
          : template?.jointRules || []

    return {
      mode,
      template_id: template?.id || '',
      prompt_id: template?.promptId != null ? String(template.promptId) : null,
      prompt_text: promptPayload.promptText || template?.defaultPrompt || '',
      prompt_customized: !!promptPayload.customized,
      rule_ids: ruleIds,
    }
  })

  const projectPayload = readyProjects.value.map((proj, index) => ({
    sort_order: index + 1,
    project_name: proj.name || '',
    bidding_file: proj.biddingFile?.documentId
      ? {
          file_uuid: proj.biddingFile.documentId,
          file_name: proj.biddingFile.name || '',
        }
      : null,
    tender_companies: proj.tenderCompanies
      .filter((company) => company.files.length)
      .map((company, companyIndex) => ({
        sort_order: companyIndex + 1,
        company_name: company.name,
        files: company.files
          .filter((file) => file.documentId)
          .map((file) => ({
            file_uuid: file.documentId,
            file_name: file.name || '',
          })),
      })),
  }))

  return {
    analysis_modes: modes,
    mode_configs: modeConfigs,
    projects: projectPayload,
  }
}

let analysisPollTimer = null
let analysisFinishHandled = false

const unwrapAnalysisDetail = unwrapBiddingApiData

const isAnalysisTerminal = (detail) => {
  if (!detail) return false
  const status = String(detail.status || '').toUpperCase()
  if (status === 'SUCCESS' || status === 'FAILED') return true
  const total = Number(detail.rule_total || 0)
  const done = Number(detail.rule_done || 0)
  return total > 0 && done >= total
}

const isAnalysisSuccess = (detail) => {
  if (!detail) return false
  const status = String(detail.status || '').toUpperCase()
  if (status === 'FAILED') return false
  if (status === 'SUCCESS') return true
  const total = Number(detail.rule_total || 0)
  const done = Number(detail.rule_done || 0)
  return total > 0 && done >= total
}

const enterResultViewAfterAnalysis = async () => {
  if (!activeAnalysisId.value) {
    ElMessage.error('分析任务 ID 缺失，无法展示结果')
    return
  }
  analysisCompleted.value = true
  analyzing.value = false
  progressDialogVisible.value = false
  selectedResultProjectId.value = null
  showResultView.value = true
  await loadOverview(activeAnalysisId.value)
  if (!projectCards.value.length) {
    ElMessage.warning('分析已完成，但暂未加载到项目结果，请稍后刷新重试')
  }
  await nextTick()
}

const stopAnalysisPollTimer = () => {
  if (analysisPollTimer) {
    clearInterval(analysisPollTimer)
    analysisPollTimer = null
  }
}

const handleAnalysisFinished = async (detail) => {
  if (analysisFinishHandled) return
  analysisFinishHandled = true
  stopAnalysisPollTimer()
  stopAnalysisProgressTimers()

  if (isAnalysisSuccess(detail)) {
    await enterResultViewAfterAnalysis()
    ElMessage.success('分析完成')
    return
  }

  analyzing.value = false
  progressDialogVisible.value = false
  analysisCompleted.value = false
  ElMessage.error(detail?.error_message || '分析失败')
}

const pollAnalysisStatus = async () => {
  if (!currentAnalysisId.value) return
  try {
    const [analysisRes, taskRes] = await Promise.all([
      getBiddingAnalysisAPI(currentAnalysisId.value),
      getTaskSchedulesAPI(currentAnalysisId.value, {
        prefer_runtime: true,
        include_task_steps: true,
      }).catch(() => null),
    ])
    const detail = unwrapAnalysisDetail(analysisRes)
    if (taskRes?.code === 200 && taskRes.data) {
      analysisTaskStepProgress.value = Array.isArray(taskRes.data.task_step_progress)
        ? taskRes.data.task_step_progress
        : []
    }
    if (isAnalysisTerminal(detail)) {
      await handleAnalysisFinished(detail)
    }
  } catch (error) {
    stopAnalysisPollTimer()
    stopAnalysisProgressTimers()
    analyzing.value = false
    progressDialogVisible.value = false
    analysisCompleted.value = false
    analysisFinishHandled = false
    ElMessage.error(error?.message || '查询分析进度失败')
  }
}

const startAnalysis = async () => {
  normalizedAnalysisModes.value.forEach((mode) => {
    const payload = getModePanel(mode)?.buildPayload?.()
    if (payload) {
      modePromptPayloads.value = {
        ...modePromptPayloads.value,
        [mode]: payload,
      }
    }
  })

  stopAnalysisProgressTimers()
  stopAnalysisPollTimer()
  analysisFinishHandled = false
  analyzing.value = true
  analysisStarted.value = true
  analysisCompleted.value = false
  analysisProgressModes.value = [...normalizedAnalysisModes.value]
  analysisTaskStepProgress.value = []
  progressElapsedSeconds.value = 0
  progressDialogVisible.value = true
  currentAnalysisId.value = ''

  progressElapsedTimer = setInterval(() => {
    progressElapsedSeconds.value += 0.1
  }, 100)

  try {
    const payload = buildCreatePayload()
    const res = await createBiddingAnalysisAPI(payload)
    const data = unwrapBiddingApiData(res)
    const analysisId = data?.analysis_id || data?.task_uuid || ''
    currentAnalysisId.value = analysisId
    activeAnalysisId.value = analysisId
    analysisPollTimer = setInterval(pollAnalysisStatus, 2000)
    pollAnalysisStatus()
  } catch (error) {
    stopAnalysisProgressTimers()
    analyzing.value = false
    analysisStarted.value = false
    progressDialogVisible.value = false
    ElMessage.error(error?.message || '创建分析任务失败')
  }
}

onBeforeUnmount(() => {
  stopAnalysisProgressTimers()
  stopAnalysisPollTimer()
})

const handleSidebarPrimaryClick = async () => {
  if (analyzing.value) {
    progressDialogVisible.value = true
    return
  }
  if (analysisDone.value) {
    await openResultView()
    return
  }
  if (!canStartAnalysis.value) {
    ElMessage.warning(startBlockedReason.value || '请完善文件与分析模板配置')
    return
  }
  startAnalysis()
}

const openResultView = async () => {
  if (!activeAnalysisId.value) return
  selectedResultProjectId.value = null
  await loadOverview(activeAnalysisId.value)
  if (!projectCards.value.length) {
    ElMessage.warning('暂无分析结果，请确认分析已完成')
  }
  showResultView.value = true
}

const openResultProjectDetail = (projectId) => {
  selectedResultProjectId.value = projectId
}

const closeResultView = () => {
  showResultView.value = false
  selectedResultProjectId.value = null
}

// 文件管理工具箱：每个文件名对应一个新项目（各 1 份招标文件）
if (props.names) {
  const presetNames = props.names.split(',').map((s) => s.trim()).filter(Boolean)
  if (presetNames.length) {
    projects.value = presetNames.map((name, index) => {
      const id = index + 1
      return normalizeProject({
        id,
        name: '',
        biddingFile: {
          uid: `preset-bidding-${id}`,
          name,
        },
        tenderCompanies: [createEmptyTenderCompany(id, `${id}-1`)],
      })
    })
    projectIdSeed = presetNames.length
    companyIdSeed = 1
    expandedProjectIds.value = projects.value.map((p) => toProjectCollapseId(p.id))
  }
}
</script>

<style scoped>
.bidding-analysis {
  position: relative;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-analysis-layout {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.bidding-analysis-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 380px;
  min-width: 320px;
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--sd-hairline, #e0e0e0);
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
}

.bidding-analysis-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  padding-bottom: 8px;
}

.bidding-analysis-sidebar-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  box-sizing: border-box;
  min-height: 56px;
}

.bidding-analysis-sidebar-footer-tip {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #e6a23c;
}

.bidding-analysis-sidebar-footer .el-button {
  width: 100%;
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
}

.bidding-analysis-sidebar-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-analysis-sidebar-title-row .bidding-analysis-sidebar-title {
  margin-bottom: 0;
}

.bidding-analysis-collapse-actions {
  display: flex;
  flex-shrink: 0;
}

.bidding-analysis-collapse-actions > * + * {
  margin-left: 4px;
}

.bidding-analysis-sidebar :deep(.el-button:not(.is-link)) {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  font-size: 13px;
  box-sizing: border-box;
}

.bidding-analysis-sidebar :deep(.el-button.is-link) {
  height: 32px;
  min-height: 32px;
  padding: 0 6px;
  font-size: 13px;
}

.bidding-analysis-icon-btn {
  flex-shrink: 0;
  width: 32px;
  min-width: 32px;
  padding: 0;
}

.bidding-analysis-collapse-actions :deep(.el-button) {
  height: 28px;
  min-height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

.bidding-analysis-project-block {
  margin-bottom: 10px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
  background: var(--sd-canvas, #ffffff);
}

.bidding-analysis-project-block.is-collapsed {
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-analysis-project-head {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.bidding-analysis-project-block.is-collapsed .bidding-analysis-project-head {
  border-bottom: none;
}

.bidding-analysis-project-head > * + * {
  margin-left: 8px;
}

.bidding-analysis-toggle-btn {
  flex-shrink: 0;
  padding: 4px;
  min-width: 28px;
  height: 28px;
}

.bidding-analysis-project-head-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.bidding-analysis-project-name-tag {
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bidding-analysis-project-name-loading {
  display: inline-flex;
  align-items: center;
  color: var(--sd-primary, #195fb4);
  font-size: inherit;
  font-weight: 500;
}

.bidding-analysis-project-name-loading > * + * {
  margin-left: 4px;
}

.bidding-analysis-project-list-name .bidding-analysis-project-name-loading {
  font-size: 13px;
}

.bidding-analysis-project-body {
  padding: 12px;
  --project-content-inset: 10px;
}

.bidding-analysis-project-body .bidding-analysis-field-label,
.bidding-analysis-project-body .bidding-analysis-field-body {
  padding-left: var(--project-content-inset);
  padding-right: var(--project-content-inset);
  box-sizing: border-box;
}

.bidding-analysis-company .bidding-analysis-company-title-row {
  padding-left: var(--project-content-inset);
  padding-right: var(--project-content-inset);
  box-sizing: border-box;
}

.bidding-analysis-section {
  margin-bottom: 12px;
}

.bidding-analysis-section:last-child {
  margin-bottom: 0;
}

.bidding-analysis-section-head {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
  line-height: 1.4;
}

.bidding-analysis-field {
  margin-bottom: 12px;
}

.bidding-analysis-field--last {
  margin-bottom: 0;
}

.bidding-analysis-field-label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--sd-ink-muted, #525252);
  line-height: 1.4;
}

.bidding-analysis-field-body {
  width: 100%;
  box-sizing: border-box;
}

.bidding-analysis-project-body :deep(.bidding-analysis-select-file-btn),
.bidding-analysis-project-body :deep(.bidding-analysis-add-company) {
  display: block;
  width: 100%;
  box-sizing: border-box;
}

.bidding-analysis-select-file-btn {
  width: 100%;
}

.bidding-analysis-sidebar :deep(.bidding-analysis-select-file-btn) {
  color: var(--sd-primary, #195fb4);
  border: 1px solid var(--sd-primary, #195fb4);
  background: var(--sd-canvas, #ffffff);
}

.bidding-analysis-sidebar :deep(.bidding-analysis-select-file-btn:hover),
.bidding-analysis-sidebar :deep(.bidding-analysis-select-file-btn:focus) {
  color: var(--sd-primary-dark, #0f4a8c);
  border-color: var(--sd-primary-dark, #0f4a8c);
  background: var(--sd-primary-light, #e8f0f8);
}

.bidding-analysis-company {
  padding: 12px 0;
  margin-bottom: 10px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  box-sizing: border-box;
}

.bidding-analysis-company-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--sd-hairline-soft, #ebebeb);
}

.bidding-analysis-company-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-ink, #161616);
  line-height: 1.4;
}

.bidding-analysis-collapse-delete {
  flex-shrink: 0;
}

.bidding-analysis-collapse-summary {
  margin-top: 2px;
  font-size: 12px;
  font-weight: normal;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bidding-analysis-progress-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.bidding-analysis-progress-body {
  padding-bottom: 4px;
}

.bidding-analysis-progress-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.bidding-analysis-progress-left {
  display: flex;
  flex-direction: column;
}

.bidding-analysis-progress-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.bidding-analysis-progress-elapsed {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.bidding-analysis-progress-steps > * + * {
  margin-top: 8px;
}

.bidding-analysis-progress-step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-analysis-progress-step.is-running {
  background: var(--sd-primary-light, #e8f0f8);
  border-color: var(--sd-hairline-soft, #ebebeb);
}

.bidding-analysis-progress-step.is-done {
  background: #f0f9eb;
  border-color: #e1f3d8;
}

.bidding-analysis-progress-step.is-failed {
  background: #fef0f0;
  border-color: #fde2e2;
}

.bidding-analysis-progress-step-left {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #606266;
}

.bidding-analysis-progress-step-left > * + * {
  margin-left: 8px;
}

.bidding-analysis-progress-step-icon {
  font-size: 16px;
  color: #67c23a;
}

.bidding-analysis-progress-step-icon.is-loading {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-progress-step-icon.is-muted {
  color: #c0c4cc;
}

.bidding-analysis-progress-step-icon.is-failed {
  color: #f56c6c;
}

.bidding-analysis-project-index {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.bidding-analysis-project-head-main > * + * {
  margin-top: 4px;
}

.bidding-analysis-project-list-item {
  display: flex;
  align-items: baseline;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.5;
  border-bottom: 1px solid var(--sd-hairline-soft, #ebebeb);
}

.bidding-analysis-project-list-item:last-child {
  border-bottom: none;
}

.bidding-analysis-project-list-item > * + * {
  margin-left: 8px;
}

.bidding-analysis-project-list-index {
  flex-shrink: 0;
  color: #909399;
}

.bidding-analysis-project-list-name {
  flex-shrink: 0;
  font-weight: 500;
  color: #303133;
}

.bidding-analysis-project-list-file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #909399;
  font-size: 12px;
}

.bidding-analysis-add-project {
  width: 100%;
  margin-bottom: 8px;
}

.bidding-analysis-bidding-actions {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.bidding-analysis-bidding-actions > * + * {
  margin-left: 8px;
}

.bidding-analysis-bidding-actions :deep(.el-button) {
  flex: 1;
}

.bidding-analysis-file-chip {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  font-size: 12px;
}

.bidding-analysis-file-chip--small {
  background: var(--sd-primary-light, #e8f0f8);
  border-color: var(--sd-hairline-soft, #ebebeb);
  margin-top: 6px;
}

.bidding-analysis-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
  margin-right: 4px;
}

.bidding-analysis-file-size {
  flex-shrink: 0;
  font-size: 11px;
  color: #909399;
  margin-right: 4px;
}

.bidding-analysis-add-company {
  margin-top: 4px;
}

.bidding-analysis-company-name {
  width: 100%;
}

.bidding-analysis-company-name :deep(.el-input) {
  width: 100%;
  display: block;
}

.bidding-analysis-company-name :deep(.el-input__wrapper) {
  min-height: 32px;
  box-sizing: border-box;
}

.bidding-analysis-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
}

.bidding-analysis-card {
  margin-bottom: 12px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  background: var(--sd-canvas, #ffffff);
}

.bidding-analysis-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
}

.bidding-analysis-card :deep(.el-card__body) {
  padding: 16px;
}

.bidding-analysis-card :deep(.el-form-item__label) {
  color: var(--sd-ink-muted, #525252);
  font-weight: 500;
}

.bidding-analysis-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.bidding-analysis-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.bidding-analysis-form :deep(.el-form-item__label) {
  height: 32px;
  line-height: 32px;
  padding-right: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--sd-ink-muted, #525252);
}

.bidding-analysis-form :deep(.el-form-item__content) {
  line-height: 32px;
  font-size: 13px;
}

.bidding-analysis-form-select {
  width: 100%;
  max-width: 480px;
}

.bidding-analysis-form :deep(.el-input__wrapper),
.bidding-analysis-form :deep(.el-select .el-input__wrapper) {
  min-height: 32px;
  box-sizing: border-box;
}

.bidding-analysis-form :deep(.el-tag) {
  height: 24px;
  line-height: 22px;
  font-size: 12px;
}

.bidding-analysis-project-list-summary {
  width: 100%;
  padding: 8px 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  box-sizing: border-box;
}

.bidding-analysis-card-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--sd-ink, #161616);
}

.bidding-analysis-scope-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.bidding-analysis-scope-summary > * + * {
  margin-left: 8px;
}

.bidding-analysis-scope-tip {
  font-size: 12px;
  color: #909399;
}

.bidding-analysis-mode-group {
  display: flex;
  flex-wrap: wrap;
}

.bidding-analysis-mode-group > * + * {
  margin-left: 24px;
}

.bidding-analysis-mode-item {
  display: inline-flex;
  align-items: center;
}

.bidding-analysis-mode-item > * + * {
  margin-left: 6px;
}

.bidding-analysis-mode-checkbox :deep(.el-checkbox__label) {
  display: none;
  padding: 0;
  width: 0;
}

.bidding-analysis-mode-name {
  padding: 0;
  border: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  color: #606266;
  cursor: pointer;
}

.bidding-analysis-mode-name:hover {
  color: var(--sd-primary, #195fb4);
}

.bidding-analysis-mode-name.is-selected {
  color: var(--sd-primary, #195fb4);
  font-weight: 600;
}

.bidding-analysis-mode-card + .bidding-analysis-mode-card {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--sd-hairline-soft, #ebebeb);
}

.bidding-analysis-prompt-empty-tip {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #e6a23c;
}

.bidding-analysis-merged-template-name {
  font-size: 13px;
  color: #303133;
}

.bidding-analysis-template-desc {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.bidding-analysis-template-rules {
  display: flex;
  flex-wrap: wrap;
}

.bidding-analysis-template-rules > * {
  margin-right: 8px;
  margin-bottom: 8px;
}
</style>
