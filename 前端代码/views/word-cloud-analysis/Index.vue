<template>
  <div class="word-cloud-page" v-loading="loading">
    <el-dialog
      v-model="taskUsedLexiconDialogVisible"
      title="本次分析使用的词表"
      width="720px"
      align-center
      append-to-body
      class="task-used-lexicon-dialog"
    >
      <p v-if="taskUsedLexiconEmpty" class="task-used-lexicon-empty">
        未记录本次分析用词（可能为改造前创建的任务，或创建时未勾选词表）。
      </p>
      <template v-else>
        <div class="task-used-lexicon-panels">
          <div class="task-used-lexicon-panel">
            <div class="task-used-lexicon-panel-title">停用词（{{ taskUsedLexiconStopWords.length }}）</div>
            <div class="task-used-lexicon-tags">
              <el-tag v-for="w in taskUsedLexiconStopWords" :key="'ts-' + w" size="small" type="info">{{ w }}</el-tag>
              <span v-if="!taskUsedLexiconStopWords.length" class="task-used-lexicon-none">无</span>
            </div>
          </div>
          <div class="task-used-lexicon-panel">
            <div class="task-used-lexicon-panel-title">用户新词（{{ taskUsedLexiconUserWords.length }}）</div>
            <div class="task-used-lexicon-tags">
              <el-tag v-for="w in taskUsedLexiconUserWords" :key="'tu-' + w" size="small" type="success">{{ w }}</el-tag>
              <span v-if="!taskUsedLexiconUserWords.length" class="task-used-lexicon-none">无</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="taskUsedLexiconDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dictConfigVisible"
      title="停用词与用户新词"
      width="1080px"
      align-center
      class="dict-config-dialog sd-dialog"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="dict-single-panel">
        <div class="dict-toolbar-row sd-toolbar-row sd-toolbar-row--medium">
          <el-select v-model="dictKindFilter" placeholder="类型" class="dict-kind-filter">
            <el-option label="全部" value="all" />
            <el-option label="停用词" value="stop" />
            <el-option label="用户新词" value="user" />
          </el-select>
          <el-input
            v-model="dictFilterDraft"
            class="dict-filter-input-inline"
            clearable
            placeholder="输入关键词后点查询（仅展示）"
            @clear="onDictFilterClear"
            @keyup.enter="applyDictFilter"
          />
          <el-button type="primary" @click="applyDictFilter">查询</el-button>
        </div>
        <p class="dict-lexicon-count-hint">
          <span>词库合计：停用词 {{ lexiconStopTotal }} 条 · 新词 {{ lexiconUserTotal }} 条</span>
          <span class="dict-lexicon-count-hint-sep">｜</span>
          <span>当前列表：{{ lexiconTotal }} 条</span>
          <template v-if="dictFilterApplied">
            <span class="dict-lexicon-count-hint-sep">｜</span>
            <span>关键词：{{ dictFilterApplied }}</span>
          </template>
        </p>
        <div class="sd-panel-actions dict-actions-toolbar">
          <div class="sd-panel-actions__left">
            <el-button type="primary" size="small" @click="openAddLexiconDialog">添加词条</el-button>
          </div>
          <div class="sd-panel-actions__right">
            <el-button
              size="small"
              :loading="lexiconImporting"
              :disabled="lexiconImporting"
              @click="triggerLexiconImport('stop')"
            >
              导入为停用词
            </el-button>
            <el-button
              size="small"
              :loading="lexiconImporting"
              :disabled="lexiconImporting"
              @click="triggerLexiconImport('user')"
            >
              导入为新词
            </el-button>
          </div>
        </div>
        <input
          ref="lexiconFileInputRef"
          type="file"
          accept=".txt,text/plain"
          class="dict-file-input"
          @change="onLexiconImportFile"
        />
        <div class="dict-table-wrap" v-loading="lexiconTableLoading">
          <el-table
            :data="lexiconRows"
            border
            stripe
            size="small"
            class="sd-table--clean dict-table"
            height="400"
          >
          <el-table-column label="#" width="56">
            <template #default="{ $index }">
              {{ (lexiconPage - 1) * lexiconPageSize + $index + 1 }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <span>{{ kindLabel(row.kind) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="word" label="词" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <div class="sd-table-op-cell">
                <el-button type="primary" size="small" class="sd-table-op-btn" @click="openEditWord(row)">编辑</el-button>
                <el-button type="danger" plain size="small" class="sd-table-op-btn" @click="removeLexiconRow(row.id)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        </div>
        <div class="sd-table-pagination dict-pagination-row">
          <el-pagination
            v-model:current-page="lexiconPage"
            v-model:page-size="lexiconPageSize"
            :total="lexiconTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            small
            @current-change="onLexiconPageOrSizeChange"
            @size-change="onLexiconPageSizeChange"
          />
        </div>
      </div>
      <template #footer>
        <div class="sd-dialog-footer">
          <el-button class="sd-dialog-btn-cancel" @click="dictConfigVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="lexiconImportReviewVisible"
      title="导入确认"
      width="680px"
      append-to-body
      class="lexicon-import-review-dialog"
      :close-on-click-modal="false"
      @closed="onLexiconImportReviewClosed"
    >
      <p v-if="importReviewWillAddCount > 0" class="lexicon-review-summary">
        另有 <strong>{{ importReviewWillAddCount }}</strong> 行将直接导入。
      </p>
      <p class="lexicon-review-hint">
        下列行与当前词表冲突或重复；<strong>相背</strong>（与另一类列表冲突）优先列出。「覆盖」会按你的选择更新词表；「忽略」则跳过该行。
      </p>
      <div v-if="importReviewIssueRows.length" class="lexicon-review-toolbar">
        <el-button size="small" type="primary" plain @click="importReviewIgnoreAll">忽略全部</el-button>
        <el-button size="small" @click="importReviewOverwriteAll">覆盖全部</el-button>
      </div>
      <el-table
        v-if="importReviewIssueRows.length"
        :data="importReviewIssueRows"
        border
        stripe
        size="small"
        class="sd-table--clean lexicon-review-table"
        max-height="360"
      >
        <el-table-column prop="line_no" label="行号" width="56" />
        <el-table-column prop="word" label="词条" min-width="100" show-overflow-tooltip />
        <el-table-column label="原因" min-width="128">
          <template #default="{ row }">
            <span>{{ importIssueLabel(row.issue) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="处理" width="72">
          <template #default="{ row }">
            <span>{{ importReviewDecisions[row.line_no] === 'overwrite' ? '覆盖' : '忽略' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="136" fixed="right">
          <template #default="{ row }">
            <div class="sd-table-op-cell">
              <el-button type="primary" plain size="small" class="sd-table-op-btn" @click="setImportLineDecision(row.line_no, 'ignore')">
                忽略
              </el-button>
              <el-button
                v-if="row.can_overwrite"
                type="primary"
                size="small"
                class="sd-table-op-btn"
                @click="setImportLineDecision(row.line_no, 'overwrite')"
              >
                覆盖
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="closeLexiconImportReview">取消</el-button>
        <el-button type="primary" :loading="lexiconImportDialogBusy" @click="confirmLexiconImportReview">
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="wordEditVisible" title="编辑词条" width="400px" append-to-body @closed="onWordEditClosed">
      <el-input v-model="wordEditValue" maxlength="64" show-word-limit />
      <template #footer>
        <el-button @click="wordEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="lexiconSaving" @click="confirmWordEdit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="lexiconAddVisible"
      title="添加词条"
      width="440px"
      append-to-body
      class="lexicon-add-dialog"
      :close-on-click-modal="false"
      @closed="onLexiconAddClosed"
    >
      <el-form label-width="72px" size="small" class="lexicon-add-form">
        <el-form-item label="类型">
          <el-select v-model="newLexiconKind" class="lexicon-add-kind-select">
            <el-option label="停用词" value="stop" />
            <el-option label="用户新词" value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="词条">
          <el-input
            v-model="newLexiconWord"
            maxlength="64"
            show-word-limit
            placeholder="请输入词条"
            @keyup.enter="confirmAddLexicon"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lexiconAddVisible = false">取消</el-button>
        <el-button type="primary" :loading="lexiconSaving" @click="confirmAddLexicon">确定</el-button>
      </template>
    </el-dialog>

    <el-empty v-if="!loading && loadError" :description="loadError" />
    <div v-else class="main-layout">
      <!-- 左侧栏 + 拖拽条 -->
      <div class="left-sidebar-group">
        <div
          class="left-sidebar-shell word-cloud-left-sidebar resizable-left-sidebar"
          :style="{ width: leftSidebarWidth + 'px' }"
        >
          <OcrLeftSidebar
            v-if="isTaskDetailMode"
            :bindings="taskPreviewSidebarBindings"
            mode="preview"
            :task-id="props.taskId"
            :readonly="true"
            :allow-mode-switch="false"
            :show-preview-toggle="true"
            :allow-folder-click-in-preview="true"
            compact-file-header
            layout-mode="full"
            empty-description="暂无任务文件"
          />
          <OcrLeftSidebar
            v-else
            :bindings="leftSidebarBindings"
            layout-mode="tree-select"
            mode="edit"
            :readonly="false"
            :allow-mode-switch="false"
            compact-file-header
            empty-description="暂无文件，请点击「选择文件」添加"
          >
            <template #footer>
            <el-button
              type="primary"
              class="word-cloud-execute-btn ocr-footer-btn"
              :disabled="!canAnalyze"
              v-loading="isTasking"
              @click="openImmediateExecute"
            >
              执行
            </el-button>
            </template>
          </OcrLeftSidebar>
        </div>
        <div
          class="resizer resizer-left"
          @mousedown="startLeftSidebarResize"
          title="拖拽调整宽度"
        >
          <el-icon class="resize-icon">
            <DArrowRight />
          </el-icon>
        </div>
      </div>

      <!-- 中间：文件夹列表 / 单文件预览 -->
      <div v-show="showFilePreview || isFolderListPreviewMode" class="center-viewer">
        <OcrFolderPreviewPanel
          v-if="isFolderListPreviewMode"
          :folder-name="currentFolderPreviewName"
          :display-total="folderPreviewDisplayTotal"
          :deleted-file-count="pendingDeleteRecords.files.length"
          :deleted-folder-count="pendingDeleteRecords.folders.length"
          :files="currentFolderPreviewFiles"
          :loading="folderPreviewLoading"
          :is-remote="isCurrentFolderPreviewRemote"
          :total="folderPreviewTotal"
          :page-size="folderPreviewPageSize"
          :current-page="folderPreviewPage"
          :pending-delete-file-ids="pendingDeleteFileIds"
          :readonly="isTaskDetailMode"
          @page-change="handleFolderPreviewPageChange"
          @delete-selected="handleDeleteSelectedFolderPreviewFiles"
          @restore-file="handleRestoreFolderPreviewFile"
          @view-file="handleViewFolderPreviewFile"
        />
        <PreviewFile
          v-else
          ref="previewFileRef"
          :current-file="currentPreviewFile"
          :current-highlighted-field="null"
          @refresh="handleRefresh"
          @download="handleDownload"
        />
      </div>

      <!-- 可调整宽度的分隔线 -->
      <div
        v-show="showFilePreview || isFolderListPreviewMode"
        class="resizer"
        @mousedown="startResize"
        title="拖拽调整宽度"
      >
        <el-icon class="resize-icon">
          <DArrowLeft />
        </el-icon>
      </div>

      <!-- 右侧词频和词云区域 -->
      <div
        class="right-content"
        :class="{ 'right-content-fullwidth': !showFilePreview && !isFolderListPreviewMode }"
        :style="{ width: (showFilePreview || isFolderListPreviewMode) ? rightSidebarWidth + 'px' : '' }"
      >
        <div class="col col-mid" v-show="!showFilePreview && !isFolderListPreviewMode">
          <div class="file-title col-mid-title-second">词频</div>
          <el-input
            v-model="wordFilter"
            clearable
            placeholder="模糊筛选词（仅过滤展示）"
            size="small"
            class="filter-input"
          />
          <el-table ref="wordTableRef" :data="filteredTopWords" border height="100%" @row-click="onWordRowClick">
            <el-table-column prop="word" label="词">
              <template #default="{ row }">
                <span :class="{ 'word-active': activeWord === row.word }">{{ row.word }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="count" label="频次" width="72" />
            <el-table-column v-if="!isTaskDetailMode" label="操作" width="96" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click.stop="addWordToStopFromFreq(row.word)">
                  加入停用词
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="col col-right">
          <div class="file-title">词云</div>
          <div ref="chartRef" class="chart-box" />
        </div>
      </div>
    </div>

    <div class="page-bottom-toolbar">
      <div class="toolbar-lexicon-group">
        <template v-if="isTaskDetailMode">
          <span class="toolbar-dict-summary">
            本次分析：停用词 {{ taskUsedLexiconStopWords.length }} 条 · 新词 {{ taskUsedLexiconUserWords.length }} 条
          </span>
          <el-button type="primary" plain size="small" @click="taskUsedLexiconDialogVisible = true">
            查看本次用词
          </el-button>
        </template>
        <template v-else>
          <span class="toolbar-dict-summary">停用词 {{ lexiconStopTotal }} 条 · 新词 {{ lexiconUserTotal }} 条</span>
          <el-button type="primary" plain size="small" @click="dictConfigVisible = true">配置停用词与新词</el-button>
        </template>
      </div>
      <div class="toolbar-topn-group">
        <span class="toolbar-label">
          分词数量
          <el-tooltip
            class="box-item"
            effect="light"
            content="合并各文件词频、排除停用词后，按频次取前 N 个词展示"
            placement="top"
          >
            <el-icon><QuestionFilled /></el-icon>
          </el-tooltip>
        </span>
        <el-input-number
          v-model="topN"
          :min="10"
          :max="500"
          :step="10"
          size="small"
          :disabled="isTaskDetailMode"
        />
      </div>
    </div>
  </div>

  <!-- 立即执行（创建任务并轮询结果） -->
  <el-dialog
    v-model="immediateExecuteDialogVisible"
    title="立即执行"
    width="720px"
    :close-on-click-modal="false"
    class="immediate-execute-dialog"
  >
    <div class="immediate-execute-content" v-loading="executeLexiconLoading">
      <el-form :model="immediateExecuteForm" label-width="100px">
        <el-form-item label="任务名称" required>
          <el-input
            v-model="immediateExecuteForm.taskName"
            placeholder="请输入任务名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="任务备注">
          <el-input
            v-model="immediateExecuteForm.taskRemark"
            type="textarea"
            :rows="2"
            placeholder="请输入任务备注（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="停用词">
          <div class="execute-lexicon-field">
            <el-select
              v-model="immediateExecuteForm.selectedStopWords"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择本次分析使用的停用词"
              class="execute-lexicon-select"
            >
              <el-option v-for="w in executeStopWordOptions" :key="'stop-' + w" :label="w" :value="w" />
            </el-select>
            <div class="execute-lexicon-actions">
              <el-button link type="primary" size="small" @click="selectAllExecuteStopWords">全选</el-button>
              <el-button link type="primary" size="small" @click="clearExecuteStopWords">清空</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="用户新词">
          <div class="execute-lexicon-field">
            <el-select
              v-model="immediateExecuteForm.selectedUserWords"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="请选择本次分析使用的用户新词"
              class="execute-lexicon-select"
            >
              <el-option v-for="w in executeUserWordOptions" :key="'user-' + w" :label="w" :value="w" />
            </el-select>
            <div class="execute-lexicon-actions">
              <el-button link type="primary" size="small" @click="selectAllExecuteUserWords">全选</el-button>
              <el-button link type="primary" size="small" @click="clearExecuteUserWords">清空</el-button>
            </div>
          </div>
        </el-form-item>
        <p class="execute-lexicon-hint">
          词表为全员共享；已选停用词 {{ immediateExecuteForm.selectedStopWords.length }} 条、用户新词
          {{ immediateExecuteForm.selectedUserWords.length }} 条参与本次分析。
        </p>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleImmediateExecuteCancel">取消</el-button>
        <el-button type="primary" :loading="taskCreating" @click="handleImmediateExecuteConfirm">
          创建任务并执行
        </el-button>
      </span>
    </template>
  </el-dialog>

  <!-- 任务进度弹框（仿合同完备性体验） -->
  <el-dialog
    v-model="progressDialogVisible"
    title="任务进度"
    width="640px"
    :close-on-click-modal="false"
    class="word-cloud-progress-dialog"
  >
    <div class="progress-dialog-body">
      <div class="progress-dialog-header">
        <div class="progress-dialog-left">
          <span class="progress-elapsed" v-if="loadingText">{{ loadingText }}</span>
        </div>
        <el-tag v-if="taskStatusLabel" :type="taskStatusTagType" size="small">{{ taskStatusLabel }}</el-tag>
      </div>
      <TaskRuntimeProgressTree :nodes="taskRuntimeNodes" />
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="progressDialogVisible = false">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHomeStore } from '@/stores/home'
import * as echarts from 'echarts'
import 'echarts-wordcloud'
import { ElMessage } from 'element-plus'
import { getFilesContentBatchAPI, previewFileAPI } from '@/api/fileManager.js'
import {
  getWordCloudLexiconAPI,
  getWordCloudLexiconWordListsAPI,
  getWordCloudTaskResultAPI,
  importWordCloudLexiconStopAPI,
  importWordCloudLexiconUserAPI,
  previewWordCloudLexiconStopAPI,
  previewWordCloudLexiconUserAPI,
  saveWordCloudLexiconAPI
} from '@/api/wordCloud.js'
import { getTaskSchedulesAPI } from '@/api/task.js'
import { buildTaskRuntimeNodesDisplay } from '@/composables/useScheduleTaskProgress.js'
import { batchExecuteByFilterAPI } from '@/api/task.js'
import { buildWordCloudBatchExecutePayload } from '@/views/file-manager-code/composables/buildWordCloudBatchExecutePayload.js'
import {
  openTaskCenterWithRefresh,
  runBatchExecuteWithTimeoutNav,
  isBatchExecuteRequestAborted
} from '@/views/file-manager-code/composables/batchExecuteTimeoutNav.js'
import TaskRuntimeProgressTree from '@/views/file-manager-code/components/contract/TaskRuntimeProgressTree.vue'
import PreviewFile from '@/views/file-manager-code/components/PreviewFile.vue'
import OcrFolderPreviewPanel from '@/views/file-manager-code/components/OcrFolderPreviewPanel.vue'
import OcrLeftSidebar from '@/views/file-manager-code/components/OcrLeftSidebar.vue'
import { useSimpleOcrLeftSidebar } from '@/views/file-manager-code/composables/useSimpleOcrLeftSidebar.js'
import { useOcrFolderPreview } from '@/views/file-manager-code/composables/useOcrFolderPreview.js'
import { useTaskCenterPreviewSidebar } from '@/views/file-manager-code/composables/useTaskCenterPreviewSidebar.js'
import { getFileIdentifier } from '@/views/file-manager-code/composables/ocrLeftSidebarTreeUtils.js'
import { DArrowLeft, DArrowRight, QuestionFilled } from '@element-plus/icons-vue'

defineOptions({ name: 'WordCloudAnalysis' })

// 定义 props，支持从父组件传递参数
const props = defineProps({
  files: {
    type: String,
    default: ''
  },
  names: {
    type: String,
    default: ''
  },
  taskId: {
    type: String,
    default: ''
  },
  isSecondaryExecution: {
    type: Boolean,
    default: false
  },
  eventKey: {
    type: String,
    default: ''
  },
  toolLabel: {
    type: String,
    default: '词云分析'
  },
  taskName: {
    type: String,
    default: ''
  }
})

const router = useRouter()
const route = useRoute()
const homeStore = useHomeStore()

/** 任务中心详情模式（左侧预览树，不可编辑） */
const isTaskDetailMode = computed(() => props.isSecondaryExecution && !!props.taskId)

const loading = ref(false)
const loadError = ref('')
const fileRows = ref([])
const topN = ref(50)

/** 停用词 / 用户新词：单表 kind 区分，提交时序列化为两数组 */
const dictConfigVisible = ref(false)
/** @type {import('vue').Ref<Array<{ id: string|number, word: string, source: string, kind: 'stop' | 'user' }>>} */
const lexiconRows = ref([])
const lexiconPage = ref(1)
const lexiconPageSize = ref(20)
const lexiconTotal = ref(0)
const lexiconStopTotal = ref(0)
const lexiconUserTotal = ref(0)
const lexiconTableLoading = ref(false)
/** 当前用户停用词集合（用于词频表操作列展示） */
const lexiconStopWordsSet = ref(new Set())
const dictKindFilter = ref('all')
/** 输入框内容；点击「查询」或回车后写入 dictFilterApplied 再筛表 */
const dictFilterDraft = ref('')
/** 已生效的展示筛选关键词 */
const dictFilterApplied = ref('')
const newLexiconKind = ref('stop')
const newLexiconWord = ref('')
const lexiconFileInputRef = ref(null)
const pendingImportKind = ref('stop')
const lexiconSaving = ref(false)
const lexiconImporting = ref(false)
const lexiconImportReviewVisible = ref(false)
const lexiconImportDialogBusy = ref(false)
const pendingImportFile = ref(null)
const importReviewLineDetails = ref([])
const importReviewDecisions = ref({})

const wordEditVisible = ref(false)
const lexiconAddVisible = ref(false)
const wordEditValue = ref('')
const wordEditContext = ref({ id: '', kind: 'stop' })

const importReviewIssueRows = computed(() => {
  const rows = (importReviewLineDetails.value || []).filter((r) => r.issue)
  const order = { cross: 0, in_db: 1, file_repeat: 2 }
  return [...rows].sort((a, b) => (order[a.issue] ?? 9) - (order[b.issue] ?? 9))
})
const importReviewWillAddCount = computed(
  () => (importReviewLineDetails.value || []).filter((r) => !r.issue).length
)

function importIssueLabel(issue) {
  if (!issue) return '将导入'
  const kind = pendingImportKind.value
  if (issue === 'cross') return kind === 'stop' ? '与用户新词冲突' : '与停用词冲突'
  if (issue === 'in_db') return kind === 'stop' ? '已在停用词列表' : '已在用户新词列表'
  if (issue === 'file_repeat') return '文件内重复'
  return String(issue)
}

function mapLexiconRow(r) {
  return {
    id: r.id,
    word: r.word,
    kind: r.kind === 'user' ? 'user' : 'stop',
    source: r.source || 'manual'
  }
}

async function refreshLexiconStopWordsSet() {
  try {
    const res = await getWordCloudLexiconWordListsAPI()
    if (res.code === 200 && res.data) {
      lexiconStopWordsSet.value = new Set((res.data.stop_words || []).map((x) => String(x)))
    }
  } catch (e) {
    console.warn('[word-cloud] 刷新停用词集合失败', e)
  }
}

async function loadLexiconSummary() {
  try {
    const res = await getWordCloudLexiconAPI({ page: 1, page_size: 1 })
    if (res.code === 200 && res.data) {
      lexiconStopTotal.value = Number(res.data.stop_count) || 0
      lexiconUserTotal.value = Number(res.data.user_count) || 0
    }
  } catch (e) {
    console.warn('[word-cloud] 加载词表统计失败', e)
  }
}

async function loadLexiconPage(forcePage, retryAfterPageFix = false) {
  if (forcePage != null) lexiconPage.value = forcePage
  lexiconTableLoading.value = true
  try {
    const params = { page: lexiconPage.value, page_size: lexiconPageSize.value }
    const kw = (dictFilterApplied.value || '').trim()
    if (kw) params.keyword = kw
    const kf = dictKindFilter.value
    if (kf === 'stop' || kf === 'user') params.kind = kf
    const res = await getWordCloudLexiconAPI(params)
    if (res.code === 200 && res.data) {
      lexiconTotal.value = Number(res.data.total) || 0
      lexiconStopTotal.value = Number(res.data.stop_count) || 0
      lexiconUserTotal.value = Number(res.data.user_count) || 0
      const maxPage = Math.max(1, Math.ceil(lexiconTotal.value / lexiconPageSize.value) || 1)
      if (lexiconPage.value > maxPage && !retryAfterPageFix) {
        lexiconPage.value = maxPage
        return loadLexiconPage(undefined, true)
      }
      lexiconRows.value = (res.data.items || []).map(mapLexiconRow)
    }
  } catch (e) {
    console.warn('[word-cloud] 加载词表分页失败', e)
  } finally {
    lexiconTableLoading.value = false
  }
}

function onLexiconPageOrSizeChange() {
  loadLexiconPage()
}

function onLexiconPageSizeChange() {
  lexiconPage.value = 1
  loadLexiconPage(1)
}

async function fetchFullLexiconRows() {
  const fullRes = await getWordCloudLexiconAPI()
  if (fullRes.code !== 200 || !fullRes.data || !Array.isArray(fullRes.data.items)) {
    throw new Error(fullRes.message || '加载词表失败')
  }
  return fullRes.data.items.map(mapLexiconRow)
}

function kindLabel(kind) {
  return kind === 'user' ? '用户新词' : '停用词'
}

function applyDictFilter() {
  dictFilterApplied.value = (dictFilterDraft.value || '').trim()
  if (dictConfigVisible.value) loadLexiconPage(1)
}

function onDictFilterClear() {
  dictFilterDraft.value = ''
  dictFilterApplied.value = ''
  if (dictConfigVisible.value) loadLexiconPage(1)
}

function openAddLexiconDialog() {
  newLexiconWord.value = ''
  newLexiconKind.value = 'stop'
  lexiconAddVisible.value = true
}

function onLexiconAddClosed() {
  newLexiconWord.value = ''
}

async function confirmAddLexicon() {
  const w = (newLexiconWord.value || '').trim()
  const kind = newLexiconKind.value
  if (!w) {
    ElMessage.warning('请输入词')
    return
  }
  lexiconSaving.value = true
  try {
    const items = (await fetchFullLexiconRows()).map((r) => ({
      word: String(r.word || '').trim(),
      kind: r.kind,
      source: r.source || 'manual'
    }))
    const stopSet = new Set(items.filter((i) => i.kind === 'stop').map((i) => i.word))
    const userSet = new Set(items.filter((i) => i.kind === 'user').map((i) => i.word))
    if (kind === 'stop') {
      if (stopSet.has(w)) {
        ElMessage.warning('该词已在停用词列表中')
        return
      }
      if (userSet.has(w)) {
        ElMessage.warning('该词已在新词列表中，请先从新词列表删除')
        return
      }
    } else {
      if (userSet.has(w)) {
        ElMessage.warning('该词已在新词列表中')
        return
      }
      if (stopSet.has(w)) {
        ElMessage.warning('该词已在停用词列表中，请先从停用词列表删除')
        return
      }
    }
    items.push({ word: w, kind, source: 'manual' })
    const res = await saveWordCloudLexiconAPI({ items })
    if (res.code === 200) {
      ElMessage.success(res.message || '添加成功')
      lexiconAddVisible.value = false
      newLexiconWord.value = ''
      await loadLexiconSummary()
      await loadLexiconPage(1)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    lexiconSaving.value = false
  }
}

async function removeLexiconRow(id) {
  try {
    const rows = await fetchFullLexiconRows()
    const items = rows
      .filter((r) => String(r.id) !== String(id))
      .map((r) => ({
        word: String(r.word || '').trim(),
        kind: r.kind,
        source: r.source || 'manual'
      }))
    const res = await saveWordCloudLexiconAPI({ items })
    if (res.code === 200) {
      ElMessage.success('已删除')
      await loadLexiconSummary()
      await loadLexiconPage(lexiconPage.value)
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '删除失败')
  }
}

function openEditWord(row) {
  wordEditContext.value = { id: row.id, kind: row.kind }
  wordEditValue.value = row.word || ''
  wordEditVisible.value = true
}

function onWordEditClosed() {
  wordEditValue.value = ''
  wordEditContext.value = { id: '', kind: 'stop' }
}

async function confirmWordEdit() {
  const w = (wordEditValue.value || '').trim()
  if (!w) {
    ElMessage.warning('词不能为空')
    return
  }
  const { id, kind } = wordEditContext.value
  lexiconSaving.value = true
  try {
    const rows = await fetchFullLexiconRows()
    const otherWords =
      kind === 'stop'
        ? rows.filter((r) => r.kind === 'user').map((x) => String(x.word || '').trim())
        : rows.filter((r) => r.kind === 'stop').map((x) => String(x.word || '').trim())
    const sameKindWords = rows
      .filter((r) => r.kind === kind && String(r.id) !== String(id))
      .map((x) => String(x.word || '').trim())
    if (sameKindWords.includes(w)) {
      ElMessage.warning('该类型下已存在相同词')
      return
    }
    if (otherWords.includes(w)) {
      ElMessage.warning(
        kind === 'stop' ? '该词已在新词列表中，请先从新词列表删除' : '该词已在停用词列表中，请先从停用词列表删除'
      )
      return
    }
    const items = rows.map((r) => {
      const word = String(r.id) === String(id) ? w : String(r.word || '').trim()
      return {
        word,
        kind: r.kind,
        source: r.source || 'manual'
      }
    })
    const res = await saveWordCloudLexiconAPI({ items })
    if (res.code === 200) {
      ElMessage.success(res.message || '已保存')
      wordEditVisible.value = false
      await loadLexiconSummary()
      await loadLexiconPage(lexiconPage.value)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    lexiconSaving.value = false
  }
}

function triggerLexiconImport(kind) {
  pendingImportKind.value = kind
  lexiconFileInputRef.value && lexiconFileInputRef.value.click()
}

function initImportReviewDecisions(details) {
  const o = {}
  for (const r of details) {
    if (r.issue) {
      o[r.line_no] = 'ignore'
    }
  }
  importReviewDecisions.value = o
}

function setImportLineDecision(lineNo, action) {
  const row = importReviewIssueRows.value.find((r) => r.line_no === lineNo)
  if (!row) return
  if (action === 'overwrite' && !row.can_overwrite) return
  importReviewDecisions.value = { ...importReviewDecisions.value, [lineNo]: action }
}

function importReviewIgnoreAll() {
  const next = { ...importReviewDecisions.value }
  for (const r of importReviewIssueRows.value) {
    next[r.line_no] = 'ignore'
  }
  importReviewDecisions.value = next
}

function importReviewOverwriteAll() {
  const next = { ...importReviewDecisions.value }
  for (const r of importReviewIssueRows.value) {
    next[r.line_no] = r.can_overwrite ? 'overwrite' : 'ignore'
  }
  importReviewDecisions.value = next
}

async function doLexiconImportApply(file, kind, decisions) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('decisions', JSON.stringify(decisions || {}))
  const api = kind === 'stop' ? importWordCloudLexiconStopAPI : importWordCloudLexiconUserAPI
  const res = await api(fd)
  if (res.code === 200 && res.data && Array.isArray(res.data.items)) {
    await loadLexiconSummary()
    if (dictConfigVisible.value) await loadLexiconPage(1)
    const skipDup = Number(res.data.skip_dup) || 0
    const skipCross = Number(res.data.skip_cross) || 0
    const overwritten = Number(res.data.overwritten) || 0
    const parts = []
    if (overwritten) parts.push(`已覆盖 ${overwritten} 条`)
    if (skipDup) parts.push(`跳过重复 ${skipDup} 条`)
    if (skipCross) {
      parts.push(kind === 'stop' ? `跳过与新词冲突 ${skipCross} 条` : `跳过与停用词冲突 ${skipCross} 条`)
    }
    ElMessage.success(parts.length ? `导入完成（${parts.join('，')}）` : '导入完成')
  } else {
    ElMessage.error(res.message || '导入失败')
  }
}

function closeLexiconImportReview() {
  lexiconImportReviewVisible.value = false
}

function onLexiconImportReviewClosed() {
  pendingImportFile.value = null
  importReviewLineDetails.value = []
  importReviewDecisions.value = {}
}

async function confirmLexiconImportReview() {
  const file = pendingImportFile.value
  const kind = pendingImportKind.value
  if (!file) return
  lexiconImportDialogBusy.value = true
  try {
    await doLexiconImportApply(file, kind, importReviewDecisions.value)
    lexiconImportReviewVisible.value = false
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    lexiconImportDialogBusy.value = false
  }
}

async function onLexiconImportFile(ev) {
  const file = ev.target.files && ev.target.files[0]
  ev.target.value = ''
  if (!file) return
  const kind = pendingImportKind.value
  lexiconImporting.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const previewApi = kind === 'stop' ? previewWordCloudLexiconStopAPI : previewWordCloudLexiconUserAPI
    const prev = await previewApi(fd)
    if (prev.code !== 200 || !prev.data) {
      ElMessage.error(prev.message || '预检失败')
      return
    }
    const details = prev.data.line_details || []
    const hasIssue = details.some((d) => d.issue)
    if (!hasIssue) {
      await doLexiconImportApply(file, kind, {})
      return
    }
    pendingImportFile.value = file
    importReviewLineDetails.value = details
    initImportReviewDecisions(details)
    lexiconImportReviewVisible.value = true
  } catch (e) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    lexiconImporting.value = false
  }
}

async function addWordToStopFromFreq(word) {
  const w = String(word || '').trim()
  if (!w) return
  try {
    const wlRes = await getWordCloudLexiconWordListsAPI()
    if (wlRes.code !== 200 || !wlRes.data) {
      ElMessage.error(wlRes.message || '加载词表失败')
      return
    }
    const swList = wlRes.data.stop_words || []
    const uwList = wlRes.data.user_dict_words || []
    if (swList.includes(w)) {
      ElMessage.warning('该词已在停用词列表中')
      return
    }
    if (uwList.includes(w)) {
      ElMessage.warning('该词已在新词列表中，请先从新词列表删除')
      return
    }
    const rows = await fetchFullLexiconRows()
    const items = rows.map((r) => ({
      word: String(r.word || '').trim(),
      kind: r.kind,
      source: r.source || 'manual'
    }))
    items.push({ word: w, kind: 'stop', source: 'from_wordfreq' })
    const saveRes = await saveWordCloudLexiconAPI({ items })
    if (saveRes.code === 200) {
      ElMessage.success('已加入停用词，请重新执行分析后生效')
      await loadLexiconSummary()
      await refreshLexiconStopWordsSet()
      if (dictConfigVisible.value) await loadLexiconPage(lexiconPage.value)
    } else {
      ElMessage.error(saveRes.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

async function loadExecuteLexiconOptions() {
  executeLexiconLoading.value = true
  try {
    const res = await getWordCloudLexiconWordListsAPI()
    if (res.code !== 200 || !res.data) {
      throw new Error(res.message || '加载词表失败')
    }
    const stopWords = Array.isArray(res.data.stop_words) ? res.data.stop_words.map(String) : []
    const userWords = Array.isArray(res.data.user_dict_words) ? res.data.user_dict_words.map(String) : []
    executeStopWordOptions.value = stopWords
    executeUserWordOptions.value = userWords

    const prevStop = new Set(immediateExecuteForm.selectedStopWords || [])
    const prevUser = new Set(immediateExecuteForm.selectedUserWords || [])
    const hasPrev = prevStop.size > 0 || prevUser.size > 0
    immediateExecuteForm.selectedStopWords = hasPrev
      ? stopWords.filter((w) => prevStop.has(w))
      : [...stopWords]
    immediateExecuteForm.selectedUserWords = hasPrev
      ? userWords.filter((w) => prevUser.has(w))
      : [...userWords]
    return { stopWords, userWords }
  } finally {
    executeLexiconLoading.value = false
  }
}

function selectAllExecuteStopWords() {
  immediateExecuteForm.selectedStopWords = [...executeStopWordOptions.value]
}

function clearExecuteStopWords() {
  immediateExecuteForm.selectedStopWords = []
}

function selectAllExecuteUserWords() {
  immediateExecuteForm.selectedUserWords = [...executeUserWordOptions.value]
}

function clearExecuteUserWords() {
  immediateExecuteForm.selectedUserWords = []
}

function getSelectedWordListsForExecute() {
  return {
    stop_words: [...(immediateExecuteForm.selectedStopWords || [])],
    user_dict_words: [...(immediateExecuteForm.selectedUserWords || [])]
  }
}

const wordFilter = ref('')
const activeWord = ref('')
const wordTableRef = ref(null)
const chartRef = ref(null)
let chart = null

// 文件预览相关
const currentFile = ref(null)
const currentPreviewFile = ref(null)
const previewFileRef = ref(null)

const uploadedFiles = ref([])

const sidebarCore = useSimpleOcrLeftSidebar({
  files: uploadedFiles,
  canSelectFileType: ['.pdf', '.doc', '.docx'],
  toolLabel: props.toolLabel,
  isFileActive: (file) => {
    const fileId = getFileIdentifier(file)
    const currentId = currentFile.value ? String(currentFile.value.file_id || '') : ''
    return fileId && currentId && String(fileId) === currentId
  },
  onFileClick: async (sourceFile) => {
    await selectFileFromSidebar(sourceFile)
  }
})

const {
  leftSidebarBindings: sidebarBindingsBase,
  addFilesFromManager,
  getSidebarExecuteContext,
  hasExecuteTargets: canAnalyze,
  showFilePreview,
  allowUnparsed
} = sidebarCore

const folderPreview = useOcrFolderPreview({
  files: uploadedFiles,
  selectedFiles: sidebarBindingsBase.selectedFiles,
  allowUnparsed,
  fileExtensions: ['.pdf', '.doc', '.docx'],
  onViewFile: async (rowData) => {
    const sourceFile = rowData?.sourceFile || {
      file_id: rowData?.fileId,
      fileId: rowData?.fileId,
      name: rowData?.name,
      file_name: rowData?.name
    }
    clearFolderPreviewMode()
    showFilePreview.value = true
    await selectFileFromSidebar(sourceFile)
  },
  onClearPreview: () => {
    currentFile.value = null
    currentPreviewFile.value = null
  },
  isCurrentPreviewFileId: (fileId) => {
    const currentId = currentFile.value ? String(currentFile.value.file_id || '') : ''
    return currentId && String(fileId) === currentId
  }
})

const {
  pendingDeleteRecords,
  pendingDeleteFileIds,
  currentFolderPreviewName,
  currentFolderPreviewFiles,
  isFolderListPreviewMode,
  folderPreviewDisplayTotal,
  folderPreviewLoading,
  isCurrentFolderPreviewRemote,
  folderPreviewTotal,
  folderPreviewPageSize,
  folderPreviewPage,
  clearFolderPreviewMode,
  handleFolderPreviewPageChange,
  handleDeleteSelectedFolderPreviewFiles,
  handleRestoreFolderPreviewFile,
  handleViewFolderPreviewFile,
  handleFolderTreeNodeClick,
  isFilePendingDelete,
  buildDeletedFilesPayload
} = folderPreview

/**
 * 任务中心详情：预览侧栏树节点点击
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleTaskPreviewTreeNodeClick = async (treeNode, event) => {
  void event
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    currentFile.value = null
    currentPreviewFile.value = null
    showFilePreview.value = true
    await handleFolderTreeNodeClick(treeNode)
    return
  }
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = taskPreviewCore.resolveSourceFileFromTreeNode(treeNode)
  if (!sourceFile) {
    ElMessage.warning('文件信息不完整，无法预览')
    return
  }
  showFilePreview.value = true
  await selectFileFromSidebar({
    file_id: sourceFile.file_uuid || sourceFile.file_id || sourceFile.result_uuid,
    fileId: sourceFile.file_uuid || sourceFile.file_id || sourceFile.result_uuid,
    name: sourceFile.file_name || sourceFile.name,
    file_name: sourceFile.file_name || sourceFile.name,
    previewUrl: sourceFile.previewUrl || ''
  })
}

const taskPreviewCore = useTaskCenterPreviewSidebar({
  taskId: computed(() => props.taskId),
  taskName: computed(() => props.taskName || props.toolLabel),
  showFilePreview,
  isFileActive: (file) => {
    const fileId = getFileIdentifier(file) || file.file_uuid || file.file_id || file.result_uuid
    const currentId = currentFile.value ? String(currentFile.value.file_id || '') : ''
    return fileId && currentId && String(fileId) === String(currentId)
  },
  handleTreeNodeClick: handleTaskPreviewTreeNodeClick
})

const {
  taskPreviewSidebarBindings,
  loadTaskCenterPreviewSidebar
} = taskPreviewCore

/**
 * 侧栏树节点点击（文件夹列表 / 文件预览）
 * @param {Object} treeNode 树节点
 * @param {MouseEvent} [event] 点击事件
 * @returns {Promise<void>}
 */
const handleWordCloudTreeNodeClick = async (treeNode, event) => {
  if (!treeNode) return
  if (treeNode.nodeType === 'folder') {
    await handleFolderTreeNodeClick(treeNode)
    showFilePreview.value = true
    return
  }
  void event
  if (treeNode.nodeType !== 'file') return
  clearFolderPreviewMode()
  const sourceFile = treeNode.sourceFile
  if (!sourceFile) return
  await selectFileFromSidebar(sourceFile)
}

/**
 * 左侧公共树 bindings
 * @returns {Object} 侧栏绑定对象
 */
const leftSidebarBindings = computed(() => ({
  ...sidebarBindingsBase,
  handleTreeNodeClick: handleWordCloudTreeNodeClick,
  isFilePendingDelete
}))

/** 左侧边栏允许的最小、最大宽度（像素） */
const LEFT_SIDEBAR_WIDTH_MIN = 200
const LEFT_SIDEBAR_WIDTH_MAX = 560
const SIDEBAR_DEFAULT_WIDTH = 320
const LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH = 240

/**
 * 解析侧栏宽度 localStorage 值
 * @param {string|null|undefined} raw 原始存储值
 * @returns {number|null} 有效像素宽度
 */
const parseSidebarWidth = (raw) => {
  if (raw == null || raw === '') return null
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 夹紧左侧侧栏宽度
 * @param {number} width 目标宽度
 * @returns {number} 合法宽度
 */
const clampLeftSidebarWidth = (width) =>
  Math.min(LEFT_SIDEBAR_WIDTH_MAX, Math.max(LEFT_SIDEBAR_WIDTH_MIN, width))

const savedLeftWidth = parseSidebarWidth(localStorage.getItem('ocr-viewer-left-sidebar-width'))
const savedRightWidth = parseSidebarWidth(localStorage.getItem('word-cloud-viewer-sidebar-width'))
const rightSidebarWidth = ref(savedRightWidth ?? 600)
let resolvedLeftWidth = savedLeftWidth ?? SIDEBAR_DEFAULT_WIDTH
if (savedLeftWidth === LEFT_SIDEBAR_LEGACY_DEFAULT_WIDTH || savedLeftWidth === 280) {
  if (savedLeftWidth !== SIDEBAR_DEFAULT_WIDTH) {
    resolvedLeftWidth = SIDEBAR_DEFAULT_WIDTH
    localStorage.setItem('ocr-viewer-left-sidebar-width', String(resolvedLeftWidth))
  }
}
const leftSidebarWidth = ref(clampLeftSidebarWidth(resolvedLeftWidth))
const isResizingLeft = ref(false)
const leftResizeStartX = ref(0)
const leftResizeStartWidth = ref(0)

const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

// 文件选择对话框（由 OcrLeftSidebar 内置 FileSelectDialog 承载）
const taskUuid = ref('')
const taskCreating = ref(false)
const taskStatus = ref(null)
const taskRuntimeNodes = ref([])
const resultLoading = ref(false)
const lastResultLoadedTaskUuid = ref('')
let pollTimer = null
let loadingTimer = null
const loadingElapsedTime = ref(0)
const loadingText = ref('')

const immediateExecuteDialogVisible = ref(false)
const progressDialogVisible = ref(false)
const immediateExecuteForm = reactive({
  taskName: '',
  taskRemark: '',
  selectedStopWords: [],
  selectedUserWords: []
})
const executeLexiconLoading = ref(false)
const executeStopWordOptions = ref([])
const executeUserWordOptions = ref([])

/** 任务详情模式下使用创建任务时勾选的停用词（结果展示过滤） */
const taskLexiconStopWordsSet = ref(null)
const taskUsedLexiconStopWords = ref([])
const taskUsedLexiconUserWords = ref([])
const taskUsedLexiconDialogVisible = ref(false)

const taskUsedLexiconEmpty = computed(
  () => taskUsedLexiconStopWords.value.length === 0 && taskUsedLexiconUserWords.value.length === 0
)

const selectedFileIds = ref([])

const taskStatusLabel = computed(() => {
  if (taskStatus.value == null) return ''
  const s = Number(taskStatus.value)
  if (s === 0) return '未开始'
  if (s === 1) return '进行中'
  if (s === 2) return '已完成'
  if (s === 3) return '失败'
  return ''
})

const taskStatusTagType = computed(() => {
  const s = Number(taskStatus.value)
  if (s === 2) return 'success'
  if (s === 3) return 'danger'
  if (s === 1) return 'warning'
  return 'info'
})

const selectedFileIdSet = computed(() => new Set(selectedFileIds.value))
const hasSelectedFiles = computed(() => selectedFileIds.value.length > 0)

const mergeWordCounts = () => {
  const m = {}
  for (const row of fileRows.value) {
    if (hasSelectedFiles.value && !selectedFileIdSet.value.has(row.file_id)) continue
    if (!row.found || row.analyze_skipped) continue
    const wc = row.word_counts || {}
    for (const [w, c] of Object.entries(wc)) {
      m[w] = (m[w] || 0) + c
    }
  }
  return m
}

const mergedCounts = computed(() => mergeWordCounts())

const mergedUserDictHits = computed(() => {
  const s = new Set()
  for (const row of fileRows.value) {
    const h = row.user_dict_hits
    if (Array.isArray(h)) {
      for (const x of h) {
        if (x) s.add(String(x))
      }
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b))
})

const topWordPairs = computed(() => {
  const stopSet = taskLexiconStopWordsSet.value ?? lexiconStopWordsSet.value
  const entries = Object.entries(mergedCounts.value).filter(([w]) => !(stopSet && stopSet.has(w)))
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return entries.slice(0, topN.value)
})

const topWordsDisplay = computed(() =>
  topWordPairs.value.map(([word, count]) => ({ word, count }))
)

const filteredTopWords = computed(() => {
  const kw = (wordFilter.value || '').trim().toLowerCase()
  if (!kw) return topWordsDisplay.value
  return topWordsDisplay.value.filter((r) => r.word.toLowerCase().includes(kw))
})

const sortedFileRows = computed(() => {
  const rows = [...fileRows.value]
  if (!activeWord.value) return rows
  const w = activeWord.value
  rows.sort((a, b) => {
    const ca = a.word_counts && a.word_counts[w] != null ? a.word_counts[w] : 0
    const cb = b.word_counts && b.word_counts[w] != null ? b.word_counts[w] : 0
    if (cb !== ca) return cb - ca
    return (a.file_name || '').localeCompare(b.file_name || '')
  })
  return rows
})

function onWordRowClick(row) {
  activeWord.value = row.word === activeWord.value ? '' : row.word
  if (activeWord.value) {
    scrollToActiveWord()
  }
}

function goBack() {
  router.push({ name: 'FileManagerCode' })
}

/**
 * 从左侧树选中文件并打开预览
 * @param {Object} sourceFile 侧栏源文件对象
 * @returns {Promise<void>}
 */
async function selectFileFromSidebar(sourceFile) {
  if (!sourceFile) return
  const fileId = getFileIdentifier(sourceFile)
  if (!fileId) return
  const fileName = sourceFile.name || sourceFile.file_name || ''
  const existingRow = fileRows.value.find((row) => String(row.file_id) === String(fileId))
  if (existingRow) {
    await selectFileForPreview(existingRow)
    return
  }
  await selectFileForPreview({
    file_id: fileId,
    file_name: fileName,
    previewUrl: sourceFile.previewUrl || ''
  })
}

/**
 * 选择文件进行预览
 * @param {Object} row 文件行
 * @returns {Promise<void>}
 */
async function selectFileForPreview(row) {
  currentFile.value = row

  // 构造预览文件对象
  const fileName = row.file_name || ''
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''

  let fileType = 'text'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
    fileType = 'image'
  } else if (ext === 'pdf') {
    fileType = 'pdf'
  } else if (ext === 'docx') {
    fileType = 'docx'
  } else if (ext === 'doc') {
    fileType = 'doc'
  }

  // 如果文件有 fileId 但没有 previewUrl，先获取预览URL
  if (row.file_id && !row.previewUrl) {
    try {
      const previewRes = await previewFileAPI(row.file_id)
      if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
        row.previewUrl = previewRes.data.preview_url
      }
    } catch (e) {
      console.warn('获取预览URL失败:', e)
    }
  }

  currentPreviewFile.value = {
    id: row.file_id,
    name: row.file_name,
    file_name: row.file_name,
    type: fileType,
    fileId: row.file_id,
    previewUrl: row.previewUrl || ''
  }
}

function formatDateTimeForTaskName() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}`
}

// 右侧面板宽度调整
const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = rightSidebarWidth.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.classList.add('resizing')
}

const handleResize = (e) => {
  if (!isResizing.value) return

  const diff = startX.value - e.clientX
  const newWidth = startWidth.value + diff

  // 限制最小和最大宽度
  if (newWidth >= 400 && newWidth <= 1000) {
    rightSidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.classList.remove('resizing')
  // 保存宽度到本地存储
  localStorage.setItem('word-cloud-viewer-sidebar-width', String(rightSidebarWidth.value))
}

/**
 * 开始拖拽左侧分隔条以调整左侧面板宽度
 * @param {MouseEvent} e 鼠标按下事件
 */
const startLeftSidebarResize = (e) => {
  isResizingLeft.value = true
  leftResizeStartX.value = e.clientX
  leftResizeStartWidth.value = leftSidebarWidth.value
  document.addEventListener('mousemove', handleLeftSidebarResize)
  document.addEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.add('resizing')
  e.preventDefault()
}

/**
 * 拖拽过程中更新左侧面板宽度
 * @param {MouseEvent} e 鼠标移动事件
 */
const handleLeftSidebarResize = (e) => {
  if (!isResizingLeft.value) return
  const diff = e.clientX - leftResizeStartX.value
  const newWidth = leftResizeStartWidth.value + diff
  if (newWidth >= LEFT_SIDEBAR_WIDTH_MIN && newWidth <= LEFT_SIDEBAR_WIDTH_MAX) {
    leftSidebarWidth.value = newWidth
  }
}

/**
 * 结束左侧宽度拖拽并持久化
 */
const stopLeftSidebarResize = () => {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleLeftSidebarResize)
  document.removeEventListener('mouseup', stopLeftSidebarResize)
  document.body.classList.remove('resizing')
  localStorage.setItem('ocr-viewer-left-sidebar-width', String(leftSidebarWidth.value))
}

// 预览文件操作
function handleRefresh() {
  if (currentPreviewFile.value && previewFileRef.value) {
    previewFileRef.value.loadFile(currentPreviewFile.value)
    ElMessage.success('已刷新')
  }
}

function handleDownload() {
  ElMessage.info('下载功能（演示模式）')
}

// 打开文件选择对话框
function handleSelectFile() {
  fileSelectDialogVisible.value = true
}

// 处理文件选择确认
async function onFileSelectConfirm(items) {
  // items 格式: [{ file_id: string, file_name: string }, ...]
  if (!items || items.length === 0) {
    return
  }

  try {
    loading.value = true
    const newFiles = []

    for (const item of items) {
      // 检查文件是否已存在
      const exists = fileRows.value.some(row => row.file_id === item.file_id)

      if (!exists) {
        // 创建文件对象
        const newRow = {
          file_id: item.file_id,
          file_name: item.file_name || '',
          found: true,
          source: null,
          reason: null,
          analyze_skipped: null,
          word_counts: {},
          truncated: false,
          user_dict_hits: [],
          previewUrl: ''
        }

        newFiles.push(newRow)
        fileRows.value.push(newRow)
      }
    }

    // 批量获取预览URL
    if (newFiles.length > 0) {
      const previewPromises = newFiles.map(async (row) => {
        if (row.file_id) {
          try {
            const previewRes = await previewFileAPI(row.file_id)
            if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
              row.previewUrl = previewRes.data.preview_url
            }
          } catch (e) {
            console.warn(`获取文件 ${row.file_name} 预览URL失败:`, e)
          }
        }
      })

      await Promise.all(previewPromises)

      ElMessage.success(`已添加 ${newFiles.length} 个文件`)

      // 自动选择并预览第一个新添加的文件
      if (newFiles.length > 0) {
        await selectFileForPreview(newFiles[0])
      }
    } else {
      ElMessage.info('所选文件已存在于列表中')
    }

    // 关闭对话框
    fileSelectDialogVisible.value = false
  } catch (error) {
    console.error('添加文件失败:', error)
    ElMessage.error('添加文件失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const getTaskDetail = async () => {
  const detailRes = await getTaskSchedulesAPI(props.taskId, {
    prefer_runtime: true,
    include_results: true,
    include_selection_summary: true
  })
  if (detailRes.code !== 200 || !detailRes.data) {
    return
  }
  const data = detailRes.data

  if (isTaskDetailMode.value) {
    await loadTaskCenterPreviewSidebar(data)
  }

  // 详情模式：用任务创建时勾选的停用词过滤结果展示
  if (isTaskDetailMode.value) {
    restoreLexiconFromTaskDetail(data)
  } else {
    taskLexiconStopWordsSet.value = null
    taskUsedLexiconStopWords.value = []
    taskUsedLexiconUserWords.value = []
  }

  let fileIds = []
  let fileNames = []
  ;(data.task_schedule_result_list || []).forEach((item) => {
    fileIds.push(item.file_uuid)
    fileNames.push(item.file_name)
  })

  taskUuid.value = data.task_uuid
  lastResultLoadedTaskUuid.value = ''
  await initFile(fileIds.join(','), fileNames.join(','))
  loadResult()
}

function parseTaskParameterSettings(data) {
  const results = data?.task_schedule_result_list || []
  const tryParse = (raw) => {
    if (raw == null) return null
    let ps = raw
    if (typeof ps === 'string') {
      try {
        ps = JSON.parse(ps)
      } catch {
        return null
      }
    }
    return typeof ps === 'object' && ps ? ps : null
  }

  for (const item of results) {
    const ps = tryParse(item?.parameter_settings)
    if (!ps) continue
    if (Array.isArray(ps.stop_words) || Array.isArray(ps.user_dict_words)) {
      return ps
    }
  }

  if (results.length > 0) {
    return tryParse(results[0].parameter_settings)
  }
  return tryParse(data?.parameter_settings)
}

function applyTaskUsedLexiconFromSettings(ps) {
  if (!ps) {
    taskUsedLexiconStopWords.value = []
    taskUsedLexiconUserWords.value = []
    taskLexiconStopWordsSet.value = null
    return
  }
  const sw = Array.isArray(ps.stop_words) ? ps.stop_words.map((x) => String(x)) : []
  const uw = Array.isArray(ps.user_dict_words) ? ps.user_dict_words.map((x) => String(x)) : []
  taskUsedLexiconStopWords.value = sw
  taskUsedLexiconUserWords.value = uw
  taskLexiconStopWordsSet.value = sw.length ? new Set(sw) : null

  const rawTopN = ps.top_n
  const n = Number(rawTopN)
  if (Number.isFinite(n)) {
    topN.value = Math.max(10, Math.min(500, n))
  }
}

function restoreLexiconFromTaskDetail(data) {
  applyTaskUsedLexiconFromSettings(parseTaskParameterSettings(data))
}

const initFile = async (fileIds, fileNames) => {
  try {
    const ids = fileIds.split(',')
    const names = fileNames ? decodeURIComponent(fileNames).split(',') : []

    loading.value = true
    loadError.value = ''

    const res = await getFilesContentBatchAPI({ file_ids: ids })
    const rows = (res?.data?.files || []).map((r, index) => {
      const content = (r.file_content || '').trim()
      const found = !!r.found
      const analyze_skipped = !found ? (r.reason === 'NO_PERMISSION' ? 'NO_PERMISSION' : 'NOT_FOUND') : content ? null : 'NO_TEXT'
      return {
        file_id: r.file_id,
        file_name: r.file_name || names[index] || '',
        found,
        source: r.source || null,
        reason: r.reason || null,
        analyze_skipped,
        word_counts: {},
        truncated: false,
        user_dict_hits: [],
        previewUrl: ''
      }
    })
    fileRows.value = rows

    // 批量获取预览URL
    const previewPromises = rows.map(async (row) => {
      if (row.file_id) {
        try {
          const previewRes = await previewFileAPI(row.file_id)
          if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
            row.previewUrl = previewRes.data.preview_url
          }
        } catch (e) {
          console.warn(`获取文件 ${row.file_name} 预览URL失败:`, e)
        }
      }
    })

    await Promise.all(previewPromises)

    // 自动选择第一个文件
    if (rows.length > 0) {
      await selectFileForPreview(rows[0])
    }
  } catch (e) {
    console.error(e)
    loadError.value = e?.response?.data?.msg || '校验文件失败'
    fileRows.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 将 file_id 列表反显到左侧公共树
 * @param {string} fileIdsStr 逗号分隔 file_id
 * @param {string} [fileNamesStr] 逗号分隔文件名
 * @returns {Promise<void>}
 */
async function addManagerFilesToSidebar(fileIdsStr, fileNamesStr) {
  const ids = String(fileIdsStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length) return
  const names = fileNamesStr ? decodeURIComponent(fileNamesStr).split(',') : []
  const rows = ids.map((id, index) => ({
    file_id: id,
    file_name: names[index] || ''
  }))
  await addFilesFromManager(rows, { silent: props.isSecondaryExecution })
}

async function loadSelectedFilesAndValidate() {
  if (props.taskId && props.taskId !== '') {
    await getTaskDetail()
    return
  }
  let fileIds = props.files
  let fileNames = props.names

  if (!fileIds) {
    const raw = sessionStorage.getItem('wordCloudFileIds')
    if (!raw) {
      loadError.value = ''
      return
    }
    let ids = []
    try {
      ids = JSON.parse(raw)
    } catch {
      loadError.value = '文件列表参数无效'
      return
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      loadError.value = ''
      return
    }
    fileIds = ids.join(',')
  }

  if (fileIds) {
    await addManagerFilesToSidebar(fileIds, fileNames)
  }
}

function openImmediateExecute() {
  if (!canAnalyze.value) {
    ElMessage.warning('请先选择可分析的文件或文件夹')
    return
  }
  immediateExecuteForm.taskName = `${props.toolLabel}[${formatDateTimeForTaskName()}]`
  immediateExecuteForm.taskRemark = ''
  immediateExecuteDialogVisible.value = true
  loadExecuteLexiconOptions().catch((e) => {
    ElMessage.error(e?.message || '加载词表失败')
  })
}

function handleImmediateExecuteCancel() {
  immediateExecuteDialogVisible.value = false
  immediateExecuteForm.taskName = ''
  immediateExecuteForm.taskRemark = ''
  immediateExecuteForm.selectedStopWords = []
  immediateExecuteForm.selectedUserWords = []
}

function stopLoadingTimer() {
  if (loadingTimer) {
    clearInterval(loadingTimer)
    loadingTimer = null
  }
  loadingText.value = ''
  loadingElapsedTime.value = 0
}

function startLoadingTimer() {
  stopLoadingTimer()
  loadingElapsedTime.value = 0
  loadingText.value = '任务执行中... 0.0s'
  loadingTimer = setInterval(() => {
    loadingElapsedTime.value += 0.1
    loadingText.value = `任务执行中... ${loadingElapsedTime.value.toFixed(1)}s`
  }, 100)
}

const isTasking = ref(false)
/** 批量创建请求是否已作废（卸载/关弹窗后忽略迟到的响应） */
let batchExecuteAborted = false
/** 当前进行中的 BatchExecuteByFilter 取消控制器 */
let activeBatchExecuteAbortController = null

/**
 * 作废进行中的 BatchExecuteByFilter
 * @returns {void}
 */
const invalidateBatchExecute = () => {
  batchExecuteAborted = true
  if (activeBatchExecuteAbortController) {
    try {
      activeBatchExecuteAbortController.abort()
    } catch (error) {
      console.warn('[词云分析] 取消 BatchExecute 失败:', error)
    }
    activeBatchExecuteAbortController = null
  }
}

import { eventBus } from '@/utils/eventBus.js'

/**
 * 调用 BatchExecuteByFilter 创建词云任务（支持文件+文件夹混合提交）
 * @returns {Promise<void>}
 */
async function handleImmediateExecuteConfirm() {
  if (!canAnalyze.value) {
    ElMessage.warning('请先选择可分析的文件或文件夹')
    return
  }
  const taskName = immediateExecuteForm.taskName.trim()
  if (!taskName) {
    ElMessage.warning('请输入任务名称')
    return
  }
  const taskRemark = immediateExecuteForm.taskRemark.trim()
  const stopSet = new Set(immediateExecuteForm.selectedStopWords || [])
  const overlap = (immediateExecuteForm.selectedUserWords || []).filter((w) => stopSet.has(w))
  if (overlap.length > 0) {
    ElMessage.warning('停用词与用户新词不能包含相同词条')
    return
  }

  taskCreating.value = true
  batchExecuteAborted = false
  activeBatchExecuteAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null

  try {
    const { stop_words, user_dict_words } = getSelectedWordListsForExecute()
    const taskData = buildWordCloudBatchExecutePayload({
      taskName,
      taskRemark,
      toolLabel: props.toolLabel || '词云分析',
      sidebarContext: getSidebarExecuteContext(),
      stop_words,
      user_dict_words,
      taskSwitch: 2
    })
    const deletedFiles = buildDeletedFilesPayload()
    if (deletedFiles.length > 0) {
      taskData.deleted_files = deletedFiles
    }

    await runBatchExecuteWithTimeoutNav({
      taskName,
      requestFn: () => batchExecuteByFilterAPI(taskData, {
        signal: activeBatchExecuteAbortController ? activeBatchExecuteAbortController.signal : undefined
      }),
      openTaskCenter: () => {
        invalidateBatchExecute()
        openTaskCenterWithRefresh(router, homeStore)
      },
      onError: (error) => {
        if (isBatchExecuteRequestAborted(error)) return
        ElMessage.error(error?.message || '创建词云任务失败')
        isTasking.value = false
      },
      onResponse: (response, { timeoutFallbackTriggered }) => {
        if (batchExecuteAborted) return
        if (response?.code !== 200 && response?.code !== 201) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error(response?.message || response?.msg || '创建词云任务失败')
          }
          isTasking.value = false
          return
        }

        const tu =
          response?.data?.task_uuid ||
          response?.task_uuid ||
          ''
        if (!tu) {
          if (!timeoutFallbackTriggered) {
            ElMessage.error('创建任务成功但未返回 task_uuid')
          }
          isTasking.value = false
          return
        }

        isTasking.value = true
        taskUuid.value = tu
        lastResultLoadedTaskUuid.value = ''
        immediateExecuteDialogVisible.value = false

        if (props.eventKey && !timeoutFallbackTriggered) {
          eventBus.emit(props.eventKey, {
            taskUuid: tu,
            taskName
          })
        }

        if (!timeoutFallbackTriggered) {
          ElMessage.success(response?.message || '词云分析任务已创建')
        }
      }
    })
  } catch (error) {
    if (!isBatchExecuteRequestAborted(error)) {
      console.error('[词云分析] BatchExecute 失败:', error)
      ElMessage.error(error?.response?.data?.msg || error?.message || '创建词云任务异常')
      isTasking.value = false
    }
  } finally {
    taskCreating.value = false
    activeBatchExecuteAbortController = null
  }
}

const setResult = async () => {
  isTasking.value = false
  await loadResult()
}

const taskError = () => {
  isTasking.value = false
}
defineExpose({
  setResult,
  taskError
})

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await reloadStatus(true)
  }, 1500)
}

async function reloadStatus(silent = false) {
  if (!taskUuid.value) return
  try {
    const res = await getTaskSchedulesAPI(taskUuid.value, {
      prefer_runtime: true,
      include_task_steps: true,
      include_selection_summary: true
    })
    if (res?.code !== 200 || !res.data) {
      if (!silent) ElMessage.error(res?.message || '刷新任务状态失败')
      return
    }
    const data = res.data
    taskStatus.value = data.task_status

    taskRuntimeNodes.value = buildTaskRuntimeNodesDisplay(data)

    // 兜底：若 task_status 未及时收敛，但运行树已全部完成/失败，则以前端可见状态为准
    const collectNodeStatuses = (nodes) => {
      const out = []
      const walk = (arr) => {
        if (!Array.isArray(arr)) return
        for (const n of arr) {
          out.push(Number(n?.status))
          if (Array.isArray(n?.children) && n.children.length) walk(n.children)
        }
      }
      walk(nodes)
      return out
    }
    const nodeStatuses = collectNodeStatuses(taskRuntimeNodes.value)
    let effectiveStatus = Number(taskStatus.value)
    if (nodeStatuses.length) {
      if (nodeStatuses.some((s) => s === 3)) {
        effectiveStatus = 3
      } else if (nodeStatuses.every((s) => s === 2)) {
        effectiveStatus = 2
      } else if (nodeStatuses.some((s) => s === 1)) {
        effectiveStatus = 1
      } else {
        effectiveStatus = 0
      }
    }
    taskStatus.value = effectiveStatus

    if (effectiveStatus === 2) {
      stopPolling()
      stopLoadingTimer()
      progressDialogVisible.value = false
      await loadResult()
    } else if (effectiveStatus === 3) {
      stopPolling()
      stopLoadingTimer()
      // 失败时保留弹框，方便查看失败原因 tooltip
      progressDialogVisible.value = true
      if (!silent) ElMessage.error('任务执行失败，请查看任务进度中的失败原因')
    }
  } catch (e) {
    console.error(e)
    if (!silent) ElMessage.error(e?.response?.data?.msg || '刷新任务状态失败')
  }
}

async function loadResult() {
  if (!taskUuid.value) return
  if (resultLoading.value) return
  if (lastResultLoadedTaskUuid.value === taskUuid.value) return
  resultLoading.value = true
  loading.value = true
  try {
    const res = await getWordCloudTaskResultAPI(taskUuid.value)
    if (res?.code === 200 && res.data?.files) {
      fileRows.value = res.data.files
      lastResultLoadedTaskUuid.value = taskUuid.value
      // 若当前选中集合包含了已不存在的文件，顺便清理
      const existing = new Set(fileRows.value.map((r) => r.file_id))
      selectedFileIds.value = selectedFileIds.value.filter((id) => existing.has(id))
      await nextTick()
      renderChart()
      await refreshLexiconStopWordsSet()
    } else {
      ElMessage.error(res?.msg || '获取任务结果失败')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error(e?.response?.data?.msg || '获取任务结果异常')
  } finally {
    loading.value = false
    resultLoading.value = false
  }
}

function renderChart() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
    chart.on('click', (p) => {
      if (p && p.name) {
        activeWord.value = p.name === activeWord.value ? '' : p.name
        if (activeWord.value) {
          scrollToActiveWord()
        }
      }
    })
  }
  const data = topWordPairs.value.map(([name, value]) => ({ name, value }))
  chart.setOption({
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '95%',
        height: '95%',
        sizeRange: [12, 48],
        rotationRange: [-45, 45],
        gridSize: 8,
        textStyle: {
          color: () =>
            `rgb(${Math.round(Math.random() * 160)},${Math.round(Math.random() * 160)},${Math.round(
              Math.random() * 160
            )})`
        },
        data
      }
    ]
  })
}

function scrollToActiveWord() {
  nextTick(() => {
    if (!activeWord.value) return
    const idx = filteredTopWords.value.findIndex((x) => x.word === activeWord.value)
    if (idx < 0) return
    const tableEl = wordTableRef.value && wordTableRef.value.$el
    if (!tableEl) return
    const rows = tableEl.querySelectorAll('.el-table__body-wrapper tbody tr')
    const rowEl = rows && rows[idx]
    if (rowEl && typeof rowEl.scrollIntoView === 'function') {
      rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  })
}

watch([topWordPairs, topN], () => {
  nextTick(() => renderChart())
})

watch(dictConfigVisible, (visible) => {
  if (visible) {
    lexiconPage.value = 1
    loadLexiconPage(1)
    return
  }
  loadLexiconSummary()
  refreshLexiconStopWordsSet()
})

watch(
  () => progressDialogVisible.value,
  (visible) => {
    // 关闭进度弹框时，立即停止状态轮询，避免继续刷请求
    if (!visible) {
      stopPolling()
      stopLoadingTimer()
    }
  }
)

function onChartResize() {
  if (chart) chart.resize()
}

onMounted(async () => {
  await loadSelectedFilesAndValidate()
  await loadLexiconSummary()
  await refreshLexiconStopWordsSet()
  window.addEventListener('resize', onChartResize)
})

onBeforeUnmount(() => {
  invalidateBatchExecute()
  stopPolling()
  stopLoadingTimer()
  window.removeEventListener('resize', onChartResize)
  if (chart) {
    chart.dispose()
    chart = null
  }
  // 清理宽度调整事件监听
  if (isResizing.value) {
    stopResize()
  }
  if (isResizingLeft.value) {
    stopLeftSidebarResize()
  }
})

watch(
  () => route.query.t,
  async () => {
    // 来自文件管理的再次跳转：重新读取 sessionStorage 并重置任务状态
    taskUuid.value = ''
    taskStatus.value = null
    taskRuntimeNodes.value = []
    lastResultLoadedTaskUuid.value = ''
    selectedFileIds.value = []
    progressDialogVisible.value = false
    stopPolling()
    stopLoadingTimer()
    await loadSelectedFilesAndValidate()
    await loadLexiconSummary()
    await refreshLexiconStopWordsSet()
  }
)
</script>

<style scoped>
.word-cloud-page {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.word-cloud-page :deep(.ocr-sidebar-footer) {
  display: flex;
  align-items: center;
  padding: 12px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: 56px;
}

.dict-config-dialog :deep(.el-dialog__header),
.lexicon-import-review-dialog :deep(.el-dialog__header),
.lexicon-add-dialog :deep(.el-dialog__header),
.word-cloud-progress-dialog :deep(.el-dialog__header) {
  padding-bottom: 0;
}

.dict-config-dialog :deep(.el-dialog) {
  max-height: 92vh;
  margin-top: 4vh !important;
}
.dict-config-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  height: 600px;
  min-height: 600px;
  max-height: calc(92vh - 140px);
  box-sizing: border-box;
  overflow: hidden;
}
.lexicon-import-review-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}
.lexicon-review-summary {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #606266;
}
.lexicon-review-hint {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}
.lexicon-review-toolbar {
  margin-bottom: 8px;
}
.lexicon-review-toolbar > * + * {
  margin-left: 8px;
}
.lexicon-review-table {
  width: 100%;
}
.immediate-execute-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}
.task-used-lexicon-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  max-height: 60vh;
  overflow-y: auto;
}
.task-used-lexicon-empty {
  margin: 0;
  color: #909399;
  font-size: 13px;
  line-height: 1.6;
}
.task-used-lexicon-panels > * + * {
  margin-top: 16px;
}
.task-used-lexicon-panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.task-used-lexicon-tags {
  display: flex;
  flex-wrap: wrap;
}
.task-used-lexicon-tags .el-tag {
  margin-right: 8px;
  margin-bottom: 8px;
}
.task-used-lexicon-none {
  color: #909399;
  font-size: 13px;
}
.execute-lexicon-field {
  width: 100%;
}
.execute-lexicon-select {
  width: 100%;
}
.execute-lexicon-actions {
  margin-top: 4px;
}
.execute-lexicon-actions > * + * {
  margin-left: 8px;
}
.execute-lexicon-hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.page-bottom-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  min-height: 56px;
  padding: 0 24px;
  border-top: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  box-sizing: border-box;
}

.toolbar-lexicon-group,
.toolbar-topn-group {
  display: flex;
  align-items: center;
}

.toolbar-lexicon-group > * + * {
  margin-left: 12px;
}

.toolbar-topn-group {
  margin-left: 24px;
  padding-left: 24px;
  border-left: 1px solid var(--sd-hairline, #e0e0e0);
}

.toolbar-topn-group > * + * {
  margin-left: 8px;
}

.toolbar-dict-summary {
  color: var(--sd-ink-muted, #525252);
  font-size: 13px;
  white-space: nowrap;
}

.toolbar-label {
  display: inline-flex;
  align-items: center;
  color: var(--sd-ink-muted, #525252);
  font-size: 13px;
  white-space: nowrap;
}

.toolbar-label .el-icon {
  margin-left: 4px;
  font-size: 14px;
  color: var(--sd-ink-subtle, #8c8c8c);
}

/* 主布局区域 */
.main-layout {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  position: relative;
}
.dict-single-panel {
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.dict-table-wrap {
  flex: 1;
  min-height: 240px;
  overflow: hidden;
}

.dict-pagination-row {
  margin-top: 0;
}

.dict-actions-toolbar {
  margin-bottom: 12px;
}
.dict-toolbar-row {
  margin-bottom: 8px;
}
.dict-lexicon-count-hint {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.dict-lexicon-count-hint-sep {
  margin: 0 6px;
  color: #dcdfe6;
}
.dict-kind-filter {
  width: 112px;
  flex-shrink: 0;
}
.dict-filter-input-inline {
  flex: 1;
  min-width: 0;
}
.lexicon-add-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}
.lexicon-add-form .lexicon-add-kind-select {
  width: 100%;
}
.dict-file-input {
  display: none;
}
.dict-table {
  width: 100%;
}
.user-dict-hits-wrap {
  min-height: 28px;
  margin-bottom: 10px;
}
.user-dict-hits-empty {
  font-size: 12px;
  color: #909399;
}
.user-dict-hit-tag {
  margin-right: 8px;
  margin-bottom: 6px;
}
.col-mid-title-second {
  margin-top: 4px;
}

/* 左侧栏与拖拽条成组 */
.left-sidebar-group {
  display: flex;
  flex-shrink: 0;
  align-self: stretch;
  min-height: 0;
}

/* 左侧公共树 */
.left-sidebar-shell {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  align-self: stretch;
  border: 1px solid #e4e7ed;
  border-radius: 4px 0 0 4px;
  background: #fff;
  overflow: hidden;
}

.left-sidebar-shell.resizable-left-sidebar {
  transition: width 0s;
}

.word-cloud-left-sidebar {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.word-cloud-execute-btn {
  width: 100%;
  height: 32px;
  min-height: 32px;
}

.file-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

/* 中间预览区域 */
.center-viewer {
  flex: 1;
  min-width: 0;
  min-height: 0;
  margin: 0 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.center-viewer :deep(.folder-list-content) {
  flex: 1;
  min-height: 0;
}

.center-viewer :deep(.preview-file-wrapper) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 分隔线 */
.resizer {
  width: 10px;
  background: linear-gradient(to right, transparent 3px, #e4e7ed 3px, #e4e7ed 7px, transparent 7px);
  cursor: ew-resize;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background 0.2s;
  align-self: stretch;
}

.resizer-left {
  width: 4px;
  background: #e4e7ed;
  cursor: col-resize;
  border-right: 1px solid #e4e7ed;
}

.resizer-left:hover {
  background: #409eff;
}

:global(body.resizing) {
  user-select: none;
  cursor: col-resize;
}

:global(body.resizing) .resizer-left {
  background-color: #409eff;
}

.resizer:hover {
  background: linear-gradient(to right, transparent 3px, #409eff 3px, #409eff 7px, transparent 7px);
}

.resize-icon {
  color: #909399;
  font-size: 14px;
}

.resizer:hover .resize-icon {
  color: #409eff;
}

/* 右侧内容区域 */
.right-content {
  display: flex;
  min-width: 0;
  flex-shrink: 0;
}
.right-content > * + * {
  margin-left: 16px;
}

.right-content-fullwidth {
  flex: 1;
}

.word-cloud-progress-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
}
.progress-dialog-body {
  padding-bottom: 6px;
}
.progress-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.progress-elapsed {
  color: #606266;
  font-size: 12px;
}
.task-runtime-execute-panel {
  padding: 6px 0;
}
.task-runtime-elapsed {
  color: #606266;
  font-size: 12px;
  margin-bottom: 8px;
}

.col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.col-mid {
  flex: 0.85;
  padding: 0 10px;
}
.col-right {
  flex: 1.35;
}
.col-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  flex-shrink: 0;
}
.filter-input {
  margin-bottom: 8px;
  flex-shrink: 0;
}
.chart-box {
  width: 100%;
  height: 520px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.expand-inner {
  padding: 8px 12px 12px;
}
.expand-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.muted {
  color: #909399;
  font-size: 13px;
}
.word-active {
  color: #409eff;
  font-weight: 600;
}

.empty-wrap {
  padding: 48px 0;
}

/* 禁止选择（调整宽度时） */
:global(body.resizing) {
  user-select: none;
  cursor: ew-resize !important;
}

:global(body.resizing *) {
  cursor: ew-resize !important;
}
</style>
