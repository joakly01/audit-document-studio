<template>
  <el-dialog
    v-model="dialogVisible"
    title="合并导出任务详情"
    width="780px"
    destroy-on-close
    class="merge-export-detail-dialog"
    @closed="handleClosed"
  >
    <div v-if="task" class="merge-export-detail">
      <el-card shadow="never" class="detail-card">
        <template #header>
          <span class="card-title">基本信息</span>
        </template>
        <div v-if="task && Number(task.task_status) === 2" class="detail-actions">
          <el-button type="primary" size="small" :loading="refreshLoading" @click="handleRefreshUrls">
            刷新下载链接
          </el-button>
        </div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="任务ID">{{ task.task_id }}</el-descriptions-item>
          <el-descriptions-item label="任务状态">
            <el-tag :type="statusTagType" size="small">{{ statusLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="任务名称" :span="2">{{ task.task_name }}</el-descriptions-item>
          <el-descriptions-item label="调用工具">{{ task.agent_name || '—' }}</el-descriptions-item>
          <el-descriptions-item label="源任务数">{{ sourceTasks.length }} 条</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{ task.created_at || '—' }}</el-descriptions-item>
          <el-descriptions-item label="任务备注" :span="2">
            <span style="white-space: pre-wrap; word-break: break-word;">{{ task.task_remark || '—' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="sourceTasks.length" class="source-tasks-block">
          <div class="block-label">源任务</div>
          <div class="source-tags">
            <el-popover
              v-for="s in sourceTasks"
              :key="s.task_id"
              placement="top"
              :width="320"
              trigger="hover"
            >
              <template #reference>
                <el-tag type="info" effect="plain" class="source-tag">
                  {{ truncate(s.task_name || s.task_id, 28) }}
                </el-tag>
              </template>
              <div class="source-popover">
                <div><strong>任务ID</strong>：{{ s.task_id }}</div>
                <div><strong>名称</strong>：{{ s.task_name || '—' }}</div>
                <div><strong>工具</strong>：{{ s.agent_name || '—' }}</div>
                <div><strong>文件数</strong>：{{ s.file_total_count ?? '—' }}</div>
              </div>
            </el-popover>
          </div>
        </div>
      </el-card>

      <el-card v-if="config" shadow="never" class="detail-card">
        <template #header>
          <span class="card-title">导出配置</span>
        </template>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="导出文件" :span="2">
            <el-tag v-for="f in exportFileTags" :key="f" size="small" class="cfg-tag" effect="plain">
              {{ f }}
            </el-tag>
            <span v-if="!exportFileTags.length">—</span>
          </el-descriptions-item>
          <el-descriptions-item label="字段映射维度">{{ mapScopeLabel }}</el-descriptions-item>
          <el-descriptions-item label="该维度语言">{{ scopeLangLabel }}</el-descriptions-item>
          <el-descriptions-item v-if="config.export_files?.includes('excel')" label="Excel 每文件最多行数">
            {{ config.excel_rows_per_file ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="config.export_files?.includes('sql')" label="SQL 每文件最多行数">
            {{ config.sql_rows_per_file ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="下载链接有效期（天）">{{ config.file_expire_days ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="对象保留（只读说明）" :span="2">
            导出文件保留30天，与预签名有效期无关。
          </el-descriptions-item>
          <el-descriptions-item v-if="mergeProgressHint" label="执行进度" :span="2">
            {{ mergeProgressHint }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="fieldMappingRows.length" class="mapping-block">
          <div class="block-label">
            字段映射（{{ mapScopeLabel }}）
            <el-button text type="primary" size="small" @click="mappingExpanded = !mappingExpanded">
              {{ mappingExpanded ? '收起' : '展开明细' }}
            </el-button>
          </div>
          <el-collapse-transition>
            <el-table
              v-show="mappingExpanded"
              :data="fieldMappingRows"
              border
              stripe
              size="small"
              max-height="240"
              class="mapping-table"
            >
              <el-table-column type="index" label="序号" width="56" />
              <el-table-column label="英文" min-width="120">
                <template #default="{ row }">{{ row[mapScopeKey]?.en ?? '' }}</template>
              </el-table-column>
              <el-table-column label="中文" min-width="120">
                <template #default="{ row }">{{ row[mapScopeKey]?.zh ?? '' }}</template>
              </el-table-column>
              <el-table-column prop="template_name" label="模板名称" min-width="100" show-overflow-tooltip />
            </el-table>
          </el-collapse-transition>
        </div>
      </el-card>

      <el-card shadow="never" class="detail-card">
        <template #header>
          <div class="result-files-header">
            <span class="card-title">结果文件（MinIO 预签名下载链接，有效期以存储服务配置为准）</span>
            <el-button
              v-if="task && Number(task.task_status) === 2 && resultFiles.length"
              type="primary"
              size="small"
              :loading="zipLoading"
              @click="handleDownloadAllZip"
            >
              一键下载全部（ZIP）
            </el-button>
          </div>
        </template>
        <el-table
          v-if="resultFiles.length"
          :data="resultFiles"
          border
          size="small"
          empty-text="暂无结果文件"
        >
          <el-table-column type="index" label="#" width="48" />
          <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="formatRowTagType(row.format)">{{ formatRowLabel(row.format) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
          </el-table-column>
          <el-table-column label="下载链接" min-width="200">
            <template #default="{ row }">
              <el-link type="primary" :underline="false" @click.prevent="handleDownload(row)">
                {{ linkDisplayText(row.download_url) }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleDownload(row)">下载</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无结果文件（任务未完成或未刷新）" :image-size="80" />
      </el-card>

      <el-alert
        v-if="task && Number(task.task_status) === 3"
        type="error"
        :closable="false"
        show-icon
        title="任务失败，可在下方重试重新生成并上传结果"
        style="margin-top: 12px;"
      />
    </div>

    <template #footer>
      <el-button v-if="task && Number(task.task_status) === 3" type="danger" :loading="retryLoading" @click="handleRetry">
        重试
      </el-button>
      <el-button type="primary" @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  refreshMergeExportUrlsAPI,
  retryMergeExportAPI,
  downloadMergeExportZipAPI
} from '@/api/task.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'action-done'])

const mappingExpanded = ref(true)
const refreshLoading = ref(false)
const retryLoading = ref(false)
const zipLoading = ref(false)

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v)
})

const task = computed(() => props.task)
const config = computed(() => task.value?.merge_export_config || null)
const sourceTasks = computed(() => task.value?.merge_source_tasks || [])
const resultFiles = computed(() => task.value?.result_files || [])
const mapScopeKey = computed(() => config.value?.mapping_edit_scope || 'export')

const mapScopeLabel = computed(() => {
  const s = mapScopeKey.value
  if (s === 'export') return '导出字段'
  if (s === 'comment') return '注释字段'
  return 'Excel 表头'
})

const scopeLangLabel = computed(() => {
  const s = mapScopeKey.value
  const c = config.value
  if (!c) return '—'
  if (s === 'export') return c.field_lang === 'en' ? '英文' : '中文'
  if (s === 'comment') return c.comment_field_lang === 'en' ? '英文' : '中文'
  return c.excel_header_lang === 'en' ? '英文' : '中文'
})

const exportFileTags = computed(() => {
  const files = config.value?.export_files || []
  const out = []
  if (files.includes('excel')) out.push('合并结果（Excel）')
  if (files.includes('sql')) out.push('神通数据库（建表 + INSERT）')
  return out
})

const fieldMappingRows = computed(() => config.value?.field_mapping || [])

const mergeProgressHint = computed(() => {
  const mp = task.value?.merge_progress
  if (!mp || typeof mp !== 'object') return ''
  const phase = mp.phase || ''
  const cur = mp.current_part || ''
  const tf = Number(mp.total_files || 0)
  const df = Number(mp.done_files || 0)
  if (tf > 0) {
    return `${cur || phase || '进行中'}（${df}/${tf}）`
  }
  return cur || phase || ''
})

const statusLabel = computed(() => {
  const ts = Number(task.value?.task_status)
  if (ts === 1) return '进行中'
  if (ts === 2) return '已完成'
  if (ts === 3) return '失败'
  if (ts === 0) return '未开始'
  return '—'
})

const statusTagType = computed(() => {
  const ts = Number(task.value?.task_status)
  if (ts === 1) return 'primary'
  if (ts === 2) return 'success'
  if (ts === 3) return 'danger'
  return 'info'
})

const formatRowLabel = (format) => {
  if (format === 'excel') return 'Excel'
  if (format === 'sql_ddl') return 'SQL-DDL'
  if (format === 'sql_insert') return 'SQL-INSERT'
  return format || '—'
}

const formatRowTagType = (format) => {
  if (format === 'excel') return 'success'
  if (format === 'sql_ddl') return 'warning'
  if (format === 'sql_insert') return 'info'
  return ''
}

const formatFileSize = (size) => {
  if (size == null || size === '') return '0 B'
  const num = Number(size)
  if (Number.isNaN(num)) return String(size)
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const truncate = (str, max) => {
  const s = String(str || '')
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

const linkDisplayText = (url) => {
  if (!url) return '—'
  const u = String(url)
  if (u.startsWith('blob:')) return '本地下载链接（本地调试）'
  return truncate(u, 56)
}

const handleDownload = (row) => {
  if (!row?.download_url) {
    ElMessage.warning('无可下载地址')
    return
  }
  const link = document.createElement('a')
  link.href = row.download_url
  link.download = row.filename || 'download'
  link.rel = 'noopener'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success('已开始下载')
}

const handleClosed = () => {
  mappingExpanded.value = true
}

const handleRefreshUrls = async () => {
  const id = task.value?.task_id
  if (!id) return
  refreshLoading.value = true
  try {
    const res = await refreshMergeExportUrlsAPI(id)
    if (res?.code === 200) {
      ElMessage.success(res.message || '链接已刷新')
      emit('action-done')
    } else {
      ElMessage.error(res?.message || '刷新失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '刷新失败')
  } finally {
    refreshLoading.value = false
  }
}

const handleRetry = async () => {
  const id = task.value?.task_id
  if (!id) return
  retryLoading.value = true
  try {
    const res = await retryMergeExportAPI(id)
    if (res?.code === 200) {
      ElMessage.success(res.message || '已重新排队')
      dialogVisible.value = false
      emit('action-done')
    } else {
      ElMessage.error(res?.message || '重试失败')
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || e?.message || '重试失败')
  } finally {
    retryLoading.value = false
  }
}

const parseBlobErrorMessage = async (blob) => {
  if (!(blob instanceof Blob)) return ''
  try {
    const text = await blob.text()
    const j = JSON.parse(text)
    return j?.detail || j?.message || text || ''
  } catch {
    return ''
  }
}

const handleDownloadAllZip = async () => {
  const id = task.value?.task_id
  if (!id) return
  zipLoading.value = true
  try {
    const response = await downloadMergeExportZipAPI(id)
    const data = response && (response.data !== undefined ? response.data : response)
    const ctype = String(response?.headers?.['content-type'] || '').toLowerCase()
    if (data instanceof Blob && (ctype.includes('application/json') || data.type === 'application/json')) {
      const msg = await parseBlobErrorMessage(data)
      ElMessage.error(msg || '打包下载失败')
      return
    }
    if (!(data instanceof Blob) || data.size === 0) {
      ElMessage.error('打包下载失败：未返回有效文件')
      return
    }
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    const contentDisposition = response?.headers?.['content-disposition']
    let downloadFilename = ''
    if (contentDisposition) {
      const star = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i)
      if (star?.[1]) {
        downloadFilename = decodeURIComponent(star[1].trim())
      } else {
        const m = contentDisposition.match(/filename="?([^";\n]+)"?/i)
        if (m?.[1]) downloadFilename = decodeURIComponent(m[1].trim())
      }
    }
    const safeName = (task.value?.task_name || 'merge_export').replace(/[\\/:*?"<>|]/g, '_')
    link.download = downloadFilename || `${safeName}_merge_export.zip`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 300)
    ElMessage.success('已开始下载 ZIP')
  } catch (e) {
    const errData = e?.response?.data
    let msg = e?.response?.data?.detail || e?.message || '打包下载失败'
    if (errData instanceof Blob) {
      const parsed = await parseBlobErrorMessage(errData)
      if (parsed) msg = parsed
    }
    ElMessage.error(msg)
  } finally {
    zipLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.merge-export-detail {
  .detail-card {
    margin-bottom: 16px;
    &:last-child {
      margin-bottom: 0;
    }
  }
  .card-title {
    font-weight: 600;
    font-size: 15px;
  }
  .source-tasks-block,
  .mapping-block {
    margin-top: 16px;
  }
  .block-label {
    font-size: 13px;
    color: #606266;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .source-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .source-tag {
    max-width: 100%;
    cursor: default;
  }
  .source-popover {
    font-size: 12px;
    line-height: 1.6;
    word-break: break-all;
  }
  .cfg-tag {
    margin-right: 8px;
    margin-bottom: 4px;
  }
  .mapping-table {
    width: 100%;
  }
  .detail-actions {
    margin-bottom: 12px;
  }
  .result-files-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
