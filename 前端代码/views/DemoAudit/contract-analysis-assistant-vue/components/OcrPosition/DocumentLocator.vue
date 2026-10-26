<template>
  <div class="document-locator-container">
    <el-card style="height: 100%">
      <template #header>
        <div class="card-header">
          <span>{{ documentName }}</span>
          <el-button @click="$emit('close')" type="text">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>
      
      <div class="document-locator-content">
        <!-- 错误状态 -->
        <div v-if="state.error" class="document-locator-error">
          <el-alert
            :title="state.error"
            type="error"
            show-icon
            :closable="false"
          />
          <el-button
            type="primary"
            @click="clearError"
            style="margin-top: 16px"
          >
            重试
          </el-button>
        </div>

        <!-- 正常布局 -->
        <div v-else class="document-locator-layout">
          <!-- PDF预览区域 -->
          <div class="document-locator-preview">
            <div class="document-locator-pdf-container">
              <vue-office-pdf
                v-if="pdfSource"
                :src="pdfSource"
                @rendered="handlePdfRendered"
                style="height: 100vh; width: 100%"
              />
              <div v-else-if="state.loading" class="loading-container">
                <p>正在加载PDF文档...</p>
              </div>
              <div v-else class="empty-container">
                <el-empty description="暂无PDF文档" />
              </div>
            </div>
          </div>

          <!-- 提取结果侧边栏 -->
          <div class="document-locator-sidebar">
            <div class="document-locator-results">
              <!-- 标题和质量指标 -->
              <div class="results-title">
                <h4>📋 提取结果 ({{ extractionResults.length }}项)</h4>
                <div class="quality-metrics">
                  <el-tag type="primary">准确率: {{ qualityMetrics.accuracyRate }}%</el-tag>
                  <el-tag type="success">置信度: {{ Math.round(qualityMetrics.avgConfidence) }}%</el-tag>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="results-actions">
                <el-button
                  type="danger"
                  plain
                  size="small"
                  @click="handleClearStyles"
                  :icon="Delete"
                >
                  清除定位样式
                </el-button>
              </div>

              <!-- 提取结果列表 -->
              <div class="results-list">
                <div
                  v-for="(item, index) in extractionResults"
                  :key="item.id"
                  :class="[
                    'result-item',
                    { 'highlighted': state.highlightedField === item.fieldName }
                  ]"
                  :data-index="index + 1"
                >
                  <div class="result-content">
                    <!-- 字段名称和状态 -->
                    <div class="result-header">
                      <div class="result-field-name">
                        {{ item.fieldName }}
                      </div>
                      <div class="result-status">
                        <el-tag
                          :type="getStatusTagType(item.status)"
                          size="small"
                        >
                          {{ getStatusText(item.status) }}
                        </el-tag>
                      </div>
                    </div>

                    <!-- 提取结果值 -->
                    <div class="result-value">
                      <span>{{ item.fieldValue }}</span>
                    </div>

                    <!-- 置信度和定位按钮 -->
                    <div class="result-metrics">
                      <div class="result-confidence">
                        <el-progress
                          :percentage="item.confidence"
                          :stroke-width="6"
                          :show-text="false"
                          :color="getConfidenceColor(item.confidence)"
                        />
                        <span class="result-confidence-text">
                          {{ Math.round(item.confidence) }}%
                        </span>
                      </div>

                      <!-- 定位按钮 -->
                      <el-button
                        size="small"
                        type="primary"
                        :loading="state.loading && state.currentField === item.fieldName"
                        :disabled="shouldDisableLocateButton(item)"
                        @click="handleLocateText(item)"
                        :title="shouldDisableLocateButton(item) ? '该字段无有效提取值，无法定位原文' : '点击定位原文'"
                      >
                        <el-icon><Location /></el-icon>
                        定位原文
                      </el-button>
                    </div>
                  </div>
                </div>

                <!-- 空状态 -->
                <el-empty
                  v-if="extractionResults.length === 0"
                  description="暂无提取结果"
                  :image-size="100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import VueOfficePdf from '@vue-office/pdf'
import { DirectPDFStyleLocatorService } from './directPDFStyleLocatorService.js'
import DocumentApiService from './documentApi.js'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/loading/style/css';
// Props定义
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  documentId: {
    type: String,
    default: ''
  },
  documentName: {
    type: String,
    default: ''
  },
  documentUrl: {
    type: String,
    default: ''
  },
  documentData: {
    type: [String, ArrayBuffer, Blob],
    default: null
  },
  extractionResults: {
    type: Array,
    default: () => []
  },
  extractionId: {
    type: String,
    default: ''
  },
  sessionId: {
    type: String,
    default: ''
  }
})

