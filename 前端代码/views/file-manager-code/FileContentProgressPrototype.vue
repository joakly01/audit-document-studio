<template>
  <div class="fcp-proto fcp-proto--full">
    <div class="page-header">
      <div>
        <h1 class="page-title">文件上传记录</h1>
      </div>
      <div class="header-actions" v-if="isSuperFileAdmin()">
        <div class="ocr-setting">
          <div class="ocr-setting-row">
            <span class="ocr-setting-label">个人上传并发</span>
            <el-tooltip content="LOCAL 队列（MinIO 上传后 OCR）；上限见环境 OCR_WORKER_MAX_CONCURRENCY_LOCAL；热更新。" placement="bottom">
              <el-input-number
                v-model="ocrConcurrencyLocal"
                :min="1"
                :max="ocrMaxLocal"
                :step="1"
                :controls="true"
                size="small"
                class="ocr-input"
              />
            </el-tooltip>
          </div>
          <div class="ocr-setting-row">
            <span class="ocr-setting-label">OSS 同步并发</span>
            <el-tooltip content="OSS 批量补全文等；上限见 OCR_WORKER_MAX_CONCURRENCY_OSS；热更新。" placement="bottom">
              <el-input-number
                v-model="ocrConcurrencyOss"
                :min="1"
                :max="ocrMaxOss"
                :step="1"
                :controls="true"
                size="small"
                class="ocr-input"
              />
            </el-tooltip>
          </div>
          <el-button type="primary" size="small" link :loading="ocrSaveLoading" @click="persistOcrConcurrency">保存</el-button>
        </div>
        <el-button type="primary" :loading="refreshLoading" @click="refreshAll">刷新</el-button>
        <el-button @click="togglePoll">{{ polling ? '停止轮询' : '自动刷新' }}</el-button>
        <el-tooltip
          content="清空 Redis 中 LOCAL / OSS 待识别任务（仅超级文件管理员）。尚未被 Worker 取走的任务会丢失；正在执行的仍可能写完 DB。OSS 补全文已走 OSS 队列，清空 OSS 队列可取消排队中的补全文。"
          placement="bottom"
        >
          <el-button type="danger" plain @click="openClearOcrQueueDialog">清空 OCR 队列</el-button>
        </el-tooltip>
      </div>
    </div>

    <el-row :gutter="16" class="two-col">
      <el-col :xs="24" :lg="12">
        <div v-loading="loadingPublic" class="colon-panel colon-public">
          <div class="colon-title">
            <span class="colon-title-text">公共空间</span>
            <el-tag type="info" size="small">OSS 仅出现在此空间</el-tag>
          </div>

          <el-card shadow="never" class="oss-card">
            <template #header>
              <div class="oss-card-header-row">
                <div>
                  <span class="oss-card-title">OSS 批量补全</span>
                  <span class="oss-card-sub">尚缺全文 / OCR 队列</span>
                </div>
                <el-tooltip
                  content="调用 POST /api/v1/oss/refresh-file-content，将尚缺全文的 OSS 记录入 Redis 队列，由 OCR Worker 异步补全文（单文件独立超时，避免整请求超时）。"
                  placement="bottom"
                  v-if="isSuperFileAdmin()"
                >
                  <el-button type="primary" size="small" :loading="ossRefreshLoading" @click="runOssRefreshFileContent">
                    OSS 补全文
                  </el-button>
                </el-tooltip>
              </div>
            </template>
            <el-row :gutter="12">
              <el-col :span="12">
                <div class="oss-label">OSS 尚缺全文条数</div>
                <div class="oss-num">{{ summaryPublic.oss_remaining ?? 0 }}</div>
              </el-col>
              <el-col :span="12">
                <div class="oss-label">OCR 主队列长度</div>
                <div class="oss-num queue-len">{{ summaryPublic.queue_length ?? 0 }}</div>
              </el-col>
            </el-row>
          </el-card>

          <div class="stat-row stat-row-five">
            <div class="stat-card upload">
              <div class="label">上传中</div>
              <div class="value">{{ summaryPublic.uploading }}</div>
            </div>
            <div class="stat-card pending">
              <div class="label">排队中</div>
              <div class="value">{{ summaryPublic.queue_pending_public ?? 0 }}</div>
            </div>
            <div class="stat-card processing">
              <div class="label">识别中</div>
              <div class="value">{{ summaryPublic.processing }}</div>
            </div>
            <div class="stat-card ready">
              <div class="label">已完成</div>
              <div class="value">{{ summaryPublic.done }}</div>
            </div>
            <div class="stat-card fail">
              <div class="label">失败/积压</div>
              <div class="value">{{ (summaryPublic.failed ?? 0) + (summaryPublic.stuck ?? 0) }}</div>
            </div>
          </div>

          <div class="toolbar">
            <el-select v-model="filterStatusPublic" placeholder="状态" clearable style="width: 118px" @change="onPublicFilterChange">
              <el-option label="全部" value="" />
              <el-option label="上传中" value="uploading" />
              <el-option label="排队中" value="pending" />
              <el-option label="识别中" value="processing" />
              <el-option label="已完成" value="done" />
              <el-option label="失败" value="failed" />
              <el-option label="积压" value="stuck" />
            </el-select>
            <el-select v-model="filterSourcePublic" placeholder="来源" clearable style="width: 118px" @change="onPublicFilterChange">
              <el-option label="全部" value="" />
              <el-option label="本地上传" value="LOCAL" />
              <el-option label="OSS" value="OSS" />
            </el-select>
            <el-input v-model="keywordPublic" class="grow" clearable placeholder="搜索文件名…" @clear="searchPublic" @keyup.enter="searchPublic" />
            <el-button size="small" type="primary" plain @click="searchPublic">查询</el-button>
            <el-button
              size="small"
              type="warning"
              plain
              :disabled="!selectedPublicRows.length"
              :loading="requeueByIdsLoading"
              @click="confirmRequeueByIds('PUBLIC')"
            >
              重新开始识别({{ selectedPublicRows.length }})
            </el-button>
          </div>

          <div class="colon-table-stack">
          <el-table
            :data="listPublic"
            :height="publicTableHeight"
            stripe
            border
            class="proto-table"
            size="small"
            v-loading="tableLoadingPublic"
            @selection-change="(val) => { selectedPublicRows = val }"
          >
            <el-table-column type="selection" width="40" align="center" />
            <el-table-column label="文件名" min-width="168">
              <template #default="{ row }">
                <div class="file-name-cell">
                  <span class="ico">{{ row.source === 'LOCAL' ? '📄' : '📁' }}</span>
                  <div>
                    <div class="name">{{ row.file_name }}</div>
                    <div class="sub-row">{{ row.file_id }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="source" label="来源" width="64" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.source === 'LOCAL'" type="primary" size="small">本地</el-tag>
                <el-tag v-else type="success" size="small">OSS</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="存储桶" width="100" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="bucket-text">{{ row.bucket }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="folder" label="文件夹" min-width="88" show-overflow-tooltip />
            <el-table-column label="进度（时间线）" min-width="200">
              <template #default="{ row }">
                <div class="timeline-cell" v-html="timelineHtml(row)" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'uploading'" type="warning" size="small">上传</el-tag>
                <el-tag v-else-if="row.status === 'pending'" type="warning" effect="plain" size="small">排队</el-tag>
                <el-tag v-else-if="row.status === 'processing'" type="primary" effect="plain" size="small">识别</el-tag>
                <el-tag v-else-if="row.status === 'done'" type="success" size="small">完成</el-tag>
                <el-tooltip v-else-if="row.status === 'failed'" :content="row.error_message || '解析失败'" placement="top">
                  <el-tag type="danger" size="small">失败</el-tag>
                </el-tooltip>
                <el-tag v-else type="info" effect="plain" size="small">积压</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="128" />
            <el-table-column label="操作" width="72" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" :disabled="!canOpenContent(row)" @click="handleOpen(row)">打开</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-wrap">
            <el-pagination
              v-model:current-page="pagePublic"
              v-model:page-size="pageSizePublic"
              :page-sizes="PAGE_SIZE_OPTIONS"
              :total="totalPublic"
              small
              background
              layout="total, sizes, prev, pager, next, jumper"
              :hide-on-single-page="false"
              @size-change="onPublicPageSizeChange"
              @current-change="loadPublicTable"
            />
          </div>
          </div>
        </div>
      </el-col>

      <el-col :xs="24" :lg="12">
        <div v-loading="loadingPersonal" class="colon-panel colon-personal">
          <div class="colon-title">
            <span class="colon-title-text">个人空间</span>
            <el-tag type="success" size="small" effect="plain">本人可见范围</el-tag>
          </div>

          <div class="stat-row stat-row-five">
            <div class="stat-card upload">
              <div class="label">上传中</div>
              <div class="value">{{ summaryPersonal.uploading }}</div>
            </div>
            <div class="stat-card pending">
              <div class="label">排队中</div>
              <div class="value">{{ summaryPersonal.queue_pending_personal ?? 0 }}</div>
            </div>
            <div class="stat-card processing">
              <div class="label">识别中</div>
              <div class="value">{{ summaryPersonal.processing }}</div>
            </div>
            <div class="stat-card ready">
              <div class="label">已完成</div>
              <div class="value">{{ summaryPersonal.done }}</div>
            </div>
            <div class="stat-card fail">
              <div class="label">失败/积压</div>
              <div class="value">{{ (summaryPersonal.failed ?? 0) + (summaryPersonal.stuck ?? 0) }}</div>
            </div>
          </div>

          <div class="toolbar">
            <el-select v-model="filterStatusPersonal" placeholder="状态" clearable style="width: 118px" @change="onPersonalFilterChange">
              <el-option label="全部" value="" />
              <el-option label="上传中" value="uploading" />
              <el-option label="排队中" value="pending" />
              <el-option label="识别中" value="processing" />
              <el-option label="已完成" value="done" />
              <el-option label="失败" value="failed" />
              <el-option label="积压" value="stuck" />
            </el-select>
            <el-input v-model="keywordPersonal" class="grow" clearable placeholder="搜索文件名…" @clear="searchPersonal" @keyup.enter="searchPersonal" />
            <el-button size="small" type="primary" plain @click="searchPersonal">查询</el-button>
            <el-button
              size="small"
              type="warning"
              plain
              :disabled="!selectedPersonalRows.length"
              :loading="requeueByIdsLoading"
              @click="confirmRequeueByIds('PERSONAL')"
            >
              重新开始识别({{ selectedPersonalRows.length }})
            </el-button>
          </div>

          <div class="colon-table-stack">
          <el-table
            :data="listPersonal"
            :height="personalTableHeight"
            stripe
            border
            class="proto-table"
            size="small"
            v-loading="tableLoadingPersonal"
            @selection-change="(val) => { selectedPersonalRows = val }"
          >
            <el-table-column type="selection" width="40" align="center" />
            <el-table-column label="文件名" min-width="168">
              <template #default="{ row }">
                <div class="file-name-cell">
                  <span class="ico">📄</span>
                  <div>
                    <div class="name">{{ row.file_name }}</div>
                    <div class="sub-row">{{ row.file_id }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="存储桶" width="100" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="bucket-text">{{ row.bucket }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="folder" label="文件夹" min-width="88" show-overflow-tooltip />
            <el-table-column label="进度（时间线）" min-width="200">
              <template #default="{ row }">
                <div class="timeline-cell" v-html="timelineHtml(row)" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'uploading'" type="warning" size="small">上传</el-tag>
                <el-tag v-else-if="row.status === 'pending'" type="warning" effect="plain" size="small">排队</el-tag>
                <el-tag v-else-if="row.status === 'processing'" type="primary" effect="plain" size="small">识别</el-tag>
                <el-tag v-else-if="row.status === 'done'" type="success" size="small">完成</el-tag>
                <el-tooltip v-else-if="row.status === 'failed'" :content="row.error_message || '解析失败'" placement="top">
                  <el-tag type="danger" size="small">失败</el-tag>
                </el-tooltip>
                <el-tag v-else type="info" effect="plain" size="small">积压</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updated_at" label="更新时间" width="128" />
            <el-table-column label="操作" width="72" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" :disabled="!canOpenContent(row)" @click="handleOpen(row)">打开</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-wrap">
            <el-pagination
              v-model:current-page="pagePersonal"
              v-model:page-size="pageSizePersonal"
              :page-sizes="PAGE_SIZE_OPTIONS"
              :total="totalPersonal"
              small
              background
              layout="total, sizes, prev, pager, next, jumper"
              :hide-on-single-page="false"
              @size-change="onPersonalPageSizeChange"
              @current-change="loadPersonalTable"
            />
          </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="clearOcrQueueVisible"
      title="清空 OCR 队列（Redis）"
      width="480px"
      destroy-on-close
      @closed="resetClearOcrQueueForm"
    >
      <p class="clear-queue-tip">
        将删除所选 Redis 中的排队/状态数据。正在执行的 Worker 仍可能写完数据库。OSS 补全文任务在 OSS 队列中时可被清空；若需重新入队可再点「OSS 补全文」。
      </p>
      <div class="clear-queue-checks">
        <el-checkbox v-model="clearOcrLocal">清空个人上传队列（LOCAL）</el-checkbox>
        <el-checkbox v-model="clearOcrOss">清空 OSS 队列</el-checkbox>
        <el-checkbox v-model="clearOcrProcessing">清除「识别中」标记（慎用）</el-checkbox>
        <el-checkbox v-model="clearOcrFailed">清空失败队列</el-checkbox>
      </div>
      <template #footer>
        <el-button @click="clearOcrQueueVisible = false">取消</el-button>
        <el-button type="danger" :loading="clearOcrQueueLoading" @click="submitClearOcrQueue">确认清空</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="contentVisible"
      :title="contentDialogTitle"
      width="92%"
      top="6vh"
      destroy-on-close
      class="content-dialog"
      @closed="onContentDialogClosed"
    >
      <div v-loading="contentLoading" class="content-dialog-body">
        <pre v-if="!contentLoading" class="content-pre">{{ contentText }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getToken } from '@/utils/request/token.js'
import {
  getFileContentAPI,
  getContentProgressSummaryAPI,
  getContentProgressFilesAPI,
  getOcrConcurrencyAPI,
  putOcrConcurrencyAPI,
  refreshOssFileContentAPI,
  postOcrQueueClearAPI,
  postRequeueLocalEmptyAPI,
  postRequeueByFileIdsAPI,
} from '@/api/fileManager'

const LS_OCR_CONCURRENCY_LOCAL = 'fcp_proto_ocr_concurrency_local'
const LS_OCR_CONCURRENCY_OSS = 'fcp_proto_ocr_concurrency_oss'
const LS_PAGE_SIZE_PUBLIC = 'fcp_proto_page_size_public'
const LS_PAGE_SIZE_PERSONAL = 'fcp_proto_page_size_personal'
/** 与后端 content-progress/files 的 page_size 上限 100 对齐 */
const PAGE_SIZE_OPTIONS = [10, 15, 20, 30, 50, 100]

function isSuperFileAdmin() {
  try {
    const token = getToken()
    if (token) {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        const payload = JSON.parse(payloadStr)
        const roleList = Array.isArray(payload.role) ? payload.role : []
        return roleList.some((role) => {
          if (typeof role === 'string') {
            return role === 'super_file_admin'
          }
          if (role && typeof role === 'object') {
            return role.rolecode === 'super_file_admin'
          }
          return false
        })
      }
    }
  } catch (e) {
    // ignore
  }
  return false
}

function emptySummary() {
  return {
    uploading: 0,
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
    stuck: 0,
    oss_remaining: 0,
    queue_length: 0,
    queue_pending_public: 0,
    queue_pending_personal: 0,
  }
}

const summaryPublic = ref(emptySummary())
const summaryPersonal = ref(emptySummary())

const listPublic = ref([])
const listPersonal = ref([])
const totalPublic = ref(0)
const totalPersonal = ref(0)

const loadingPublic = ref(false)
const loadingPersonal = ref(false)
const tableLoadingPublic = ref(false)
const tableLoadingPersonal = ref(false)
const refreshLoading = ref(false)

const filterStatusPublic = ref('')
const filterSourcePublic = ref('')
const keywordPublic = ref('')
const pagePublic = ref(1)
const pageSizePublic = ref(20)

const filterStatusPersonal = ref('')
const keywordPersonal = ref('')
const pagePersonal = ref(1)
const pageSizePersonal = ref(20)

const ocrConcurrencyLocal = ref(1)
const ocrConcurrencyOss = ref(5)
const ocrMaxLocal = ref(4)
const ocrMaxOss = ref(32)
const ocrSaveLoading = ref(false)
const ossRefreshLoading = ref(false)

const clearOcrQueueVisible = ref(false)
const clearOcrQueueLoading = ref(false)
const clearOcrLocal = ref(true)
const clearOcrOss = ref(true)
const clearOcrProcessing = ref(false)
const clearOcrFailed = ref(false)

const requeueLocalLoadingPublic = ref(false)
const requeueLocalLoadingPersonal = ref(false)

// 多选行 + 重新识别
const selectedPublicRows = ref([])
const selectedPersonalRows = ref([])
const requeueByIdsLoading = ref(false)

const contentVisible = ref(false)
const contentLoading = ref(false)
const contentText = ref('')
const contentDialogTitle = ref('文件内容')
const publicTableHeight = ref(450)
const personalTableHeight = ref(625)

/**
 * 计算左右表格动态高度。
 * @param {number} viewportHeight 视口高度（单位：px）。
 * @returns {{ publicHeight: number, personalHeight: number }} 左右表格高度。
 */
function calculateTableHeights(viewportHeight) {
  const safeViewport = Number(viewportHeight) || 900
  const publicHeight = Math.max(360, safeViewport - 420)
  const personalHeight = Math.max(420, safeViewport - 320)
  return { publicHeight, personalHeight }
}

/**
 * 根据当前窗口高度更新左右表格高度。
 * @param {Event} [_event] 浏览器 resize 事件对象（不使用，仅为事件回调签名保留）。
 */
function updateTableHeights(_event) {
  void _event
  if (typeof window === 'undefined') return
  const heights = calculateTableHeights(window.innerHeight)
  publicTableHeight.value = heights.publicHeight
  personalTableHeight.value = heights.personalHeight
}

function mergeSummary(raw) {
  const base = emptySummary()
  if (!raw || typeof raw !== 'object') return base
  for (const k of Object.keys(base)) {
    if (!Object.prototype.hasOwnProperty.call(raw, k) || raw[k] === undefined || raw[k] === null) continue
    const n = Number(raw[k])
    if (!Number.isNaN(n)) base[k] = n
  }
  return base
}

async function fetchSummary(space) {
  const res = await getContentProgressSummaryAPI({ space })
  if (res?.code === 200 && res.data) {
    return mergeSummary(res.data)
  }
  return emptySummary()
}

async function refreshSummaries() {
  const [pub, per] = await Promise.all([fetchSummary('PUBLIC'), fetchSummary('PERSONAL')])
  summaryPublic.value = pub
  summaryPersonal.value = per
}

function loadSavedPageSizes() {
  try {
    const pub = localStorage.getItem(LS_PAGE_SIZE_PUBLIC)
    if (pub) {
      const n = parseInt(pub, 10)
      if (!Number.isNaN(n) && PAGE_SIZE_OPTIONS.includes(n)) pageSizePublic.value = n
    }
    const per = localStorage.getItem(LS_PAGE_SIZE_PERSONAL)
    if (per) {
      const n = parseInt(per, 10)
      if (!Number.isNaN(n) && PAGE_SIZE_OPTIONS.includes(n)) pageSizePersonal.value = n
    }
  } catch {
    /* ignore */
  }
}

function onPublicFilterChange() {
  pagePublic.value = 1
  loadPublicTable()
}

function searchPublic() {
  pagePublic.value = 1
  loadPublicTable()
}

function onPersonalFilterChange() {
  pagePersonal.value = 1
  loadPersonalTable()
}

function searchPersonal() {
  pagePersonal.value = 1
  loadPersonalTable()
}

function onPublicPageSizeChange() {
  pagePublic.value = 1
  try {
    localStorage.setItem(LS_PAGE_SIZE_PUBLIC, String(pageSizePublic.value))
  } catch {
    /* ignore */
  }
  loadPublicTable()
}

function onPersonalPageSizeChange() {
  pagePersonal.value = 1
  try {
    localStorage.setItem(LS_PAGE_SIZE_PERSONAL, String(pageSizePersonal.value))
  } catch {
    /* ignore */
  }
  loadPersonalTable()
}

async function loadPublicTable() {
  tableLoadingPublic.value = true
  try {
    const res = await getContentProgressFilesAPI({
      space: 'PUBLIC',
      page: pagePublic.value,
      page_size: pageSizePublic.value,
      status: filterStatusPublic.value || undefined,
      source: filterSourcePublic.value || undefined,
      keyword: keywordPublic.value || undefined,
    })
    if (res?.code === 200 && res.data) {
      listPublic.value = res.data.items || []
      totalPublic.value = res.data.total ?? 0
      if (res.data.oss_remaining != null) {
        summaryPublic.value = { ...summaryPublic.value, oss_remaining: res.data.oss_remaining }
      }
      if (res.data.queue_length != null) {
        summaryPublic.value = { ...summaryPublic.value, queue_length: res.data.queue_length }
      }
      if (res.data.queue_pending_public != null) {
        summaryPublic.value = { ...summaryPublic.value, queue_pending_public: res.data.queue_pending_public }
      }
      if (res.data.queue_pending_personal != null) {
        summaryPublic.value = { ...summaryPublic.value, queue_pending_personal: res.data.queue_pending_personal }
      }
    } else {
      listPublic.value = []
      totalPublic.value = 0
    }
  } catch (e) {
    listPublic.value = []
    totalPublic.value = 0
    ElMessage.error(e?.message || '加载公共列表失败')
  } finally {
    tableLoadingPublic.value = false
  }
}

async function loadPersonalTable() {
  tableLoadingPersonal.value = true
  try {
    const res = await getContentProgressFilesAPI({
      space: 'PERSONAL',
      page: pagePersonal.value,
      page_size: pageSizePersonal.value,
      status: filterStatusPersonal.value || undefined,
      keyword: keywordPersonal.value || undefined,
    })
    if (res?.code === 200 && res.data) {
      listPersonal.value = res.data.items || []
      totalPersonal.value = res.data.total ?? 0
      if (res.data.queue_length != null) {
        summaryPersonal.value = { ...summaryPersonal.value, queue_length: res.data.queue_length }
      }
      if (res.data.queue_pending_public != null) {
        summaryPersonal.value = { ...summaryPersonal.value, queue_pending_public: res.data.queue_pending_public }
      }
      if (res.data.queue_pending_personal != null) {
        summaryPersonal.value = { ...summaryPersonal.value, queue_pending_personal: res.data.queue_pending_personal }
      }
    } else {
      listPersonal.value = []
      totalPersonal.value = 0
    }
  } catch (e) {
    listPersonal.value = []
    totalPersonal.value = 0
    ElMessage.error(e?.message || '加载个人列表失败')
  } finally {
    tableLoadingPersonal.value = false
  }
}

async function refreshAll() {
  refreshLoading.value = true
  loadingPublic.value = true
  loadingPersonal.value = true
  try {
    await refreshSummaries()
    await Promise.all([loadPublicTable(), loadPersonalTable()])
  } finally {
    refreshLoading.value = false
    loadingPublic.value = false
    loadingPersonal.value = false
  }
}

async function runOssRefreshFileContent() {
  ossRefreshLoading.value = true
  try {
    const res = await refreshOssFileContentAPI()
    if (res?.code === 200 && res.data) {
      const d = res.data
      if (d.success === false) {
        ElMessage.warning(d.message || 'OSS 客户端不可用或未完成')
        return
      }
      const enq = d.enqueued ?? d.processed ?? 0
      const parts = [
        `已入队 ${enq} 条`,
        `入队失败 ${d.push_failed ?? d.failed ?? 0}`,
        `本批条数 ${d.total ?? 0}`,
      ]
      if (d.total_empty != null) parts.push(`尚缺全文共 ${d.total_empty} 条`)
      if (d.skipped_already_processing) parts.push(`跳过识别中 ${d.skipped_already_processing}`)
      if (d.skipped_already_in_queue) parts.push(`跳过已在队列 ${d.skipped_already_in_queue}`)
      if (d.truncated) parts.push(`仅本批入队（上限 ${d.max_enqueue ?? 20000}），请再次点击处理剩余`)
      if (d.batch_id) parts.push(`batch ${d.batch_id}`)
      if (d.elapsed_ms != null) parts.push(`接口耗时 ${d.elapsed_ms} ms`)
      ElMessage.success(`OSS 补全文：${parts.join('，')}`)
      await refreshAll()
    } else {
      ElMessage.error(res?.message || 'OSS 补全文失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '请求失败')
  } finally {
    ossRefreshLoading.value = false
  }
}

function fulltextLabel(status) {
  if (status === 'uploading') return '等待上传完成'
  if (status === 'pending') return '排队中'
  if (status === 'processing') return '识别中'
  if (status === 'done') return '已完成'
  if (status === 'failed') return '失败'
  if (status === 'stuck') return '积压'
  return '—'
}

function timelineHtml(row) {
  const parts = []
  if (row.source === 'LOCAL' && row.self_upload) {
    const upDone = row.status !== 'uploading'
    parts.push(
      `<div class="tl-line"><span class="tl-dot ${upDone ? 'ok' : 'run'}"></span><span class="tl-t">上传</span>` +
        (row.status === 'uploading'
          ? `<span class="tl-p">${row.upload_percent ?? 0}%</span></div>`
          : `<span class="tl-p done">已完成</span></div>`)
    )
  } else {
    parts.push(
      `<div class="tl-line"><span class="tl-dot ok"></span><span class="tl-t">上传</span><span class="tl-p skip">（同步/OSS 无本机上传）</span></div>`
    )
  }
  const ft = fulltextLabel(row.status)
  const ftClass =
    row.status === 'done' ? 'ok' : row.status === 'failed' || row.status === 'stuck' ? 'bad' : 'run'
  parts.push(`<div class="tl-line"><span class="tl-dot ${ftClass}"></span><span class="tl-t">全文</span><span class="tl-ft">${ft}</span></div>`)
  return parts.join('')
}

function canOpenContent(row) {
  return row.status === 'done'
}

function onContentDialogClosed() {
  contentText.value = ''
}

async function handleOpen(row) {
  if (!canOpenContent(row)) return
  contentDialogTitle.value = row.file_name ? `文件内容 — ${row.file_name}` : '文件内容'
  contentText.value = ''
  contentVisible.value = true
  contentLoading.value = true
  try {
    const res = await getFileContentAPI(row.file_id)
    if (res?.code === 200 && res?.data) {
      const text = res.data.file_content ?? ''
      contentText.value = text
      if (!String(text).trim()) {
        ElMessage.warning('暂无全文内容')
      }
    } else {
      contentVisible.value = false
      ElMessage.error(res?.message || '获取文件内容失败')
    }
  } catch (e) {
    contentVisible.value = false
    const msg = e?.response?.data?.message || e?.message || '请求失败'
    ElMessage.error(msg)
  } finally {
    contentLoading.value = false
  }
}

async function loadOcrConcurrency() {
  try {
    const res = await getOcrConcurrencyAPI()
    if (res?.code === 200 && res.data) {
      const d = res.data
      if (d.concurrency_local != null) ocrConcurrencyLocal.value = Number(d.concurrency_local) || 1
      if (d.concurrency_oss != null) ocrConcurrencyOss.value = Number(d.concurrency_oss) || 5
      if (d.max_concurrency_local != null) ocrMaxLocal.value = Number(d.max_concurrency_local) || 4
      if (d.max_concurrency_oss != null) ocrMaxOss.value = Number(d.max_concurrency_oss) || 32
      return
    }
  } catch {
    /* ignore */
  }
  const rl = localStorage.getItem(LS_OCR_CONCURRENCY_LOCAL)
  const ro = localStorage.getItem(LS_OCR_CONCURRENCY_OSS)
  const nl = rl != null ? parseInt(rl, 10) : NaN
  const no = ro != null ? parseInt(ro, 10) : NaN
  if (!Number.isNaN(nl) && nl >= 1) ocrConcurrencyLocal.value = nl
  if (!Number.isNaN(no) && no >= 1) ocrConcurrencyOss.value = no
}

async function persistOcrConcurrency() {
  const capL = Math.max(1, Number(ocrMaxLocal.value) || 4)
  const capO = Math.max(1, Number(ocrMaxOss.value) || 32)
  const vl = Math.min(capL, Math.max(1, Number(ocrConcurrencyLocal.value) || 1))
  const vo = Math.min(capO, Math.max(1, Number(ocrConcurrencyOss.value) || 1))
  ocrConcurrencyLocal.value = vl
  ocrConcurrencyOss.value = vo
  ocrSaveLoading.value = true
  try {
    const res = await putOcrConcurrencyAPI(vl, vo)
    if (res?.code === 200 && res.data) {
      const d = res.data
      if (d.concurrency_local != null) ocrConcurrencyLocal.value = Number(d.concurrency_local) || vl
      if (d.concurrency_oss != null) ocrConcurrencyOss.value = Number(d.concurrency_oss) || vo
      if (d.max_concurrency_local != null) ocrMaxLocal.value = Number(d.max_concurrency_local) || capL
      if (d.max_concurrency_oss != null) ocrMaxOss.value = Number(d.max_concurrency_oss) || capO
    }
    localStorage.setItem(LS_OCR_CONCURRENCY_LOCAL, String(ocrConcurrencyLocal.value))
    localStorage.setItem(LS_OCR_CONCURRENCY_OSS, String(ocrConcurrencyOss.value))
    ElMessage.success(
      `已保存：个人上传=${ocrConcurrencyLocal.value}（≤${ocrMaxLocal.value}），OSS=${ocrConcurrencyOss.value}（≤${ocrMaxOss.value}）`,
    )
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    ocrSaveLoading.value = false
  }
}

function openClearOcrQueueDialog() {
  clearOcrLocal.value = true
  clearOcrOss.value = true
  clearOcrProcessing.value = false
  clearOcrFailed.value = false
  clearOcrQueueVisible.value = true
}

function resetClearOcrQueueForm() {
  clearOcrQueueLoading.value = false
}

async function submitClearOcrQueue() {
  if (!clearOcrLocal.value && !clearOcrOss.value && !clearOcrProcessing.value && !clearOcrFailed.value) {
    ElMessage.warning('请至少勾选一项')
    return
  }
  clearOcrQueueLoading.value = true
  try {
    const res = await postOcrQueueClearAPI({
      clear_local: clearOcrLocal.value,
      clear_oss: clearOcrOss.value,
      clear_processing: clearOcrProcessing.value,
      clear_failed: clearOcrFailed.value,
    })
    if (res?.code === 200 && res.data) {
      const d = res.data
      ElMessage.success(
        `已清空：LOCAL ${d.cleared_local ?? 0} 条，OSS ${d.cleared_oss ?? 0} 条，识别中标记 ${d.cleared_processing ?? 0}，失败队列 ${d.cleared_failed ?? 0}`,
      )
      clearOcrQueueVisible.value = false
      await refreshAll()
    } else {
      ElMessage.error(res?.msg || res?.message || '清空失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || e?.message || '清空失败')
  } finally {
    clearOcrQueueLoading.value = false
  }
}

async function confirmRequeueLocal(space) {
  const isPub = space === 'PUBLIC'
  try {
    await ElMessageBox.confirm(
      '将对当前分栏空间内、您有权限且全文仍为空的「本地上传」文件重新加入 OCR 队列（不含 OSS）。是否继续？',
      '重新识别',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  if (isPub) requeueLocalLoadingPublic.value = true
  else requeueLocalLoadingPersonal.value = true
  try {
    const res = await postRequeueLocalEmptyAPI({ space })
    if (res?.code === 200 && res.data) {
      const d = res.data
      let msg = `入队 ${d.enqueued ?? 0} 条`
      if (d.skipped_already_processing) msg += `，跳过识别中 ${d.skipped_already_processing}`
      if (d.skipped_already_in_queue) msg += `，跳过已在队列 ${d.skipped_already_in_queue}`
      if (d.skipped_invalid) msg += `，跳过无效元数据 ${d.skipped_invalid}`
      if (d.push_failed) msg += `，入队失败 ${d.push_failed}`
      if (d.truncated) msg += `（仅处理前 ${d.max_files} 条，可再次点击）`
      ElMessage.success(msg)
      await refreshAll()
      if (isPub) await loadPublicTable()
      else await loadPersonalTable()
    } else {
      ElMessage.error(res?.msg || res?.message || '操作失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || e?.message || '操作失败')
  } finally {
    requeueLocalLoadingPublic.value = false
    requeueLocalLoadingPersonal.value = false
  }
}

async function confirmRequeueByIds(space) {
  const isPub = space === 'PUBLIC'
  const selected = isPub ? selectedPublicRows.value : selectedPersonalRows.value
  const fileIds = selected.map((r) => r.file_id).filter(Boolean)
  if (!fileIds.length) {
    ElMessage.warning('请至少勾选一条记录')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将把勾选的 ${fileIds.length} 条记录从失败队列中重新加入 OCR 队列。是否继续？`,
      '重新开始识别',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  requeueByIdsLoading.value = true
  try {
    const res = await postRequeueByFileIdsAPI({ file_ids: fileIds, space })
    if (res?.code === 200 && res.data) {
      const d = res.data
      let msg = `入队 ${d.enqueued ?? 0} 条`
      if (d.not_found) msg += `，未找到 ${d.not_found}`
      if (d.max_retry_exceeded) msg += `，超最大重试 ${d.max_retry_exceeded}`
      if (d.push_failed) msg += `，入队失败 ${d.push_failed}`
      ElMessage.success(msg)
      // 清空勾选
      if (isPub) selectedPublicRows.value = []
      else selectedPersonalRows.value = []
      await refreshAll()
      if (isPub) await loadPublicTable()
      else await loadPersonalTable()
    } else {
      ElMessage.error(res?.msg || res?.message || '操作失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.msg || e?.message || '操作失败')
  } finally {
    requeueByIdsLoading.value = false
  }
}

const polling = ref(false)
let pollTimer = null
const togglePoll = () => {
  polling.value = !polling.value
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (polling.value) {
    pollTimer = setInterval(() => {
      refreshAll()
    }, 8000)
  }
}

onMounted(async () => {
  updateTableHeights()
  window.addEventListener('resize', updateTableHeights)
  loadSavedPageSizes()
  await loadOcrConcurrency()
  await refreshAll()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('resize', updateTableHeights)
})
</script>

<style scoped>
/* 限制在视口内并显示纵向滚动条（避免外层 overflow:hidden 时无法滚动） */
.fcp-proto--full {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 12px 0 16px;
  box-sizing: border-box;
  max-height: calc(100vh - 64px);
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(165deg, #f0f4f8 0%, #e8eef5 45%, #f5f7fa 100%);
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  padding: 0 8px;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px 0;
}
.clear-queue-tip {
  font-size: 13px;
  color: #606266;
  margin: 0 0 12px;
  line-height: 1.55;
}
.clear-queue-checks {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.page-desc {
  font-size: 13px;
  color: #909399;
  margin: 0;
  max-width: 900px;
  line-height: 1.5;
}
.page-desc code {
  font-size: 12px;
  background: #f4f4f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.header-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ocr-setting {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}
.ocr-setting-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ocr-setting-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.ocr-input {
  width: 110px;
}
.two-col {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  margin-left: 0 !important;
  margin-right: 0 !important;
  width: 100%;
}
.two-col :deep(> .el-col) {
  display: flex;
  flex-direction: column;
}
.colon-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: min(76vh, 900px);
  box-sizing: border-box;
  padding: 12px 4px 16px;
  border-radius: 0;
  border-left: none;
  border-right: none;
  background: #fff;
  box-shadow: none;
  border-top: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
}
.colon-table-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 0;
  margin-top: 0;
}
.colon-table-stack .proto-table {
  flex: 0 0 auto;
}
.colon-public {
  border-top: 3px solid #409eff;
}
.colon-personal {
  border-top: 3px solid #67c23a;
}
.colon-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.colon-title-text {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.stat-row-five {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
@media (max-width: 1200px) {
  .stat-row-five {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 500px) {
  .stat-row-five {
    grid-template-columns: repeat(2, 1fr);
  }
}
.stat-row-five .stat-card {
  padding: 10px 8px;
}
.stat-row-five .stat-card .value {
  font-size: 18px;
}
.stat-row-five .stat-card .label {
  font-size: 11px;
  margin-bottom: 4px;
}
.stat-card {
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #fafafa;
}
.stat-card .label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-card .value {
  font-size: 26px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.stat-card.upload .value {
  color: #e6a23c;
}
.stat-card.pending .value {
  color: #e6a23c;
}
.stat-card.processing .value {
  color: #409eff;
}
.stat-card.ready .value {
  color: #67c23a;
}
.stat-card.fail .value {
  color: #f56c6c;
}
.oss-card {
  margin-bottom: 12px;
}
.oss-card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.oss-card-title {
  font-weight: 600;
}
.oss-card-sub {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
  margin-left: 8px;
}
.oss-label {
  font-size: 12px;
  color: #606266;
}
.oss-num {
  font-size: 20px;
  font-weight: 600;
  color: #409eff;
  margin-top: 4px;
}
.oss-num.queue-len {
  color: #67c23a;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.toolbar .grow {
  flex: 1;
  min-width: 100px;
}
.file-name-cell {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.file-name-cell .ico {
  line-height: 22px;
}
.file-name-cell .name {
  font-weight: 500;
  color: #303133;
}
.sub-row {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.bucket-text {
  font-size: 12px;
  color: #606266;
  font-family: ui-monospace, monospace;
}
.timeline-cell {
  font-size: 12px;
  line-height: 1.45;
  color: #606266;
}
.timeline-cell :deep(.tl-line) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}
.timeline-cell :deep(.tl-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dcdfe6;
  flex-shrink: 0;
}
.timeline-cell :deep(.tl-dot.ok) {
  background: #67c23a;
}
.timeline-cell :deep(.tl-dot.run) {
  background: #e6a23c;
}
.timeline-cell :deep(.tl-dot.bad) {
  background: #f56c6c;
}
.timeline-cell :deep(.tl-t) {
  color: #909399;
  min-width: 2em;
}
.timeline-cell :deep(.tl-p) {
  color: #409eff;
  font-weight: 500;
}
.timeline-cell :deep(.tl-p.done) {
  color: #67c23a;
}
.timeline-cell :deep(.tl-p.skip) {
  color: #c0c4cc;
  font-weight: normal;
  font-size: 11px;
}
.timeline-cell :deep(.tl-ft) {
  color: #303133;
}
.proto-table {
  width: 100%;
}
.pager-wrap {
  margin-top: 12px;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.pager-wrap :deep(.el-pagination) {
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 8px;
}
.content-dialog-body {
  min-height: 120px;
}
.content-pre {
  margin: 0;
  padding: 12px;
  max-height: 70vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.55;
  color: #303133;
  background: #f8f9fb;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
</style>
