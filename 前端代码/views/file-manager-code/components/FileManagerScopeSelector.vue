<template>
  <div class="fm-scope-selector">
    <div
      class="selector-trigger"
      :class="{ active: showDropdown }"
      @click="toggleDropdown"
    >
      <el-icon class="trigger-icon" :class="selectedNodeIconClass">
        <component :is="selectedNodeIcon" />
      </el-icon>
      <span class="trigger-text">{{ selectedNodeName || '请选择文件夹范围' }}</span>
      <span class="trigger-arrow" :class="{ expanded: showDropdown }">▼</span>
    </div>

    <div v-if="showDropdown" class="selector-dropdown" @click.stop>
      <div v-if="treeData && treeData.length > 0" class="dropdown-search">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜索范围..."
          class="search-input"
        />
      </div>
      <div class="dropdown-list">
        <template v-if="searchKeyword">
          <div
            v-for="item in filteredFlatNodes"
            :key="item.id"
            class="dropdown-item"
            :class="{
              selected: sameNodeId(item.id, modelValue),
              disabled: item.disabled
            }"
            :style="{ paddingLeft: `${item.level * 16 + 12}px` }"
            @click="handleSelectNode(item)"
          >
            <el-icon class="item-icon" :class="resolveFolderIconClass(item)">
              <component :is="resolveFolderIcon(item)" />
            </el-icon>
            <span class="item-name">{{ item.name }}</span>
          </div>
          <div v-if="filteredFlatNodes.length === 0" class="dropdown-empty">
            <p>未找到匹配的范围</p>
          </div>
        </template>

        <template v-else>
          <file-manager-scope-tree-node
            v-for="node in treeData"
            :key="node.id"
            :node="node"
            :selected-id="modelValue"
            :level="0"
            :expanded-folders="expandedFolders"
            @select="handleSelectNode"
            @toggle-expand="toggleFolderExpand"
          />
          <div v-if="!treeData || treeData.length === 0" class="dropdown-empty">
            <p>暂无可用范围</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Folder, OfficeBuilding, School } from '@element-plus/icons-vue'
import FileManagerScopeTreeNode from './FileManagerScopeTreeNode.vue'

