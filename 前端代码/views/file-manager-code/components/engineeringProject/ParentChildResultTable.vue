<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div class="result-table-container" :class="{ 'is-fullscreen': isFullscreen }">
      <div class="action-bar sd-toolbar-row sd-toolbar-row--medium">
        <el-button type="primary" plain :icon="FullScreen" size="small" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>

      <div class="table-wrapper">
        <div class="section-title" v-if="!hideSectionTitle">主子项目</div>
        <el-collapse v-model="activeNames" class="result-collapse">
          <el-collapse-item v-if="sections.model?.rows?.length" name="model">
            <template #title>
              <div class="collapse-title">
                <span class="title-text">{{ sections.model.title }}</span>
                <el-tag type="warning" size="small">{{ countGroups(sections.model.rows) }} 组</el-tag>
              </div>
            </template>
            <ParentChildTable
              :rows="sections.model.rows"
              :height="tableHeight"
              :field-weights="fieldWeights"
              :field-labels="fieldLabels"
              :role-fields="roleFields"
              :source-columns="sourceColumns"
              :column-schema="columnSchema"
            />
          </el-collapse-item>

          <el-collapse-item v-if="sections.code?.rows?.length" name="code">
            <template #title>
              <div class="collapse-title">
                <span class="title-text">{{ sections.code.title }}</span>
                <el-tag type="success" size="small">{{ countGroups(sections.code.rows) }} 组</el-tag>
              </div>
            </template>
            <ParentChildTable
              :rows="sections.code.rows"
              :height="tableHeight"
              :field-weights="fieldWeights"
              :field-labels="fieldLabels"
              :role-fields="roleFields"
              :source-columns="sourceColumns"
              :column-schema="columnSchema"
            />
            <div v-if="sections.code.footnote" class="section-footnote">{{ sections.code.footnote }}</div>
          </el-collapse-item>
        </el-collapse>

        <el-empty
          v-if="!sections.model?.rows?.length && !sections.code?.rows?.length"
          description="未发现主子项目关系"
          :image-size="60"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { FullScreen } from '@element-plus/icons-vue'
import ParentChildTable from './ParentChildTable.vue'
import { useResultTableFullscreen } from './useResultTableFullscreen.js'

defineProps({
  sections: {
    type: Object,
    default: () => ({
      model: { rows: [] },
      code: { rows: [], footnote: '' }
    })
  },
  fieldWeights: {
    type: Object,
    default: null
  },
  fieldLabels: {
    type: Object,
    default: null
  },
  roleFields: {
    type: Object,
    default: null
  },
  sourceColumns: {
    type: Array,
    default: () => []
  },
  columnSchema: {
    type: Array,
    default: null
  },
  hideSectionTitle: {
    type: Boolean,
    default: false
  }
})

const { isFullscreen, tableHeight, toggleFullscreen } = useResultTableFullscreen()
const activeNames = ref(['model', 'code'])

const countGroups = (rows) => {
  const keys = new Set()
  for (const row of rows || []) {
    if (row._rowType === 'main' && row._groupKey != null) keys.add(row._groupKey)
  }
  return keys.size
}
</script>

<style scoped>
.result-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.result-table-container.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 5000;
  width: 100vw;
  height: 100vh;
  background: #fff;
  padding: 20px;
  box-sizing: border-box;
}

.action-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 0 0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.result-collapse {
  border: none;
}

.result-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.result-collapse :deep(.el-collapse-item__header) {
  background: var(--sd-surface-1, #f4f4f4);
  padding: 0 16px;
  height: 46px;
  border: none;
}

.result-collapse :deep(.el-collapse-item__content) {
  padding: 8px 0;
}

.collapse-title {
  display: flex;
  align-items: center;
}

.collapse-title > * + * {
  margin-left: 10px;
}

.title-text {
  font-weight: 600;
  color: #303133;
}

.section-footnote {
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #909399;
  background: #fafafa;
  border-radius: 4px;
}
</style>
