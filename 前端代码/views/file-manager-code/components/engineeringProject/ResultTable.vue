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
        style="width: 100%"
        :border="true"
        :stripe="true"
        row-key="dbwj"
      >
        <!-- 展开列 -->
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <el-table 
                :data="row.details" 
                :border="true"
                style="width: 100%"
              >
                <!-- 重复项目 / 主子项目 -->
                <el-table-column 
                  :label="isParentChild ? '主子项目' : '重复项目'" 
                  :prop="isParentChild ? 'zzxm' : 'cfxm'"
                  width="120"
                  align="center"
                />
                
                <!-- 项目关系 -->
                <el-table-column 
                  label="项目关系" 
                  prop="xmgx"
                  width="120"
                  align="center"
                />
                
                <!-- 主键 -->
                <el-table-column 
                  label="主键" 
                  prop="zj"
                  width="120"
                  align="center"
                />
                
                <!-- 项目统一编码24位码 -->
                <el-table-column 
                  label="项目统一编码24位码" 
                  prop="tybm"
                  min-width="200"
                  align="center"
                  show-overflow-tooltip
                />
                
                <!-- 项目名称 -->
                <el-table-column 
                  label="项目名称" 
                  prop="xmmc"
                  min-width="200"
                  show-overflow-tooltip
                />
                
                <!-- 总投资_万元 -->
                <el-table-column 
                  label="总投资_万元" 
                  prop="ztz"
                  width="120"
                  align="center"
                />
                
                <!-- 项目详细建设地点 -->
                <el-table-column 
                  label="项目详细建设地点" 
                  prop="jsdd"
                  min-width="200"
                  show-overflow-tooltip
                />
                
                <!-- 建设规模及内容 -->
                <el-table-column 
                  label="建设规模及内容" 
                  prop="jsgm"
                  min-width="250"
                  show-overflow-tooltip
                />
                
                <!-- 单位名称 -->
                <el-table-column 
                  label="单位名称" 
                  prop="dwmc"
                  min-width="180"
                  show-overflow-tooltip
                />
                
                <!-- 总得分 -->
                <el-table-column 
                  label="总得分" 
                  prop="zdf"
                  width="100"
                  align="center"
                />
              </el-table>
            </div>
          </template>
        </el-table-column>

        <!-- 对比文件 -->
        <el-table-column 
          :label="isParentChild ? '主项目' : '对比文件'" 
          prop="dbwj"
          min-width="180"
          show-overflow-tooltip
        />
        
        <!-- 被对比文件 -->
        <el-table-column 
          :label="isParentChild ? '子项目' : '被对比文件'" 
          prop="bdbwj"
          min-width="180"
          show-overflow-tooltip
        />
        
        <!-- 结论 -->
        <el-table-column 
          label="结论" 
          prop="jl"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="isParentChild || row.jl === '2' ? 'warning' : 'danger'">
              {{ isParentChild || row.jl === '2' ? '主子项目' : '重复项目' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <!-- 相似度 -->
        <el-table-column 
          label="相似度" 
          prop="xsd"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <span :style="{ color: row.xsd >= 0.95 ? '#F56C6C' : row.xsd >= 0.90 ? '#E6A23C' : '#67C23A' }">
              {{ (row.xsd * 100).toFixed(2) }}%
            </span>
          </template>
        </el-table-column>
        
        <!-- 原因 -->
        <el-table-column 
          label="原因" 
          prop="yy"
          min-width="150"
          show-overflow-tooltip
        />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { FullScreen, Document, Download, ArrowDown } from '@element-plus/icons-vue'

const props = defineProps({
  resultList: {
    type: Array,
    required: true,
    default: () => []
  },
  resultType: {
    type: String,
    default: 'duplicate',
    validator: (v) => ['duplicate', 'parentChild'].includes(v)
  }
})

const isParentChild = computed(() => props.resultType === 'parentChild')

const isFullscreen = ref(false)

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
}

// 导出为 Excel
const exportToExcel = () => {
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

/* 展开内容样式 */
.expand-content {
  padding: 16px;
  background: #f9fafc;
}

.expand-content :deep(.el-table) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.expand-content :deep(.el-table th) {
  background: #f5f7fa;
  font-weight: 600;
}

.expand-content :deep(.el-table td) {
  padding: 12px 0;
}
</style>

