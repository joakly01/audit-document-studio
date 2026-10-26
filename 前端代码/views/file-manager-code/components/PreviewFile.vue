<template>
  <div class="preview-file-wrapper">
    <!-- 顶部导航栏：与左右栏 ocr-column-head 同高单行，操作按钮与插槽按钮同一行 -->
    <div class="viewer-header ocr-column-head">
      <div class="page-controls">
        <el-button :icon="ZoomOut" circle size="small" @click="zoomOut" title="缩小" :disabled="pdfScale <= 0.5" />
        <el-button :icon="ZoomIn" circle size="small" @click="zoomIn" title="放大" :disabled="pdfScale >= 3" />
        <el-button :icon="FullScreen" circle size="small" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'" />
        <el-button :icon="Refresh" circle size="small" @click="handleRefresh" />
        <!-- <el-button :icon="Download" circle size="small" @click="handleDownload" /> -->
        <!-- <el-button v-if="showClearHighlight && currentHighlightedField" type="danger" size="small" @click="handleClearHighlight" plain>
          清除高亮
        </el-button> -->
      </div>
      <!-- 自定义按钮插槽：紧跟操作按钮同一行 -->
      <div v-if="$slots.headerActions" class="header-actions-slot">
        <slot name="headerActions"></slot>
      </div>
    </div>

    <!-- 文档预览区域 -->
    <div class="document-area">
      <div class="document-preview" ref="previewRef">
        <!-- PDF文档预览：外层滚动，内层缩放，保证多页可上下滚动 -->
        <div v-if="previewFile && previewFile.type === 'pdf'" class="pdf-container-wrapper" ref="pdfContainerWrapperRef">
          <!-- Chrome 77 兼容模式：使用 iframe 预览 -->
          <div v-if="isOldChrome && pdfSource" class="pdf-container pdf-container--scroll">
            <iframe
              :src="pdfSource"
              class="pdf-iframe"
              frameborder="0"
              @load="handlePdfRendered"
              @error="handlePdfError"
            />
          </div>
          <!-- 正常模式：使用 vue-office-pdf -->
          <div v-else v-loading="pdfLoading || pdfConverting" class="pdf-container pdf-container--scroll">
            <div
              v-if="pdfSource"
              class="pdf-scale-box"
              :style="{ transform: `scale(${pdfScale})`, width: pdfScale ? `${100 / pdfScale}%` : '100%' }"
            >
              <vue-office-pdf
                :key="`pdf-${pdfSource}-${previewFile?.fileId || ''}`"
                ref="pdfViewerRef"
                :src="pdfSource"
                class="pdf-office"
                @rendered="handlePdfRendered"
                @error="handlePdfError"
              />
            </div>
            <div v-else-if="pdfConverting" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在生成 PDF 预览，请稍候...</p>
            </div>
            <div v-else-if="pdfLoading" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在加载PDF文档...</p>
            </div>
            <div v-else class="empty-container">
              <el-empty description="请选择PDF文件" />
            </div>
          </div>
        </div>

        <!-- Word文档预览 -->
        <div v-else-if="previewFile && (previewFile.type === 'docx' || previewFile.type === 'doc')" class="docx-container-wrapper">
          <div v-loading="docxLoading" class="docx-container">
            <!-- DOCX文件或DOC转换后的文件使用vue-office-docx -->
            <vue-office-docx
              v-if="docxSource && (previewFile.type === 'docx' || (previewFile.type === 'doc' && docxSource))"
              :src="docxSource"
              style="width: 100%; height: 100%;"
              @error="handleDocxError"
            />
            <!-- DOC文件使用Microsoft Office Online Viewer -->
            <iframe
              v-else-if="previewFile.type === 'doc' && docPreviewUrl && !docxSource"
              :src="docPreviewUrl"
              class="doc-preview-iframe"
              style="width: 100%; height: 100%; border: none;"
              frameborder="0"
            />
            <div
              v-else-if="previewFile.type === 'doc' && !docPreviewUrl && !docxSource"
              ref="docPreviewContainerRef"
              class="docx-preview-container"
              style="width: 100%; height: 100%; overflow: auto; padding: 20px; background: #fff;"
            />
            <div v-else-if="docxLoading" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在加载Word文档...</p>
            </div>
            <div v-else class="empty-container">
              <el-empty description="请选择Word文件" />
            </div>
          </div>
        </div>

        <!-- Excel文档预览：高度铺满，由 x-spreadsheet 内部滚动（勿让外层 overflow 抢走滚动） -->
        <div v-else-if="previewFile && (previewFile.type === 'xlsx' || previewFile.type === 'xlsm' || previewFile.type === 'xls')" class="excel-container-wrapper">
          <div v-loading="excelLoading" class="excel-container">
            <vue-office-excel
              v-if="excelSource"
              :src="excelSource"
              class="excel-office"
              :options="excelPreviewOptions"
              @rendered="handleExcelRendered"
              @error="handleExcelError"
            />
            <div v-else-if="excelLoading" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在加载Excel文档...</p>
            </div>
            <div v-else class="empty-container">
              <el-empty description="请选择Excel文件" />
            </div>
          </div>
        </div>

        <!-- CSV文件预览：前 300 行，正常字号，表体可上下/左右滚动 -->
        <div v-else-if="previewFile && previewFile.type === 'csv'" class="csv-container-wrapper">
          <div v-loading="csvLoading" class="csv-container">
            <div v-if="csvData.length > 0" class="csv-preview">
              <el-table
                class="csv-preview-table"
                :data="csvData"
                height="100%"
                border
                stripe
                style="width: 100%"
                :header-cell-style="{ fontSize: '14px', background: '#f5f7fa' }"
                :cell-style="{ fontSize: '14px' }"
              >
                <el-table-column
                  v-for="(col, index) in csvColumns"
                  :key="index"
                  :prop="col.prop"
                  :label="col.label"
                  :min-width="col.minWidth"
                  show-overflow-tooltip
                />
              </el-table>
            </div>
            <div v-else-if="csvLoading" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在加载CSV文件...</p>
            </div>
            <div v-else class="empty-container">
              <el-empty description="请选择CSV文件" />
            </div>
          </div>
        </div>

        <!-- 文本文件预览 -->
        <div v-else-if="previewFile && previewFile.type === 'txt'" class="txt-container-wrapper">
          <div v-loading="txtLoading" class="txt-container">
            <pre v-if="txtContent" class="text-preview">{{ txtContent }}</pre>
            <div v-else-if="txtLoading" class="loading-container">
              <el-icon class="is-loading" :size="40"><Loading /></el-icon>
              <p>正在加载文本文件...</p>
            </div>
            <div v-else class="empty-container">
              <el-empty description="请选择文本文件" />
            </div>
          </div>
        </div>

        <!-- 图片预览 -->
        <div v-else-if="previewFile && previewFile.type === 'image' && previewFile.previewUrl" class="image-preview">
          <el-image
            :src="previewFile.previewUrl"
            :preview-src-list="[previewFile.previewUrl]"
            fit="contain"
            style="width: 100%; height: 100%;"
          />
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-preview">
          <el-empty description="请选择文件进行预览">
            <el-icon class="empty-icon" :size="80" color="#c0c4cc"><Document /></el-icon>
          </el-empty>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import VueOfficePdf from '@vue-office/pdf'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'