const props = defineProps({
  /** 范围树数据 */
  treeData: {
    type: Array,
    default: () => []
  },
  /** 当前选中节点 id */
  modelValue: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const showDropdown = ref(false)
const searchKeyword = ref('')
const expandedFolders = ref(new Set())

/**
 * 判断两个节点 id 是否相同（兼容 string/number）
 * @param {string|number} a - 节点 id
 * @param {string|number} b - 节点 id
 * @returns {boolean} 是否相同
 */
const sameNodeId = (a, b) => {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/**
 * 扁平化范围树（用于搜索）
 * @param {Array} nodes - 树节点列表
 * @param {number} level - 当前层级
 * @param {Array} result - 累积结果
 * @returns {Array} 扁平节点列表
 */
const flattenScopeTree = (nodes, level = 0, result = []) => {
  ;(nodes || []).forEach((node) => {
    result.push({ ...node, level })
    if (node.children && node.children.length > 0) {
      flattenScopeTree(node.children, level + 1, result)
    }
  })
  return result
}

const flatNodes = computed(() => flattenScopeTree(props.treeData))

const filteredFlatNodes = computed(() => {
  if (!searchKeyword.value) return flatNodes.value
  const keyword = searchKeyword.value.toLowerCase()
  return flatNodes.value.filter((node) => (node.name || '').toLowerCase().includes(keyword))
})

const selectedNode = computed(() => {
  if (props.modelValue == null || props.modelValue === '') return null
  return flatNodes.value.find((node) => sameNodeId(node.id, props.modelValue)) || null
})

const selectedNodeName = computed(() => (selectedNode.value ? selectedNode.value.name : ''))

/**
 * 根据文件夹节点解析图标组件
 * @param {Object} data - 文件夹节点
 * @returns {Object} 图标组件
 */
const resolveFolderIcon = (data) => {
  if (!data) return Folder
  if (data.isSpaceRoot) return Folder
  if (data.folder_type === 'PUBLIC' && data.is_province_public) return OfficeBuilding
  if (data.folder_type === 'PUBLIC' && data.is_org_granted) return School
  return Folder
}

/**
 * 根据文件夹节点解析图标样式类
 * @param {Object} data - 文件夹节点
 * @returns {string} 样式类名
 */
const resolveFolderIconClass = (data) => {
  if (!data) return 'icon-default'
  if (data.isSpaceRoot) {
    return data.folder_type === 'PUBLIC' ? 'icon-public' : 'icon-personal'
  }
  if (data.folder_type === 'PUBLIC' && data.is_province_public) return 'icon-public-province'
  if (data.folder_type === 'PUBLIC' && data.is_org_granted) return 'icon-public-org'
  if (data.folder_type === 'PUBLIC') return 'icon-public'
  if (data.folder_type === 'PERSONAL') return 'icon-personal'
  return 'icon-default'
}

const selectedNodeIcon = computed(() => resolveFolderIcon(selectedNode.value))
const selectedNodeIconClass = computed(() => resolveFolderIconClass(selectedNode.value))

/**
 * 展开/收起下拉面板
 */
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

/**
 * 选中范围节点
 * @param {Object} node - 树节点
 */
const handleSelectNode = (node) => {
  if (!node || node.disabled) return
  emit('update:modelValue', node.id)
  showDropdown.value = false
  searchKeyword.value = ''
}

/**
 * 切换树节点展开状态
 * @param {string|number} nodeId - 节点 id
 */
const toggleFolderExpand = (nodeId) => {
  if (expandedFolders.value.has(nodeId)) {
    expandedFolders.value.delete(nodeId)
  } else {
    expandedFolders.value.add(nodeId)
  }
  expandedFolders.value = new Set(expandedFolders.value)
}

/**
 * 点击外部关闭下拉
 * @param {MouseEvent} e - 鼠标事件
 */
const handleClickOutside = (e) => {
  if (showDropdown.value && !e.target.closest('.fm-scope-selector')) {
    showDropdown.value = false
    searchKeyword.value = ''
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fm-scope-selector {
  position: relative;
  width: 100%;
}

.selector-trigger {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 0;
  background: var(--sd-canvas, #ffffff);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.selector-trigger > * + * {
  margin-left: 8px;
}

.selector-trigger:hover,
.selector-trigger.active {
  border-color: var(--sd-primary, #195fb4);
}

.trigger-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: var(--sd-primary, #195fb4);
}

.trigger-text {
  flex: 1;
  font-size: 14px;
  color: var(--sd-ink, #161616);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.trigger-arrow {
  font-size: 12px;
  color: var(--sd-ink-subtle, #8c8c8c);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.trigger-arrow.expanded {
  transform: rotate(180deg);
}

.selector-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 0;
  box-shadow: var(--sd-shadow-card-hover, 0 2px 8px rgba(0, 0, 0, 0.08));
  z-index: 1000;
  max-height: 400px;
  overflow: hidden;
}

.dropdown-search {
  padding: 8px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 0;
  font-size: 13px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  outline: none;
  border-color: var(--sd-primary, #195fb4);
}

.dropdown-list {
  max-height: 342px;
  overflow-y: auto;
  padding: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dropdown-item > * + * {
  margin-left: 8px;
}

.dropdown-item:hover:not(.disabled) {
  background-color: var(--sd-surface-1, #f4f4f4);
}

.dropdown-item.selected {
  background-color: var(--sd-primary-light, #e8f0f8);
}

.dropdown-item.disabled {
  cursor: not-allowed;
}

.item-icon {
  font-size: 16px;
  flex-shrink: 0;
  color: var(--sd-primary, #195fb4);
}

.item-name {
  font-size: 14px;
  color: var(--sd-ink, #161616);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-item.selected .item-name {
  color: var(--sd-primary, #195fb4);
  font-weight: 500;
}

.dropdown-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--sd-ink-subtle, #8c8c8c);
  font-size: 13px;
}

.dropdown-list :deep(.fm-scope-tree-node) {
  width: 100%;
}
</style>