// Emits定义
const emit = defineEmits(['close'])

console.log('emit', emit)

// 响应式状态
const state = reactive({
  loading: false,
  error: null,
  currentField: null,
  highlightedField: null,
  documentLoaded: false
})

const fileUrl = ref(null)
const directStyleLocatorService = ref(null)
const pdfSource = ref(null)

// 初始化文档预览
const initDocumentPreview = async () => {
  try {
    state.loading = true
    state.error = null

    // 优先使用传入的文档数据（类似FilePreview的方式）
    if (props.documentData) {
      console.log('📄 使用传入的文档数据进行预览')
      pdfSource.value = props.documentData
      state.loading = false
      return
    }

    // 其次：有 documentId 时走后端预览API
    if (props.documentId) {
      console.log('🌐 通过后端预览API加载文档预览, documentId:', props.documentId)
      const previewData = await DocumentApiService.getDocumentPreview(props.documentId)
      console.log('🔍 预览API返回数据:', previewData)
      
      if (previewData.preview_type === 'pdf' && previewData.preview_url) {
        pdfSource.value = previewData.preview_url
        console.log('✅ 使用后端返回的PDF预览URL:', previewData.preview_url)
        state.loading = false
        return
      }
      console.warn('⚠️ 预览API未返回PDF，提示等待转换')
    }

    // 最后：使用documentUrl
    if (props.documentUrl) {
      console.log('📄 检查传入的文档URL是否为PDF:', props.documentUrl)
      const isPdf = typeof props.documentUrl === 'string' && props.documentUrl.toLowerCase().includes('.pdf')
      if (isPdf) {
        pdfSource.value = props.documentUrl
        state.loading = false
        return
      }
      console.warn('⚠️ 传入的文档URL不是PDF，提示等待转换')
    }

    // 都不可用
    console.error('❌ 没有可用的文档文件或URL')
    state.error = 'PDF预览未就绪，请等待文件转换完成后重试'
    state.loading = false

  } catch (err) {
    console.error('❌ 加载预览失败:', err)
    // 后端不可用时，不再回退到非PDF；仅在是PDF时展示
    if (props.documentUrl && props.documentUrl.toLowerCase().includes('.pdf')) {
      pdfSource.value = props.documentUrl
      state.loading = false
      return
    }
    state.error = 'PDF预览未就绪，请稍后重试'
    state.loading = false
  }
}

// 计算属性
const qualityMetrics = computed(() => {
  if (!props.extractionResults.length) {
    return { accuracyRate: 0, avgConfidence: 0 }
  }

  const successCount = props.extractionResults.filter(item => item.status === 'success').length
  const accuracyRate = Math.round((successCount / props.extractionResults.length) * 100)
  
  const totalConfidence = props.extractionResults.reduce((sum, item) => sum + item.confidence, 0)
  const avgConfidence = totalConfidence / props.extractionResults.length

  return { accuracyRate, avgConfidence }
})

// 方法定义
const clearError = () => {
  state.error = null
}

const getStatusTagType = (status) => {
  switch (status) {
    case 'success': return 'success'
    case 'warning': return 'warning'
    case 'error': return 'danger'
    default: return 'info'
  }
}

const getStatusText = (status) => {
  switch (status) {
    case 'success': return '准确'
    case 'warning': return '部分准确'
    case 'error': return '不准确'
    default: return '未知'
  }
}

const getConfidenceColor = (confidence) => {
  if (confidence >= 90) return '#52c41a'
  if (confidence >= 70) return '#faad14'
  return '#f5222d'
}

const shouldDisableLocateButton = (field) => {
  return !field.fieldValue || field.fieldValue.trim() === '' || 
         !field.sourceBlocks || field.sourceBlocks.length === 0
}

const handlePdfRendered = () => {
  console.log('PDF渲染完成')
  state.documentLoaded = true
}

const handleClearStyles = () => {
  if (directStyleLocatorService.value) {
    directStyleLocatorService.value.restoreAllOriginalStyles()
    state.highlightedField = null
    ElMessage.success('已清除所有定位样式')
  }
}