// 相对路径引入样式；勿用 `@vue-office/excel/lib/...`（vite alias 指向 mjs 会导致子路径解析失败）
import '../../../../node_modules/@vue-office/excel/lib/index.css'
import { renderAsync } from 'docx-preview'
import { convertDocToDocxAPI, convertXlsToXlsxAPI, getPreviewFileAPI, previewFileAPI } from '@/api/fileManager.js'

/**
 * 取文件唯一键（用于 watch 判断是否重新加载）
 * @param {Object|null} file 文件对象
 * @returns {string} 唯一键
 */
const getPreviewFileKey = (file) => {
  if (!file) return ''
  return String(file.fileId || file.id || file.file_id || file.name || '')
}
import {
  ZoomIn,
  ZoomOut,
  FullScreen,
  Refresh,
  // Download 当前在模板中注释，保留导入以便后续启用
  // eslint-disable-next-line no-unused-vars
  Download,
  Loading,
  Document
} from '@element-plus/icons-vue'

defineOptions({
  name: 'PreviewFile'
})

const props = defineProps({
  // 当前文件对象
  currentFile: {
    type: Object,
    default: null
  },
  // 当前高亮字段（用于显示"清除高亮"按钮）
  currentHighlightedField: {
    type: String,
    default: null
  },
  // 是否显示清除高亮按钮
  showClearHighlight: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'refresh',
  'download',
  'clear-highlight'
])

const SPREADSHEET_TYPES = new Set(['xlsx', 'xlsm', 'xls', 'csv'])

// 本地文件副本，避免直接修改 Vue prop
const previewFile = ref(null)

const isSpreadsheetType = (type) => SPREADSHEET_TYPES.has(type)

// PDF相关
const pdfSource = ref(null)
const pdfLoading = ref(false)
const pdfConverting = ref(false)
const pdfScale = ref(1)
const pdfViewerRef = ref(null)
const pdfDocumentLoaded = ref(false)

