<template>
  <el-dialog
    :model-value="modelValue"
    title="议题详情"
    width="95vw"
    top="5vh"
    :close-on-click-modal="false"
    :draggable="false"
    @update:model-value="handleClose"
    class="topic-detail-dialog"
    @close="handleClose"
  >
    <div
      ref="layoutRef"
      class="topic-detail-layout"
      :style="layoutGridStyle"
    >
      <!-- 左侧：议题信息 + 内容概括 -->
      <div class="topic-detail-left">
        <section class="topic-info-section">
          <el-card class="topic-info-card">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="议题名称">
                {{ topicData?.topicName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="会议名称">
                {{ topicData?.meetingName || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="会议日期">
                {{ topicData?.meetingDate || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="涉及金额">
                {{ formatMoney(topicData?.money) }}
              </el-descriptions-item>
              <el-descriptions-item label="参会人员">
                {{ formatAttendees(topicData?.attendees) }}
              </el-descriptions-item>
              <el-descriptions-item label="列席人员">
                {{ formatAttendees(topicData?.observers) }}
              </el-descriptions-item>
              <el-descriptions-item label="源文件" :span="2">
                {{ topicData?.sourceFile || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </section>

        <section class="topic-content-section">
          <h4>内容概括</h4>
          <el-input
            type="textarea"
            :rows="6"
            readonly
            :model-value="topicData?.topicContent || '暂无内容'"
            placeholder="暂无议题内容"
          />
        </section>
      </div>

      <div
        class="layout-splitter"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整左右区域宽度"
        @mousedown="onSplitterMouseDown"
      />

      <!-- 右侧：原文预览（支持全屏） -->
      <section
        ref="previewPanelRef"
        class="topic-detail-right file-preview-section preview-panel-root"
      >
        <div class="file-preview-toolbar">
          <h4>原文预览</h4>
          <el-button
            type="primary"
            link
            :icon="FullScreen"
            @click="togglePreviewFullscreen"
          >
            {{ isPreviewFullscreen ? '退出全屏' : '全屏预览' }}
          </el-button>
        </div>
        <div class="file-preview-body">
          <div v-if="previewLoading" class="preview-state-wrap">
            <el-icon class="is-loading" :size="36"><Loading /></el-icon>
            <p class="preview-state-tip">加载中...</p>
          </div>
          <div
            class="preview-embed"
            v-show="!previewLoading && previewFileType && previewFileData"
          >
            <FilePreview
              v-if="previewFileType && previewFileData"
              :file-type="previewFileType"
              :file-name="previewFileName"
              :file-data="previewFileData"
            />
          </div>
          <el-empty
            v-if="!previewLoading && !(previewFileType && previewFileData)"
            description="无法加载文件预览"
            :image-size="100"
          />
        </div>
      </section>
    </div>

    
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, FullScreen } from '@element-plus/icons-vue'
import FilePreview from '@/components/FilePreview.vue'
import { previewFileAPI } from '@/api/fileManager.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  topicData: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const previewLoading = ref(false)
const previewFileName = ref('')
const previewFileType = ref('')
const previewFileData = ref('')
const previewPanelRef = ref(null)
const layoutRef = ref(null)
const isPreviewFullscreen = ref(false)

/** 左侧区域占「左右两栏 + 分隔条」总宽度减去分隔条后的比例，0.5 为均分 */
const splitRatio = ref(0.5)
const SPLITTER_PX = 8
const MIN_SPLIT_RATIO = 0.22
const MAX_SPLIT_RATIO = 0.78

const layoutGridStyle = computed(() => ({
  display: 'grid',
  gridTemplateColumns: `${splitRatio.value}fr ${SPLITTER_PX}px ${1 - splitRatio.value}fr`,
  gap: 0,
  alignItems: 'stretch',
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
}))

let splitDragCleanup = null

const onSplitterMouseDown = (e) => {
  e.preventDefault()
  const layout = layoutRef.value
  if (!layout) return

  const rect = layout.getBoundingClientRect()
  const layoutWidth = rect.width
  if (layoutWidth <= SPLITTER_PX) return

  const startX = e.clientX
  const startRatio = splitRatio.value

  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10000;cursor:col-resize;background:transparent;'
  document.body.appendChild(overlay)

  const onMove = (ev) => {
    const delta = ev.clientX - startX
    const deltaRatio = delta / (layoutWidth - SPLITTER_PX)
    splitRatio.value = Math.min(
      MAX_SPLIT_RATIO,
      Math.max(MIN_SPLIT_RATIO, startRatio + deltaRatio),
    )
  }

  const onUp = () => {
    overlay.remove()
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    splitDragCleanup = null
  }

  splitDragCleanup = onUp
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

let _mounted = true

const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement

const handlePreviewFullscreenChange = () => {
  isPreviewFullscreen.value = getFullscreenElement() === previewPanelRef.value
}

const enterPreviewFullscreen = () => {
  const el = previewPanelRef.value
  if (!el) return
  if (el.requestFullscreen) return el.requestFullscreen()
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen()
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen()
  if (el.msRequestFullscreen) return el.msRequestFullscreen()
}

const exitPreviewFullscreen = () => {
  if (document.exitFullscreen) return document.exitFullscreen()
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen()
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen()
  if (document.msExitFullscreen) return document.msExitFullscreen()
}

const togglePreviewFullscreen = async () => {
  try {
    if (isPreviewFullscreen.value) {
      await exitPreviewFullscreen()
    } else {
      await enterPreviewFullscreen()
    }
  } catch (e) {
    console.error(e)
    ElMessage.warning('全屏不可用，请检查浏览器权限或稍后重试')
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', handlePreviewFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handlePreviewFullscreenChange)
  document.addEventListener('mozfullscreenchange', handlePreviewFullscreenChange)
  document.addEventListener('msfullscreenchange', handlePreviewFullscreenChange)
})

onUnmounted(() => {
  _mounted = false
  splitDragCleanup?.()
  if (getFullscreenElement() === previewPanelRef.value) {
    exitPreviewFullscreen()
  }
  document.removeEventListener('fullscreenchange', handlePreviewFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handlePreviewFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handlePreviewFullscreenChange)
  document.removeEventListener('msfullscreenchange', handlePreviewFullscreenChange)
})

const getPreviewFileType = (fileName) => {
  const ext = (fileName || '').split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (['xlsx', 'xlsm'].includes(ext)) return ext
  if (ext === 'xls') return 'xls'
  if (ext === 'csv') return 'csv'
  if (['txt', 'md', 'log'].includes(ext)) return 'txt'
  return null
}

const loadFilePreview = async () => {
  const docId = props.topicData?.sourceDocumentId
  const fileName = props.topicData?.sourceFile || ''
  if (!docId) {
    previewFileType.value = ''
    previewFileData.value = ''
    return
  }
  const fileType = getPreviewFileType(fileName)
  if (!fileType) {
    previewFileType.value = ''
    previewFileData.value = ''
    return
  }
  previewLoading.value = true
  previewFileName.value = fileName
  previewFileType.value = ''
  previewFileData.value = ''
  try {
    const res = await previewFileAPI(docId)
    if (!_mounted) return
    if (res.code !== 200 || !res.data?.preview_url) {
      ElMessage.error(res.msg || '获取预览链接失败')
      return
    }
    previewFileType.value = fileType
    previewFileData.value = res.data.preview_url
  } catch (error) {
    if (!_mounted) return
    console.error('文件预览失败:', error)
    ElMessage.error('文件预览加载失败')
  } finally {
    if (_mounted) previewLoading.value = false
  }
}

const formatMoney = (moneyStr) => {
  if (!moneyStr) return '-'

  const parts = String(moneyStr)
    .split('|')
    .map((v) => v.trim())
    .filter((v) => v)

  const amounts = parts
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))

  if (amounts.length === 0) return '-'
  if (amounts.length === 1) return `${amounts[0]}万元`

  const total = amounts.reduce((sum, v) => sum + v, 0)
  return `${total}万元 (${amounts.join('+')})`
}

const formatAttendees = (attendees) => {
  // 处理空值
  if (!attendees) return '-'
  // 处理数组格式（兼容旧数据）
  if (Array.isArray(attendees)) {
    return attendees.length > 0 ? attendees.join('|') : '-'
  }
  // 尝试解析JSON字符串格式
  if (typeof attendees === 'string' && attendees.startsWith('[')) {
    try {
      const parsed = JSON.parse(attendees)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join('|')
      }
      return '-'
    } catch {
      // 解析失败，继续处理原字符串
    }
  }
  // 处理普通字符串格式（已转换好的"|"分隔格式）
  const str = String(attendees).trim()
  return str || '-'
}

const handleClose = () => {
  if (isPreviewFullscreen.value) {
    exitPreviewFullscreen()
  }
  emit('update:modelValue', false)
  emit('close')
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      loadFilePreview()
    } else {
      previewFileType.value = ''
      previewFileData.value = ''
      if (getFullscreenElement() === previewPanelRef.value) {
        exitPreviewFullscreen()
      }
    }
  },
)
</script>

<style scoped lang="scss">
.topic-detail-layout {
  min-height: 0;
  box-sizing: border-box;
}

.topic-detail-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.layout-splitter {
  position: relative;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    background: #dcdfe6;
    border-radius: 1px;
    transition: background 0.15s;
  }

  &:hover::before {
    background: #409eff;
  }
}

.topic-detail-right {
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.topic-info-section {
  flex-shrink: 0;
  margin-bottom: 0;

  .topic-info-card {
    border-radius: 4px;

    :deep(.el-descriptions) {
      .el-descriptions__label {
        width: 120px;
        background-color: #fafafa;
        font-weight: 600;
      }

      .el-descriptions__content {
        color: #303133;
      }
    }
  }
}

.topic-content-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  :deep(.el-input) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  :deep(.el-textarea) {
    flex: 1;
    min-height: 0;

    .el-textarea__inner {
      font-family: inherit;
      line-height: 1.8;
      background-color: #f9f9f9;
      height: 100%;
      min-height: 160px;
    }
  }
}

.file-preview-section {
  .file-preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
    margin-bottom: 12px;
  }

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin: 0;
  }

  .file-preview-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .preview-state-wrap {
    flex: 1;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #909399;
  }

  .preview-state-tip {
    margin-top: 12px;
    margin-bottom: 0;
  }

  // 限制预览区高度，去除 FilePreview 内部 el-card 的多余层次感
  .preview-embed {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    border: 1px solid #e4e7ed;
    border-radius: 4px;

    :deep(.file-preview-container) {
      height: 100%;

      .el-card {
        height: 100%;
        border: none;
        box-shadow: none;
        border-radius: 0;

        .el-card__body {
          height: 100%;
          padding: 0;

          .preview-wrapper {
            height: 100%;
            overflow: auto;

            iframe {
              min-height: unset !important;
              height: 100% !important;
            }
          }
        }
      }
    }
  }

  :deep(.el-empty) {
    flex: 1;
    min-height: 200px;
    padding: 24px 0;
  }
}

