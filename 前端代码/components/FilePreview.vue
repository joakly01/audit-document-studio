<template>
  <div class="file-preview-container" :class="{ 'is-embedded': !showTitle }">
    <el-card style="height: 100%">
      <template v-if="showTitle" #header>
        <div class="card-header">
          <span>{{ fileName }}</span>
        </div>
      </template>
      <div class="preview-wrapper" v-loading="loading">
        <!-- <el-button @click="setFormat('pdf')" :class="{ active: currentFormat === 'pdf' }"
          >PDF</el-button
        >
        <el-button @click="setFormat('docx')" :class="{ active: currentFormat === 'docx' }">
          Word
        </el-button>
        <el-button @click="setFormat('xlsx')" :class="{ active: currentFormat === 'xlsx' }">
          Excel
        </el-button>
        <el-button @click="setFormat('txt')" :class="{ active: currentFormat === 'txt' }"
          >Text</el-button
        > -->

        <!-- PDF预览 -->
        <!-- <vue-office-pdf
          v-if="fileType === 'pdf' && fileSrc"
          :src="fileSrc"
          @rendered="handleRendered"
          style="height: 100vh"
        /> -->

        <!-- PDF预览 -->
        <iframe
          :src="fileData"
          width="100%"
          height="100%"
          style="height: 100%; min-height: 600px"
          v-if="fileType === 'pdf' && fileData"
        ></iframe>

        <!-- Word预览 -->
        <div v-if="fileType === 'docx' && fileSrc" class="docx-preview-panel">
          <vue-office-docx :src="fileSrc" class="office-preview-viewer" />
        </div>
        <!-- Excel预览 -->
        <div
          v-if="(fileType === 'xlsx' || fileType === 'xlsm' || fileType === 'xls') && fileSrc"
          class="office-preview-panel"
        >
          <vue-office-excel
            :src="fileSrc"
            class="office-preview-viewer"
            :options="{
              xls: true,
            }"
          />
        </div>
        <!-- CSV预览 -->
        <div
          v-if="fileType === 'csv' && (csvHeaders.length > 0 || csvData.length > 0)"
          class="csv-preview"
        >
          <el-table :data="csvData" max-height="calc(100vh - 120px)">
            <el-table-column
              v-for="(col, index) in computedColumns"
              :key="index"
              :prop="col.prop"
              :label="col.label"
              :min-width="col.minWidth"
              show-overflow-tooltip
            />
          </el-table>
        </div>
        <!-- 文本预览 -->
        <pre v-if="fileType === 'txt'" class="text-preview">{{ textContent }}</pre>
        <!-- 错误提示 -->
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import VueOfficePdf from '@vue-office/pdf'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'

const textContent = ref('')
const error = ref(null)
const fileSrc = ref(null)
const loading = ref(false)
const csvData = ref([])
const csvHeaders = ref([])
const computedColumns = ref([])

const props = defineProps({
  fileType: {
    // 文件类型
    type: String,
    default: '',
    required: true,
  },
  // 文件名称
  fileName: {
    type: String,
    default: () => {
      return ''
    },
    required: true,
  },
  // 文件数据数据格式
  fileData: {
    type: [String, ArrayBuffer, Blob],
    default: '',
  },
  // 是否显示标题
  showTitle: {
    type: Boolean,
    default: true,
  },
  required: true,
})

// 判断是否为可加载的地址（支持完整 URL 和相对路径）
const isUrl = (str) => {
  if (typeof str !== 'string' || !str) return false
  try {
    new URL(str)
    return true
  } catch {
    return str.startsWith('/')
  }
}

const handleRendered = () => {
  console.log('文件渲染完成')
  loading.value = false
}

// =======  csv 处理辅助函数 =======
// 尝试用多种编码解码文本，优先 UTF-8，失败则回退 GB18030/GBK
const decodeBufferToText = (buffer) => {
  const decoders = ['utf-8', 'gb18030', 'gbk']

  const looksGarbled = (text) => {
    // 包含替代字符通常表示编码不匹配
    if (text.includes('\uFFFD')) return true
    // 过多不可打印字符也视为异常
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length
    return nonPrintable > Math.max(5, text.length * 0.01)
  }

  for (const enc of decoders) {
    try {
      const text = new TextDecoder(enc, { fatal: false }).decode(buffer)
      if (!looksGarbled(text)) {
        return text
      }
    } catch (e) {
      // 忽略，尝试下一个编码
    }
  }

  // 都不理想则用 UTF-8 结果兜底
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return ''
  }
}