// 检测浏览器版本（Chrome 77 及以下需要禁用 Worker）
const getChromeVersion = () => {
  const match = navigator.userAgent.match(/Chrome\/(\d+)/)
  return match ? parseInt(match[1]) : null
}

const chromeVersion = getChromeVersion()
const isOldChrome = chromeVersion && chromeVersion <= 77

// DOCX相关
const docxSource = ref(null)
const docxLoading = ref(false)
const docPreviewContainerRef = ref(null)
const docPreviewUrl = ref(null)

// Excel相关
const excelSource = ref(null)
const excelLoading = ref(false)
/** vue-office-excel / x-spreadsheet：只读预览，由组件内部按容器宽高虚拟绘制 */
const excelPreviewOptions = {
  xls: true,
  minColLength: 20,
  minRowLength: 50
}

/**
 * Excel 渲染完成后，触发一次 resize，避免容器尺寸未就绪时画布只画首屏
 */
const handleExcelRendered = () => {
  excelLoading.value = false
  nextTick(() => {
    try {
      window.dispatchEvent(new Event('resize'))
    } catch (e) {
      // ignore
    }
  })
}

// CSV相关
const csvData = ref([])
const csvColumns = ref([])
const csvLoading = ref(false)

// 文本文件相关
const txtContent = ref('')
const txtLoading = ref(false)

// 全屏相关
const isFullscreen = ref(false)
const previewRef = ref(null)
const pdfContainerWrapperRef = ref(null)

// DOCX高亮存储
const docxHighlights = ref([])

// 获取原文件 previewUrl（用于 fallback）
const fetchOriginalPreviewUrl = async (file) => {
  if (!file || !file.fileId || file.previewUrl) return
  try {
    const previewRes = await previewFileAPI(file.fileId)
    if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
      file.previewUrl = previewRes.data.preview_url
    }
  } catch (e) {
    console.warn('获取预览URL失败:', e)
  }
}

// 表格预览：统一走原生组件（CSV→el-table / Excel→vue-office-excel）
// LibreOffice「整表缩到一页」字过小；「按 A4 分页」又会出现首页只剩第一列
const ensurePreviewUrl = async (file) => {
  if (!file || !file.fileId) return

  // 若历史逻辑已把表格改成 pdf，恢复原始类型以启用原生预览（正常字号 + 可滚动）
  if (file.type === 'pdf' && file.originalType && isSpreadsheetType(file.originalType)) {
    file.type = file.originalType
    file.originalType = undefined
    file.previewUrl = ''
  }
}

// 加载文件
const loadFile = async (file) => {
  if (!file) return

  // 重置状态
  pdfScale.value = 1
  pdfDocumentLoaded.value = false
  pdfSource.value = null
  docxSource.value = null
  docPreviewUrl.value = null
  excelSource.value = null
  csvData.value = []
  csvColumns.value = []
  txtContent.value = ''

  // 清空DOC预览容器
  if (docPreviewContainerRef.value) {
    docPreviewContainerRef.value.innerHTML = ''
  }

  // 清除高亮
  clearDocxHighlights()

  // 表格类走原生预览（可读字号 + 可滚动），不再转 PDF/PNG 快照
  await ensurePreviewUrl(file)

  // 如果文件有 fileId 但没有 previewUrl，先获取预览URL
  if (file.fileId && !file.previewUrl) {
    await fetchOriginalPreviewUrl(file)
  }

  // 根据文件类型加载
  if (file.type === 'pdf') {
    await loadPdfFile(file)
  } else if (file.type === 'docx' || file.type === 'doc') {
    await loadDocxFile(file)
  } else if (file.type === 'xlsx' || file.type === 'xlsm' || file.type === 'xls') {
    await loadExcelFile(file)
  } else if (file.type === 'csv') {
    await loadCsvFile(file)
  } else if (file.type === 'txt') {
    await loadTxtFile(file)
  }
}

// 加载PDF文件
const loadPdfFile = async (file) => {
  pdfLoading.value = true
  pdfSource.value = null
  await nextTick()

  try {
    if (file.previewUrl) {
      await nextTick()
      pdfSource.value = file.previewUrl
      await nextTick()
    }
  } catch (error) {
    console.error('加载PDF失败:', error)
    const errorMessage = error?.message || error?.toString() || ''
    const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')

    if (!isWorkerError) {
      ElMessage.warning('PDF文件加载遇到问题，但将继续尝试显示')
    }
  } finally {
    pdfLoading.value = false
  }
}