.preview-panel-root:fullscreen {
  background: #fff;
  padding: 16px;
  box-sizing: border-box;

  .file-preview-body {
    min-height: 0;
  }

  .preview-embed {
    min-height: 0;
  }
}

.preview-panel-root:-webkit-full-screen {
  background: #fff;
  padding: 16px;
  box-sizing: border-box;
}

.preview-panel-root:-moz-full-screen {
  background: #fff;
  padding: 16px;
  box-sizing: border-box;
}

.preview-panel-root:-ms-fullscreen {
  background: #fff;
  padding: 16px;
  box-sizing: border-box;
}

:deep(.el-dialog) {
  .el-dialog__header {
    border-bottom: 1px solid #e4e7ed;
    padding: 16px 20px;
    cursor: default !important;

    .el-dialog__headerbtn {
      width: 32px;
      height: 32px;
      top: 10px;
      right: 12px;

      .el-dialog__close {
        font-size: 20px;
        color: #606266;

        &:hover {
          color: #303133;
        }
      }
    }
  }

  .el-dialog__body {
    padding: 20px;
    height: 75vh;
    overflow-y: auto;
  }

  .el-dialog__footer {
    border-top: 1px solid #e4e7ed;
    padding: 12px 20px;
  }
}
</style>


<style>

.topic-detail-dialog .el-dialog__body {
  padding: 0;
  height: calc(100vh - 165px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.topic-detail-dialog .topic-detail-layout {
  flex: 1;
  min-height: 0;
  padding: 16px 20px;
}
</style>