const handleLocateText = async (field) => {
  try {
    // 检查字段是否应该被禁用
    if (shouldDisableLocateButton(field)) {
      ElMessage.warning(`字段"${field.fieldName}"无有效提取值，无法进行原文定位`)
      return
    }

    state.loading = true
    state.currentField = field.fieldName
    state.highlightedField = field.fieldName

    console.log('🎯 开始定位字段:', field.fieldName)

    // 检查直接样式修改定位服务是否可用
    if (!directStyleLocatorService.value) {
      throw new Error('直接样式修改定位服务未初始化')
    }

    // 检查PDF是否已渲染完成
    if (!state.documentLoaded) {
      ElMessage.warning('PDF文档尚未加载完成，请稍后再试')
      state.loading = false
      return
    }

    // 从data.js的ocrFileMap中获取定位数据 - Chrome 77 兼容性处理
    let ocrFileMap
    try {
      const dataModule = await import('@/views/DemoAudit/contract-analysis-assistant-vue/components/data.js')
      ocrFileMap = dataModule.ocrFileMap
    } catch (error) {
      console.error('动态导入 data.js 失败，可能是浏览器不支持:', error)
      ElMessage.error('当前浏览器版本过低，无法加载OCR定位数据。请升级浏览器。')
      return
    }
    
    console.log('📍 当前文档名称:', props.documentName)
    console.log('📍 当前字段名称:', field.fieldName)
    
    // 根据文档名称和字段名称获取定位数据
    const fileData = ocrFileMap[props.documentName]
    if (!fileData) {
      ElMessage.warning(`未找到文档"${props.documentName}"的OCR定位数据`)
      state.loading = false
      return
    }
    
    const locationData = fileData[field.fieldName]
    if (!locationData) {
      ElMessage.warning(`未找到字段"${field.fieldName}"的定位数据`)
      state.loading = false
      return
    }

    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 500))

    console.log('✅ 从data.js获取定位数据:', locationData)

    // 使用定位服务创建高亮
    if (locationData.location_results && locationData.location_results.length > 0) {
      console.log(`📍 共找到 ${locationData.location_results.length} 个定位结果，将全部显示`)

      // 先清除所有之前的高亮
      if (directStyleLocatorService.value) {
        directStyleLocatorService.value.restoreAllOriginalStyles()

        // 收集所有页面，跳转到最小页码
        const allPages = locationData.location_results
          .map(result => (result.position_info && result.position_info.page_number) || 1)
          .filter(page => page > 0)

        if (allPages.length > 0) {
          const minPage = Math.min(...allPages)
          const uniquePages = Array.from(new Set(allPages)).sort((a, b) => a - b)

          console.log(`📄 字段"${field.fieldName}"涉及页面: ${uniquePages.join(', ')}`)

          // 跳转到第一个页面
          await directStyleLocatorService.value.jumpToPage(minPage)

          // 增加等待时间，确保页面完全加载
          setTimeout(async () => {
            // 验证页面元素是否存在
            const pageElement = directStyleLocatorService.value._getCurrentPageElement(minPage)
            if (!pageElement) {
              console.error(`❌ 无法找到第${minPage}页的页面元素`)
              ElMessage.error(`无法找到第${minPage}页，请检查PDF是否正确加载`)
              state.loading = false
              return
            }

            console.log('✅ 页面元素验证成功，开始创建高亮')

            for (const result of locationData.location_results) {
              if (result.position_info) {
                const position = {
                  page: result.position_info.page_number || 1,
                  x: result.position_info.x || 0,
                  y: result.position_info.y || 0,
                  width: result.position_info.width || 100,
                  height: result.position_info.height || 20,
                  text: result.matched_text || field.fieldValue,
                  confidence: result.confidence || field.confidence,
                  type: 'text'
                }

                console.log('🎨 创建高亮位置:', position)
                try {
                  await directStyleLocatorService.value.highlightWithDirectStyleModification(position, {
                    fieldName: field.fieldName,
                    confidence: result.confidence || field.confidence,
                    matchType: result.match_type || 'exact'
                  })
                } catch (highlightError) {
                  console.error('❌ 创建高亮失败:', highlightError)
                }
              }
            }

            ElMessage.success(`已定位到字段"${field.fieldName}"的原文位置`)
          }, 1000) // 增加到1秒等待时间
        }
      }
    } else {
      ElMessage.warning(`未找到字段"${field.fieldName}"的原文位置`)
    }

  } catch (error) {
    console.error('❌ 定位失败:', error)
    ElMessage.error(`定位失败: ${error.message}`)
  } finally {
    state.loading = false
  }
}

