<template>
  <div class="result-table-container" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 操作按钮栏 -->
    <div class="action-bar">
      <el-button 
        type="primary" 
        :icon="FullScreen" 
        @click="toggleFullscreen"
        size="small"
      >
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </el-button>
      <el-dropdown trigger="hover" @command="handleExport">
        <el-button 
          type="success" 
          :icon="Download" 
          size="small"
        >
          导出
          <el-icon class="el-icon--right">
            <arrow-down />
          </el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="markdown">
              <el-icon><Document /></el-icon>
              导出为 Markdown
            </el-dropdown-item>
            <el-dropdown-item command="excel">
              <el-icon><Download /></el-icon>
              导出为 Excel
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- 表格 -->
    <div class="table-wrapper">
      <el-table 
        :data="resultList" 
        border 
        stripe
        height="100%"
        style="width: 100%"
        :header-cell-style="{ background: '#f5f7fa', color: '#606266' }"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        
        <el-table-column prop="title" label="主题" width="200"  />
        
        <el-table-column prop="extracted_value" label="提取内容" min-width="300">
          <template #default="{ row }">
            <div class="extracted-value-cell">
              <!-- 如果是字符串，直接显示 -->
              <span v-if="typeof row.extracted_value === 'string'">
                {{ row.extracted_value || '暂无数据' }}
              </span>
              <!-- 如果是对象，渲染为 key: value 格式 -->
              <div v-else-if="typeof row.extracted_value === 'object' && row.extracted_value !== null" class="object-value">
                <div 
                  v-for="(value, key) in row.extracted_value" 
                  :key="key"
                  class="object-item"
                >
                  <span class="object-key">{{ key }}:</span>
                  <span class="object-val">{{ value || '(空)' }}</span>
                </div>
              </div>
              <span v-else>暂无数据</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="laws_and_regulations" label="判断依据" width="250"  />
        
        <el-table-column prop="analysis" label="分析思路" width="250"  />
        
        <el-table-column prop="result" label="判断结果" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              :type="resolveResultTagType(row.result)"
              effect="dark"
            >
              {{ row.result || '暂无' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { FullScreen, Document, Download, ArrowDown } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'

const props = defineProps({
  resultList: {
    type: Array,
    required: true,
    default: () => []
  }
})

const isFullscreen = ref(false)

const resolveResultTagType = (result) => {
  const text = result != null ? String(result).trim() : ''
  if (!text) return 'info'
  if (text === 'True' || text === 'true' || text === '符合') return 'success'
  if (text === 'False' || text === 'false' || text === '不符合') return 'danger'
  return 'warning'
}

// 切换全屏
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    ElMessage.success('已进入全屏模式，按 ESC 或点击按钮退出')
  }
}

// 监听 ESC 键退出全屏
const handleKeydown = (e) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

// 格式化提取内容为文本
const formatExtractedValue = (value) => {
  if (typeof value === 'string') {
    return value || '暂无数据'
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val || '(空)'}`)
      .join('; ')
  }
  return '暂无数据'
}

// 处理导出命令
const handleExport = (command) => {
  if (command === 'markdown') {
    exportToMarkdown()
  } else if (command === 'excel') {
    exportToExcel()
  }
}

// 导出为 Markdown
const exportToMarkdown = () => {
  if (!props.resultList || props.resultList.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  let markdown = '# 合同完备性分析结果\n\n'
  markdown += '| 序号 | 主题 | 提取内容 | 判断依据 | 分析思路 | 判断结果 |\n'
  markdown += '|------|------|----------|----------|----------|----------|\n'

  props.resultList.forEach((row, index) => {
    const extractedValue = formatExtractedValue(row.extracted_value)
    markdown += `| ${index + 1} | ${row.title || ''} | ${extractedValue} | ${row.laws_and_regulations || ''} | ${row.analysis || ''} | ${row.result || ''} |\n`
  })

  // 下载文件
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `合同完备性分析_${new Date().getTime()}.md`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElMessage.success('Markdown 文件导出成功')
}

// 导出为 Excel
const exportToExcel = () => {
  if (!props.resultList || props.resultList.length === 0) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  // 准备数据
  const data = props.resultList.map((row, index) => ({
    '序号': index + 1,
    '主题': row.title || '',
    '提取内容': formatExtractedValue(row.extracted_value),
    '判断依据': row.laws_and_regulations || '',
    '分析思路': row.analysis || '',
    '判断结果': row.result || ''
  }))

  // 创建工作簿
  const ws = XLSX.utils.json_to_sheet(data)
  
  // 设置列宽
  ws['!cols'] = [
    { wch: 8 },   // 序号
    { wch: 25 },  // 主题
    { wch: 40 },  // 提取内容
    { wch: 30 },  // 判断依据
    { wch: 30 },  // 分析思路
    { wch: 12 }   // 判断结果
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '合同完备性分析')

  // 导出文件
  XLSX.writeFile(wb, `合同完备性分析_${new Date().getTime()}.xlsx`)
  
  ElMessage.success('Excel 文件导出成功')
}

// 添加和移除键盘事件监听
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.result-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

/* 全屏样式 */
.result-table-container.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: #fff;
  padding: 20px;
  height: 100%;
}

/* 操作按钮栏 */
.action-bar {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

/* 表格容器 */
.table-wrapper {
  flex: 1;
  overflow: hidden;
}

/* 提取结果单元格样式 */
.extracted-value-cell {
  padding: 4px 0;
  line-height: 1.6;
}

/* 对象格式的值 */
.object-value {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.object-item {
  display: flex;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  border-left: 3px solid #409EFF;
}

.object-key {
  font-weight: 500;
  color: #303133;
  margin-right: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.object-val {
  color: #606266;
  word-break: break-all;
  flex: 1;
}

.object-val:empty::before {
  content: '(空)';
  color: #c0c4cc;
  font-style: italic;
}
</style>