// 加载DOCX/DOC文件
const loadDocxFile = async (file) => {
  docxLoading.value = true
  try {
    if (file.type === 'docx') {
      if (file.previewUrl) {
        docxSource.value = file.previewUrl
      } else {
        docxSource.value = null
      }
    } else if (file.type === 'doc') {
      docxSource.value = null
      docPreviewUrl.value = null

      try {
        ElMessage.info('正在转换 DOC 文件...')

        let fileToUpload = null
        let fileUrl = null

        if (file.raw) {
          fileToUpload = file.raw
        } else if (file.previewUrl) {
          if (file.previewUrl.startsWith('data:')) {
            const base64Data = file.previewUrl.split(',')[1]
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: 'application/msword' })
            fileToUpload = new File([blob], file.name || 'document.doc', { type: 'application/msword' })
          } else {
            fileUrl = file.previewUrl
          }
        }

        if (!fileToUpload && !fileUrl) {
          throw new Error('无法获取文件内容')
        }

        const convertResponse = await convertDocToDocxAPI(fileToUpload, fileUrl)

        if (convertResponse.code === 200 && convertResponse.data) {
          const { preview_url } = convertResponse.data
          docxSource.value = preview_url
          ElMessage.success('DOC 文件转换成功')
        } else {
          throw new Error(convertResponse.message || '转换失败')
        }
      } catch (docError) {
        console.error('DOC文件转换失败:', docError)
        docxSource.value = null
        docPreviewUrl.value = null

        // 尝试使用 docx-preview 直接预览（备用方案）
        try {
          if (file.previewUrl || file.raw) {
            ElMessage.info('尝试直接预览 DOC 文件...')
            await nextTick()
            await new Promise(resolve => setTimeout(resolve, 200))

            let containerElement = docPreviewContainerRef.value
            if (!containerElement) {
              containerElement = document.querySelector('.docx-preview-container')
            }

            if (!containerElement) {
              throw new Error('预览容器未准备好，请稍后重试')
            }

            let arrayBuffer = null

            if (file.previewUrl && file.previewUrl.startsWith('data:application/msword;base64,')) {
              const base64 = file.previewUrl.split(',')[1]
              const binaryString = atob(base64)
              const len = binaryString.length
              const bytes = new Uint8Array(len)
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              arrayBuffer = bytes.buffer
            } else if (file.previewUrl && (file.previewUrl.startsWith('http://') || file.previewUrl.startsWith('https://'))) {
              const response = await fetch(file.previewUrl)
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
              arrayBuffer = await response.arrayBuffer()
            } else if (file.previewUrl && file.previewUrl.startsWith('/')) {
              const fullUrl = window.location.origin + file.previewUrl
              const response = await fetch(fullUrl)
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
              arrayBuffer = await response.arrayBuffer()
            } else if (file.raw) {
              arrayBuffer = await file.raw.arrayBuffer()
            }

            if (arrayBuffer && containerElement) {
              if (arrayBuffer.byteLength === 0) {
                throw new Error('文件数据为空')
              }

              if (arrayBuffer.byteLength < 100) {
                throw new Error('文件数据过小，可能不是有效的 DOC 文件')
              }

              containerElement.innerHTML = ''

              try {
                await renderAsync(arrayBuffer, containerElement)
                await new Promise(resolve => setTimeout(resolve, 500))

                if (containerElement.children.length === 0 || containerElement.textContent.trim() === '') {
                  throw new Error('渲染后容器为空，docx-preview 可能不支持此 DOC 文件格式。建议转换为 DOCX 格式')
                }

                ElMessage.success('DOC 文件预览成功')
                return
              } catch (renderError) {
                console.error('renderAsync 错误详情:', renderError)
                const errorMsg = renderError.message || '未知错误'
                if (errorMsg.includes('childNodes') || errorMsg.includes('null')) {
                  throw new Error('docx-preview 不支持此 DOC 文件格式。docx-preview 库主要支持 DOCX 格式，对于旧的 DOC 格式支持有限。建议将文件转换为 DOCX 格式后重新上传')
                }
                throw new Error(`渲染失败: ${errorMsg}`)
              }
            } else {
              throw new Error('无法获取文件数据或容器不存在')
            }
          }
        } catch (previewError) {
          console.error('直接预览也失败:', previewError)
          await nextTick()
          await new Promise(resolve => setTimeout(resolve, 200))
          let containerElement = docPreviewContainerRef.value || document.querySelector('.docx-preview-container')
          if (containerElement) {
            containerElement.innerHTML = `
              <div style="text-align: center; padding: 40px; color: #909399;">
                <p style="font-size: 16px; margin-bottom: 10px;">.doc 格式文件预览失败</p>
                <p style="font-size: 14px; color: #606266;">${previewError.message || docError.message || '请检查文件格式是否正确'}</p>
                <p style="font-size: 12px; color: #909399; margin-top: 20px;">建议将文件转换为 .docx 格式后重新上传</p>
              </div>
            `
          }
          ElMessage.error('DOC文件预览失败: ' + (previewError.message || docError.message || '未知错误'))
          return
        }

        await nextTick()
        await new Promise(resolve => setTimeout(resolve, 200))
        let containerElement = docPreviewContainerRef.value || document.querySelector('.docx-preview-container')
        if (containerElement) {
          containerElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #909399;">
              <p style="font-size: 16px; margin-bottom: 10px;">.doc 格式文件转换失败</p>
              <p style="font-size: 14px; color: #606266;">${docError.message || '请检查文件格式是否正确'}</p>
              <p style="font-size: 12px; color: #909399; margin-top: 20px;">建议将文件转换为 .docx 格式后重新上传</p>
            </div>
          `
        }
        ElMessage.error('DOC文件转换失败: ' + (docError.message || '未知错误'))
      }
    }
  } catch (error) {
    console.error('加载Word文件失败:', error)
    ElMessage.error('Word文件加载失败')
  } finally {
    docxLoading.value = false
  }
}

// 加载Excel文件
const loadExcelFile = async (file) => {
  excelLoading.value = true
  excelSource.value = null
  try {
    // 如果是 XLS，需要先转换为 XLSX
    if (file.type === 'xls') {
      try {
        ElMessage.info('正在转换 XLS 文件...')
        let fileToUpload = null
        let fileUrl = null
        if (file.raw) {
          fileToUpload = file.raw
        } else if (file.previewUrl) {
          if (file.previewUrl.startsWith('data:')) {
            const base64Data = file.previewUrl.split(',')[1]
            const binaryString = atob(base64Data)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' })
            fileToUpload = new File([blob], file.name || 'document.xls', { type: 'application/vnd.ms-excel' })
          } else {
            fileUrl = file.previewUrl
          }
        }
        if (!fileToUpload && !fileUrl) {
          throw new Error('无法获取文件内容')
        }
        const convertResponse = await convertXlsToXlsxAPI(fileToUpload, fileUrl)
        if (convertResponse.code === 200 && convertResponse.data) {
          const { preview_url } = convertResponse.data
          excelSource.value = preview_url
          ElMessage.success('XLS 文件转换成功')
        } else {
          throw new Error(convertResponse.message || '转换失败')
        }
      } catch (xlsError) {
        console.error('XLS文件转换失败:', xlsError)
        ElMessage.error('XLS文件预览失败: ' + (xlsError.message || '未知错误'))
        excelSource.value = null
      }
      excelLoading.value = false
      return
    }

    const fileId = file.fileId || file.id || file.file_id
    if (file.previewUrl) {
      excelSource.value = file.previewUrl
    } else if (fileId) {
      try {
        const previewRes = await previewFileAPI(fileId)
        if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
          excelSource.value = previewRes.data.preview_url
          file.previewUrl = previewRes.data.preview_url
        }
      } catch (e) {
        console.warn('获取Excel预览URL失败:', e)
      }
      if (!excelSource.value) {
        excelSource.value = getPreviewFileAPI(fileId)
      }
    }
  } catch (error) {
    console.error('加载Excel失败:', error)
    ElMessage.error('Excel文件加载失败')
  } finally {
    excelLoading.value = false
  }
}

// CSV文件处理函数
const decodeBufferToText = (buffer) => {
  const decoders = ['utf-8', 'gb18030', 'gbk']
  const looksGarbled = (text) => {
    if (text.indexOf('\uFFFD') !== -1) return true
    // eslint-disable-next-line no-control-regex
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length
    return nonPrintable > Math.max(5, text.length * 0.01)
  }
  for (let i = 0; i < decoders.length; i++) {
    try {
      const text = new TextDecoder(decoders[i], { fatal: false }).decode(buffer)
      if (!looksGarbled(text)) {
        return text
      }
    } catch {
      // 忽略，尝试下一个编码
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return ''
  }
}

const stripBomAndNormalize = (text) => {
  if (text && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

const computeColumnWidths = (headers, rows) => {
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = '14px var(--el-font-family), Arial, Helvetica, sans-serif'
  const padding = 28
  const minCol = 80
  const maxCol = 480
  const calc = (text) => {
    if (text == null) return minCol
    const str = String(text)
    const metrics = ctx.measureText(str)
    return Math.min(maxCol, Math.max(minCol, Math.ceil(metrics.width) + padding))
  }
  const sampleSize = Math.min(100, rows.length)
  return headers.map(function(h) {
    let width = calc(h)
    for (let i = 0; i < sampleSize; i++) {
      const v = rows[i] ? rows[i][h] : ''
      width = Math.max(width, calc(v))
    }
    return { prop: h, label: h, minWidth: width }
  })
}

const detectDelimiter = (text) => {
  const candidates = [',', ';', '\t', '|']
  const sampleLines = text.split('\n').slice(0, 10)
  let best = { delim: ',', score: -1 }
  for (let i = 0; i < candidates.length; i++) {
    const delim = candidates[i]
    const counts = sampleLines.map(function(l) { return (l === '' ? 0 : l.split(delim).length) }).filter(function(c) { return c > 1 })
    if (counts.length === 0) continue
    const avg = counts.reduce(function(a, b) { return a + b }, 0) / counts.length
    const variance = counts.reduce(function(sum, c) { return sum + Math.pow(c - avg, 2) }, 0) / counts.length
    const score = counts.length * avg - variance
    if (score > best.score) best = { delim: delim, score: score }
  }
  return best.delim
}

const parseCSV = (csvText) => {
  if (!csvText) return { headers: [], data: [] }
  const delimiter = detectDelimiter(csvText)
  const records = []
  let currentField = ''
  let currentRecord = []
  let inQuotes = false
  const pushField = function() {
    let value = currentField
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1)
    }
    value = value.replace(/""/g, '"')
    currentRecord.push(value)
    currentField = ''
  }
  const pushRecord = function() {
    let allEmpty = true
    for (let i = 0; i < currentRecord.length; i++) {
      const v = currentRecord[i]
      if (v !== null && v !== undefined && v !== '') {
        allEmpty = false
        break
      }
    }
    if (!allEmpty) records.push(currentRecord)
    currentRecord = []
  }
  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    const next = i + 1 < csvText.length ? csvText[i + 1] : ''
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      pushField()
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      pushField()
      pushRecord()
      if (ch === '\r' && next === '\n') i++
      continue
    }
    currentField += ch
  }
  pushField()
  pushRecord()
  if (records.length === 0) return { headers: [], data: [] }
  const headerRow = records[0].map(function(h) { return (h || '').trim() })
  const normalizedHeaders = headerRow.map(function(h, idx) { return (h ? h : 'Column_' + (idx + 1)) })
  const data = records.slice(1).map(function(row) {
    const obj = {}
    for (let i = 0; i < normalizedHeaders.length; i++) {
      obj[normalizedHeaders[i]] = row[i] !== undefined ? row[i] : ''
    }
    return obj
  })
  return { headers: normalizedHeaders, data }
}

// 加载CSV文件
const loadCsvFile = async (file) => {
  csvLoading.value = true
  try {
    // 如果文件有 fileId 但没有 previewUrl，先获取预览URL
    if (file.fileId && !file.previewUrl) {
      try {
        const previewRes = await previewFileAPI(file.fileId)
        if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
          file.previewUrl = previewRes.data.preview_url
        }
      } catch (e) {
        console.warn('获取CSV预览URL失败:', e)
      }
    }

    let csvText = ''
    if (file.previewUrl && file.previewUrl.startsWith('data:')) {
      // Base64数据
      const response = await fetch(file.previewUrl)
      const blob = await response.blob()
      const buf = await blob.arrayBuffer()
      csvText = stripBomAndNormalize(decodeBufferToText(buf))
    } else if (file.previewUrl) {
      // URL
      const response = await fetch(file.previewUrl)
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status)
      }
      const buf = await response.arrayBuffer()
      csvText = stripBomAndNormalize(decodeBufferToText(buf))
    } else {
      throw new Error('无法获取CSV文件内容')
    }

    const result = parseCSV(csvText)
    // 预览仅渲染前 300 行，与后端 PDF 快照行数一致，并可在表格内上下滚动
    const previewRows = Array.isArray(result.data) ? result.data.slice(0, 300) : []
    csvData.value = previewRows
    csvColumns.value = computeColumnWidths(result.headers, previewRows)
  } catch (error) {
    console.error('加载CSV失败:', error)
    csvData.value = []
    csvColumns.value = []
    ElMessage.error('CSV文件加载失败')
  } finally {
    csvLoading.value = false
  }
}

// 加载TXT文件
const loadTxtFile = async (file) => {
  txtLoading.value = true
  try {
    if (file.fileId && !file.previewUrl) {
      try {
        const previewRes = await previewFileAPI(file.fileId)
        if (previewRes.code === 200 && previewRes.data && previewRes.data.preview_url) {
          file.previewUrl = previewRes.data.preview_url
        }
      } catch (e) {
        console.warn('获取TXT预览URL失败:', e)
      }
    }

    if (file.previewUrl && file.previewUrl.startsWith('data:')) {
      const response = await fetch(file.previewUrl)
      const blob = await response.blob()
      txtContent.value = await blob.text()
    } else if (file.previewUrl) {
      const response = await fetch(file.previewUrl)
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status)
      }
      txtContent.value = await response.text()
    } else {
      txtContent.value = ''
    }
  } catch (e) {
    console.error('文本文件加载失败:', e)
    txtContent.value = ''
    throw e
  } finally {
    txtLoading.value = false
  }
}

// PDF渲染完成回调
const handlePdfRendered = () => {
  console.log('✅ PDF渲染完成')
  pdfDocumentLoaded.value = true
  pdfLoading.value = false
}

// 简单的预签名 URL 过期判断（403/404 或包含 expired）
const isPresignedUrlExpiredError = (error) => {
  if (!error) return false
  const message = String(error.message || error.toString() || '').toLowerCase()
  const status = error.status || error.statusCode || error.httpStatus
  return status === 403 || status === 404 || message.includes('expired') || message.includes('forbidden')
}

// PDF加载错误回调
const handlePdfError = async (error) => {
  console.error('PDF加载错误:', error)
  const errorMessage = error?.message || error?.toString() || ''
  const isWorkerError = errorMessage.includes('Worker') || errorMessage.includes('setup') || errorMessage.includes('polyfill')

  // 如果是大表格转成的 PDF，URL 过期时尝试刷新
  if (previewFile.value && previewFile.value.originalType && isPresignedUrlExpiredError(error)) {
    try {
      pdfLoading.value = true
      previewFile.value.previewUrl = ''
      await ensurePreviewUrl(previewFile.value)
      if (previewFile.value.previewUrl) {
        pdfSource.value = previewFile.value.previewUrl
        return
      }
    } catch (e) {
      console.warn('刷新 PDF 预览链接失败:', e)
    } finally {
      pdfLoading.value = false
    }
  }

  if (!isWorkerError) {
    ElMessage.warning('PDF文档加载可能存在问题，但将继续尝试显示')
  }

  pdfLoading.value = false
}

// DOCX加载错误回调
const handleDocxError = (error) => {
  console.error('DOCX加载错误:', error)
  if (previewFile.value && previewFile.value.type === 'doc') {
    ElMessage.warning({
      message: '.doc 格式文件预览不支持，建议转换为 .docx 格式后重新上传',
      duration: 5000
    })
  } else {
    ElMessage.error('Word文档加载失败，请检查文件路径')
  }
  docxLoading.value = false
}

// Excel加载错误回调
const handleExcelError = (error) => {
  console.error('Excel加载错误:', error)
  ElMessage.error('Excel文档加载失败，请检查文件路径')
  excelLoading.value = false
}

// 清除DOCX高亮
const clearDocxHighlights = () => {
  if (docxHighlights.value && docxHighlights.value.length > 0) {
    docxHighlights.value.forEach(function(highlight) {
      if (highlight.wrapper && highlight.parent && highlight.originalNode) {
        try {
          highlight.parent.replaceChild(highlight.originalNode, highlight.wrapper)
        } catch (e) {
          console.warn('清除高亮失败:', e)
        }
      }
    })
    docxHighlights.value = []
  }
}

// 监听 currentFile 变化，创建本地副本并加载文件
watch(() => props.currentFile, async (newFile, oldFile) => {
  if (!newFile) {
    previewFile.value = null
    return
  }
  const newKey = getPreviewFileKey(newFile)
  const oldKey = getPreviewFileKey(oldFile)
  if (!newKey) return
  if (!oldKey || newKey !== oldKey || newFile.previewUrl !== (oldFile && oldFile.previewUrl)) {
    // 使用浅拷贝作为本地副本，避免直接修改 prop
    previewFile.value = { ...newFile }
    await loadFile(previewFile.value)
  }
}, { immediate: true })

// 缩放控制
const zoomIn = () => {
  pdfScale.value = Math.min(pdfScale.value + 0.25, 3)
  ElMessage.success(`已放大至 ${Math.round(pdfScale.value * 100)}%`)
}

const zoomOut = () => {
  pdfScale.value = Math.max(pdfScale.value - 0.25, 0.5)
  ElMessage.success(`已缩小至 ${Math.round(pdfScale.value * 100)}%`)
}

// 全屏功能
const toggleFullscreen = () => {
  const pdfContainerWrapper = pdfContainerWrapperRef.value || document.querySelector('.pdf-container-wrapper')
  if (!pdfContainerWrapper) {
    ElMessage.warning('未找到PDF容器')
    return
  }

  if (!isFullscreen.value) {
    if (pdfContainerWrapper.requestFullscreen) {
      pdfContainerWrapper.requestFullscreen()
    } else if (pdfContainerWrapper.webkitRequestFullscreen) {
      pdfContainerWrapper.webkitRequestFullscreen()
    } else if (pdfContainerWrapper.mozRequestFullScreen) {
      pdfContainerWrapper.mozRequestFullScreen()
    } else if (pdfContainerWrapper.msRequestFullscreen) {
      pdfContainerWrapper.msRequestFullscreen()
    } else {
      ElMessage.warning('浏览器不支持全屏功能')
      return
    }
    isFullscreen.value = true
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }
    isFullscreen.value = false
  }
}

// 监听全屏状态变化
const handleFullscreenChange = () => {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  )
}

// 刷新
const handleRefresh = () => {
  emit('refresh')
}

// 下载（模板中注释，保留以便后续启用）
// eslint-disable-next-line no-unused-vars
const handleDownload = () => {
  emit('download')
}

// 清除高亮（模板中注释，保留以便后续启用）
// eslint-disable-next-line no-unused-vars
const handleClearHighlight = () => {
  clearDocxHighlights()
  emit('clear-highlight')
}

// 暴露方法给父组件
defineExpose({
  loadFile,
  clearDocxHighlights,
  pdfScale,
  isFullscreen
})

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('mozfullscreenchange', handleFullscreenChange)
  document.addEventListener('MSFullscreenChange', handleFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
})
</script>

<style scoped>
.preview-file-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fff;
  overflow: hidden;
}

.viewer-header {
  position: sticky;
  top: 0;
  z-index: 100;
  box-sizing: border-box;
  height: 56px;
  min-height: 56px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  background: var(--sd-canvas, #ffffff);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: none;
}

.ocr-column-head {
  height: 56px;
  min-height: 56px;
}

.page-controls {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.page-controls > * + * {
  margin-left: 6px;
}

.header-actions-slot {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 8px;
}

.header-actions-slot > * + * {
  margin-left: 8px;
}

.document-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.document-preview {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  -webkit-overflow-scrolling: touch;
}

.pdf-container-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.pdf-container {
  width: 100%;
  max-width: 1200px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  position: relative;
}

.pdf-container--scroll {
  height: 100%;
  min-height: 0;
  overflow-x: auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.pdf-scale-box {
  transform-origin: top center;
  /* 高度随 PDF 内容撑开，由外层 .pdf-container--scroll 负责上下滚动 */
}

.pdf-office {
  width: 100%;
  display: block;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border: none;
  display: block;
}

.docx-container-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
}

.docx-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 20px;
  background: #fff;
}

/* Excel：外层禁止滚动，把宽高交给 x-spreadsheet 内部滚动条，否则拖动外层只会看到空白画布外区域 */
.excel-container-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #fff;
}

.excel-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.excel-office {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.excel-container :deep(.vue-office-excel),
.excel-container :deep(.excel-office) {
  width: 100% !important;
  height: 100% !important;
}

.excel-container :deep(.x-spreadsheet) {
  width: 100% !important;
  height: 100% !important;
}

.excel-container :deep(.x-spreadsheet-sheet) {
  /* 底部 sheet 标签栏约占 40px，剩余给可滚动表格区 */
  height: calc(100% - 40px) !important;
}

.csv-container-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #fff;
}

.csv-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.csv-preview {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.csv-preview-table {
  width: 100%;
  height: 100%;
  font-size: 14px;
}

.csv-preview-table :deep(.el-table__inner-wrapper),
.csv-preview-table :deep(.el-table__body-wrapper) {
  overflow: auto !important;
}

.csv-preview-table :deep(.el-table__header-wrapper) {
  overflow: hidden;
}

.txt-container-wrapper {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.txt-container {
  width: 100%;
  height: 100%;
  padding: 16px;
}

.text-preview {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #fff;
  padding: 16px;
  border-radius: 4px;
}

.loading-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
}

.loading-container > * + * {
  margin-top: 16px;
}

.empty-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview {
  width: 100%;
  height: 100%;
  max-width: 800px;
  max-height: 1000px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: auto;
}

.empty-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  margin-bottom: 20px;
}
</style>