// 初始化直接样式修改定位服务
const initDirectStyleLocatorService = () => {
  if (props.visible && !directStyleLocatorService.value) {
    directStyleLocatorService.value = new DirectPDFStyleLocatorService()
    console.log('🎨 直接样式修改定位服务初始化完成')
  }
}

// 销毁服务
const destroyService = () => {
  if (directStyleLocatorService.value) {
    directStyleLocatorService.value.destroy()
    directStyleLocatorService.value = null
    console.log('🗑️ 直接样式修改定位服务已销毁')
  }
}

// 处理文档加载
const loadDocument = async () => {
  if (!props.visible) return

  try {
    state.loading = true
    state.error = null

    // 优先：有 documentId 时走后端预览API
    if (props.documentId) {
      console.log('🌐 通过后端预览API加载文档预览, documentId:', props.documentId)
      const previewData = await DocumentApiService.getDocumentPreview(props.documentId)
      console.log('🔍 预览API返回数据:', previewData)
      
      if (previewData.preview_type === 'pdf' && previewData.preview_url) {
        fileUrl.value = previewData.preview_url
        console.log('✅ 使用后端返回的PDF预览URL:', previewData.preview_url)
        state.loading = false
        return
      }
      console.warn('⚠️ 预览API未返回PDF，提示等待转换')
    }

    if (props.documentUrl) {
      console.log('📄 检查传入的文档URL是否为PDF:', props.documentUrl)
      const isPdf = typeof props.documentUrl === 'string' && props.documentUrl.toLowerCase().includes('.pdf')
      if (isPdf) {
        fileUrl.value = props.documentUrl
        state.loading = false
        return
      }
      console.warn('⚠️ 传入的文档URL不是PDF，提示等待转换')
    }

    // 都不可用
    console.error('❌ 没有可用的文档文件或URL')
    state.error = 'PDF预览未就绪，请等待文件转换完成后重试'
    state.loading = false

  } catch (err) {
    console.error('❌ 加载预览失败:', err)
    // 后端不可用时，不再回退到非PDF；仅在是PDF时展示
    if (props.documentUrl && props.documentUrl.toLowerCase().includes('.pdf')) {
      fileUrl.value = props.documentUrl
      state.loading = false
      return
    }
    state.error = 'PDF预览未就绪，请稍后重试'
    state.loading = false
  }
}

// 监听visible变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    initDirectStyleLocatorService()
    initDocumentPreview()
  } else {
    destroyService()
  }
})

// 生命周期
onMounted(() => {
  if (props.visible) {
    initDirectStyleLocatorService()
    initDocumentPreview()
  }
})

onUnmounted(() => {
  destroyService()
})
</script>

<style scoped lang="scss">
.document-locator-container {
  width: 100%;
  height: 100%;
  
  .el-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    
    :deep(.el-card__body) {
      flex: 1;
      overflow: hidden;
      padding: 0;
    }
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    span {
      font-weight: bold;
    }
  }
}

.document-locator-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.document-locator-error {
  padding: 20px;
  text-align: center;
}

.document-locator-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.document-locator-preview {
  flex: 1;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.document-locator-pdf-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
  
  .loading-container,
  .empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    
    p {
      margin-top: 16px;
      color: #666;
    }
  }
}

.document-locator-sidebar {
  width: 400px;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.document-locator-results {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.results-title {
  margin-bottom: 16px;
  
  h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .quality-metrics {
    display: flex;
    gap: 8px;
  }
}

.results-actions {
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
}

.results-list {
  flex: 1;
  overflow-y: auto;
}

.result-item {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }
  
  &.highlighted {
    border-color: #67c23a;
    background: #f0f9ff;
    box-shadow: 0 2px 8px rgba(103, 194, 58, 0.2);
  }
}

.result-content {
  width: 100%;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-field-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.result-value {
  margin-bottom: 12px;
  color: #606266;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
}

.result-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-confidence {
  display: flex;
  align-items: center;
  flex: 1;
  margin-right: 12px;
  
  .el-progress {
    flex: 1;
    margin-right: 8px;
  }
  
  .result-confidence-text {
    font-size: 12px;
    color: #909399;
    white-space: nowrap;
  }
}
</style>