const stripBomAndNormalize = (text) => {
  // 移除 BOM
  if (text && text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  // 统一换行
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}
// 计算列最小宽度
const computeColumnWidths = (headers, rows) => {
  const ctx = document.createElement('canvas').getContext('2d')
  // 与 Element Plus 表格近似字体
  ctx.font = '14px var(--el-font-family), Arial, Helvetica, sans-serif'

  const padding = 28 // 左右内边距与图标预留
  const minCol = 80
  const maxCol = 480

  const calc = (text) => {
    if (text == null) return minCol
    const str = String(text)
    const metrics = ctx.measureText(str)
    return Math.min(maxCol, Math.max(minCol, Math.ceil(metrics.width) + padding))
  }

  // 仅抽样前 N 行以提升性能
  const sampleSize = Math.min(100, rows.length)
  return headers.map((h, idx) => {
    let width = calc(h)
    for (let i = 0; i < sampleSize; i++) {
      const v = rows[i] ? rows[i][h] : ''
      width = Math.max(width, calc(v))
    }
    return { prop: h, label: h, minWidth: width }
  })
}
// 自动检测分隔符（逗号、分号、制表符、竖线）
const detectDelimiter = (text) => {
  const candidates = [',', ';', '\t', '|']
  const sampleLines = text.split('\n').slice(0, 10)
  let best = { delim: ',', score: -1 }
  for (const delim of candidates) {
    let counts = sampleLines.map((l) => (l === '' ? 0 : l.split(delim).length)).filter((c) => c > 1)
    if (counts.length === 0) continue
    // 稳定性（方差越小越好）+ 平均列数（越大越好）
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    const variance = counts.reduce((a, b) => a + (b - avg) * (b - avg), 0) / counts.length
    const score = avg - variance
    if (score > best.score) best = { delim, score }
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

  const pushField = () => {
    let value = currentField
    // 去掉包裹引号并处理转义
    if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
      value = value.slice(1, -1)
    }
    value = value.replace(/""/g, '"')
    records.length === 0 ? currentRecord.push(value) : currentRecord.push(value)
    currentField = ''
  }

  const pushRecord = () => {
    // 忽略全空行
    const allEmpty = currentRecord.every((v) => (v !== null && v !== undefined ? v : '') === '')
    if (!allEmpty) records.push(currentRecord)
    currentRecord = []
  }

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    const next = i + 1 < csvText.length ? csvText[i + 1] : ''

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // 转义双引号
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
      // 处理 Windows 换行 \r\n：如果是\r且下一个是\n，则跳过\n
      pushField()
      pushRecord()
      if (ch === '\r' && next === '\n') i++
      continue
    }

    currentField += ch
  }

  // 末尾收尾
  pushField()
  pushRecord()

  if (records.length === 0) return { headers: [], data: [] }

  const headerRow = records[0].map((h) => (h || '').trim())
  const normalizedHeaders = headerRow.map((h, idx) => (h ? h : `Column_${idx + 1}`))

  const data = records.slice(1).map((row) => {
    const obj = {}
    for (let i = 0; i < normalizedHeaders.length; i++) {
      obj[normalizedHeaders[i]] = row[i] !== undefined ? row[i] : ''
    }
    return obj
  })

  return { headers: normalizedHeaders, data }
}

