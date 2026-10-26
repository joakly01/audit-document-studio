<template>
  <div class="fm-scope-tree-node">
    <div
      class="dropdown-item tree-item"
      :class="{
        selected: isSelected,
        disabled: node.disabled
      }"
      :style="{ paddingLeft: `${level * 16 + 12}px` }"
    >
      <el-icon
        v-if="canExpand"
        class="tree-expand-icon"
        :class="{ expanded: expandedFolders.has(node.id) }"
        @click.stop="handleToggleExpand"
      >
        <CaretRight />
      </el-icon>
      <span v-else class="tree-expand-placeholder"></span>

      <div class="tree-item-content" @click="handleSelect">
        <el-icon class="item-icon" :class="iconClass">
          <component :is="iconComponent" />
        </el-icon>
        <span class="item-name">{{ node.name }}</span>
      </div>
    </div>

    <template v-if="canExpand && expandedFolders.has(node.id) && node.children && node.children.length > 0">
      <file-manager-scope-tree-node
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        @select="$emit('select', $event)"
        @toggle-expand="$emit('toggle-expand', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CaretRight, Folder, OfficeBuilding, School } from '@element-plus/icons-vue'

const props = defineProps({
  /** 树节点数据 */
  node: {
    type: Object,
    required: true
  },
  /** 当前选中节点 id */
  selectedId: {
    type: [String, Number],
    default: null
  },
  /** 缩进层级 */
  level: {
    type: Number,
    default: 0
  },
  /** 已展开节点 id 集合 */
  expandedFolders: {
    type: Set,
    required: true
  }
})

const emit = defineEmits(['select', 'toggle-expand'])

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

const isSelected = computed(() => sameNodeId(props.node.id, props.selectedId))

/**
 * 是否允许在范围下拉中展开子节点（个人空间根仅可选中，不可展开）
 * @returns {boolean} 是否可展开
 */
const canExpand = computed(() => {
  const n = props.node
  if (!n || !Array.isArray(n.children) || n.children.length === 0) {
    return false
  }
  const isPersonalSpaceRoot = !!(
    n.isSpaceRoot
    && (n.folder_type === 'PERSONAL' || n.name === '个人空间')
  )
  return !isPersonalSpaceRoot
})

/**
 * 根据文件夹节点解析图标组件
 * @param {Object} data - 文件夹节点
 * @returns {Object} 图标组件
 */
const resolveFolderIcon = (data) => {
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
  if (data.isSpaceRoot) {
    return data.folder_type === 'PUBLIC' ? 'icon-public' : 'icon-personal'
  }
  if (data.folder_type === 'PUBLIC' && data.is_province_public) return 'icon-public-province'
  if (data.folder_type === 'PUBLIC' && data.is_org_granted) return 'icon-public-org'
  if (data.folder_type === 'PUBLIC') return 'icon-public'
  if (data.folder_type === 'PERSONAL') return 'icon-personal'
  return 'icon-default'
}

const iconComponent = computed(() => resolveFolderIcon(props.node))
const iconClass = computed(() => resolveFolderIconClass(props.node))

/**
 * 切换子节点展开状态（个人空间根不可展开）
 */
const handleToggleExpand = () => {
  if (!canExpand.value) return
  emit('toggle-expand', props.node.id)
}

/**
 * 选中当前节点（禁用节点不可选）
 */
const handleSelect = () => {
  if (props.node.disabled) return
  emit('select', props.node)
}
</script>

<style scoped>
.fm-scope-tree-node {
  width: 100%;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tree-item:hover:not(.disabled) {
  background-color: var(--sd-surface-1, #f4f4f4);
}

.tree-item.selected {
  background-color: var(--sd-primary-light, #e8f0f8) !important;
}

.tree-item.disabled {
  cursor: not-allowed;
}

.tree-item.selected .item-name {
  color: var(--sd-primary, #195fb4);
  font-weight: 500;
}

.tree-expand-icon {
  width: 16px;
  height: 16px;
  font-size: 14px;
  color: var(--sd-ink-subtle, #8c8c8c);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.3s;
}

.tree-expand-icon.expanded {
  transform: rotate(90deg);
}

.tree-expand-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.tree-item-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.tree-item-content > * + * {
  margin-left: 8px;
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
</style>