// 加载文件源，支持接口地址和直接数据
const loadFileSrc = async () => {
  try {
    loading.value = true
    if (typeof props.fileData === 'string' && isUrl(props.fileData)) {
      // 如果是接口地址，根据文件类型返回不同的数据格式
      const response = await fetch(props.fileData)
      console.log('response', response)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 根据文件类型返回相应的数据格式
      if (props.fileType === 'pdf') {
        // PDF文件返回ArrayBuffer
        fileSrc.value = await response.arrayBuffer()
      } else if (
        props.fileType === 'docx' ||
        props.fileType === 'xlsx' ||
        props.fileType === 'xlsm' ||
        props.fileType === 'xls'
      ) {
        // Office文件返回ArrayBuffer
        fileSrc.value = await response.arrayBuffer()

        console.log('fileSrc', fileSrc.value)
      } else {
        // 其他文件类型返回Blob
        fileSrc.value = await response.blob()
      }
    } else {
      // 如果是其他类型的数据，直接使用
      fileSrc.value = props.fileData
    }
    loading.value = false
  } catch (e) {
    error.value = '文件加载失败: ' + e.message
    fileSrc.value = null
    loading.value = false
  }
}
// 加载文本内容
const loadTextContent = async () => {
  try {
    loading.value = true
    if (props.fileData instanceof Blob) {
      textContent.value = await props.fileData.text()
    } else if (typeof props.fileData === 'string') {
      // 判断是否为接口地址
      if (isUrl(props.fileData)) {
        // 从接口地址获取文本内容
        const response = await fetch(props.fileData)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        textContent.value = await response.text()

        error.value = null
        loading.value = false
      } else {
        // 直接使用字符串内容
        textContent.value = props.fileData
        loading.value = false
      }
    }
  } catch (e) {
    error.value = '文本加载失败: ' + e.message
    textContent.value = ''
    loading.value = false
  }
}

// 加载CSV内容
const loadCsvContent = async () => {
  try {
    loading.value = true
    let csvText = ''

    if (props.fileData instanceof Blob) {
      const buf = await props.fileData.arrayBuffer()
      csvText = decodeBufferToText(buf)
    } else if (props.fileData instanceof ArrayBuffer) {
      csvText = decodeBufferToText(props.fileData)
    } else if (typeof props.fileData === 'string') {
      if (isUrl(props.fileData)) {
        const response = await fetch(props.fileData)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const buf = await response.arrayBuffer()
        csvText = decodeBufferToText(buf)
      } else {
        csvText = props.fileData
      }
    }

    csvText = stripBomAndNormalize(csvText)
    const { headers, data } = parseCSV(csvText)
    csvHeaders.value = headers
    csvData.value = data
    computedColumns.value = computeColumnWidths(headers, data)
    error.value = null
    loading.value = false
  } catch (e) {
    error.value = 'CSV加载失败: ' + e.message
    csvHeaders.value = []
    csvData.value = []
    computedColumns.value = []
    loading.value = false
  }
}

// 添加 watch，监听 fileData 变化
watch(
  () => props.fileData,
  async () => {
    if (props.fileType === 'txt') {
      loadTextContent()
    } else if (props.fileType === 'csv') {
      loadCsvContent()
    } else {
      // 对于非文本文件，加载文件源
      await loadFileSrc()
    }
  },
  {
    deep: true,
    immediate: true,
  },
)

</script>

<style scoped lang="scss">
.file-preview-container {
  width: 100%;
  height: 100%;
  &.is-embedded {
    overflow: hidden;
    .el-card {
      border: none;
      box-shadow: none;
      background: transparent;
      height: 100%;
      :deep(.el-card__body) {
        padding: 0;
        flex: 1;
        min-height: 0;
        height: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
    }
    .preview-wrapper {
      flex: 1;
      min-height: 0;
      height: 100%;
      overflow: auto;
    }
    .docx-preview-panel,
    .office-preview-panel {
      overflow: auto;
    }
    .text-preview {
      margin: 0;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
  .el-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    :deep(.el-card__body) {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    & > span {
      font-weight: bold;
    }
  }
  .preview-wrapper {
    flex: 1;
    min-height: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .docx-preview-panel,
  .office-preview-panel {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #f5f5f5;
  }
  .office-preview-viewer {
    width: 100%;
    height: 100%;
    display: block;
  }
  .docx-preview-panel :deep(.vue-office-docx),
  .office-preview-panel :deep(.vue-office-excel) {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .docx-preview-panel :deep(.vue-office-docx .docx-wrapper > section.docx) {
    margin-bottom: 5px;
  }
  :deep(.vue-office-pdf-wrapper) {
    background: transparent !important;
  }
}
.text-preview {
  padding: 4px;
}
.csv-preview {
  padding: 8px;
  height: 100%;
  overflow: auto;

  :deep(.el-table) {
    border: 1px solid #ebeef5;
    border-radius: 4px;
  }

  :deep(.el-table__header) {
    background-color: #f5f7fa;
  }

  :deep(.el-table th) {
    background-color: #f5f7fa !important;
    font-weight: 600;
  }
}
.error-message {
  padding: 4px;
  color: red;
}
</style>
