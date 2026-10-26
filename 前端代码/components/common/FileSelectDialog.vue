<template>
  <el-dialog
    v-model="dialogVisible"
    title="选择文件"
    :width="isFullscreen ? '100%' : '90vw'"
    :fullscreen="isFullscreen"
    top="6vh"
    :close-on-click-modal="false"
    class="file-select-dialog"
    @closed="handleClosed"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">选择文件</span>
        <div class="dialog-header-actions">
          <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏'" placement="bottom">
            <el-button link type="primary" @click="toggleFullscreen">
              <el-icon><FullScreen /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </template>
    <div class="file-select-body">
      <!-- 左侧：文件树（仅展示至少具有查看权限的文件夹） -->
      <div class="tree-panel">
        <div class="tree-panel-title">文件夹</div>
        <!-- 文件夹搜索：前端本地过滤树节点 -->
        <div class="tree-search-row">
          <el-input
            v-model="fileSearchKeyword"
            placeholder="搜索文件夹名"
            size="small"
            clearable
            :prefix-icon="Search"
            class="file-search-input"
            @clear="handleTreeSearchClear"
            @keyup.enter="handleTreeSearchEnter"
          />
          <el-button
            type="primary"
            size="small"
            :disabled="!fileSearchKeyword || !fileSearchKeyword.trim()"
            @click="handleTreeSearchEnter"
          >
            搜索
          </el-button>
          <el-tooltip content="刷新文件夹" placement="bottom" :show-after="200">
            <el-button
              circle
              size="small"
              class="tree-refresh-btn"
              :loading="treeRefreshLoading"
              @click="handleRefreshFolderTree"
            >
              <el-icon v-if="!treeRefreshLoading"><RefreshRight /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <el-tree
          v-loading="treeLoading || treeRefreshLoading"
          :data="filteredTreeData"
          :props="{ label: 'name', children: 'children' }"
          :expand-on-click-node="false"
          node-key="id"
          highlight-current
          :default-expanded-keys="treeExpandedKeys"
          @node-click="handleFolderClick"
        >
          <template #default="{ node, data }">
            <div
              class="tree-node"
              :class="{ 'is-disabled': !data.isSpaceRoot && isFolderDisabled(data.id) }"
            >
              <el-icon class="folder-icon"><Folder /></el-icon>
              <span
                class="node-label"
                :class="{ 'is-disabled': !data.isSpaceRoot && isFolderDisabled(data.id) }"
              >
                {{ node.label }}
              </span>
              <el-dropdown
                v-if="props.allowFolderSelect && !data.isSpaceRoot && !props.singleSelect && !isFolderDisabled(data.id)"
                trigger="click"
                @command="(cmd) => handleSelectFolderCommand(data, cmd)"
              >
                <el-button
                  type="primary"
                  :icon="Plus"
                  size="small"
                  text
                  circle
                  class="add-folder-btn"
                  title="选择文件夹"
                  @click.stop
                />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="SELF">选择本级</el-dropdown-item>
                    <el-dropdown-item command="SELF_AND_DESC">选择本级及以下</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <span
                v-else-if="!data.isSpaceRoot && isFolderDisabled(data.id)"
                class="selected-tag"
              >
                已选
              </span>
            </div>
          </template>
        </el-tree>
      </div>
      <!-- 右侧：文件列表（仅展示至少具有查看权限的文件） -->
      <div class="list-panel">
        <div class="list-panel-header">
          <span class="list-panel-title">{{ currentFolderName || '请选择文件夹' }}</span>
          <span class="list-panel-subtitle">{{ listFilterSubtitle }}</span>
        </div>
        <div class="list-search-row">
          <el-input
            v-model="listSearchKeyword"
            placeholder="搜索文件"
            size="small"
            clearable
            :disabled="isProjectSpaceRootActive"
            @clear="handleListSearchClear"
            @keyup.enter="handleListSearch"
          />
          <el-select v-model="listSearchScope" size="small" style="width: 140px;" :disabled="isProjectSpaceRootActive">
            <el-option label="本级" :value="false" />
            <el-option label="本级及子文件夹" :value="true" />
          </el-select>
          <el-button type="primary" size="small" :disabled="isProjectSpaceRootActive" @click="handleListSearch">
            搜索
          </el-button>
        </div>
        <el-table
          v-loading="listLoading"
          :data="fileList"
          :type="props.singleSelect ? undefined : 'selection'"
          :row-key="(row) => row.file_id"
          border
          max-height="320"
          :empty-text="listEmptyText"
          @selection-change="handleSelectionChange"
          @row-click="handleRowClick"
          :highlight-current-row="props.singleSelect"
        >
          <el-table-column v-if="!props.singleSelect" type="selection" width="50" :selectable="checkRowSelectable" />
          <el-table-column v-if="props.singleSelect" type="index" width="50" label="序号" />
          <el-table-column prop="file_name" label="文件名" min-width="200" show-overflow-tooltip />
          <el-table-column prop="folder_path" label="所在文件夹" min-width="260" show-overflow-tooltip />
          <el-table-column prop="file_size" label="大小" width="100">
            <template #default="{ row }">
              {{ formatSize(row.file_size) }}
            </template>
          </el-table-column>
          <el-table-column v-if="props.showParseStatus" prop="document_parse_status" label="解析状态" width="100">
            <template #default="{ row }">
              <el-tag
                :type="getParseStatusType(row)"
                size="small"
                effect="plain"
              >
                {{ getParseStatusLabel(row) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div
          v-if="currentFolderId && !isGlobalSearch && String(currentFolderId).startsWith('space_') === false"
          class="list-pagination"
        >
          <el-pagination
            v-model:current-page="listPage"
            v-model:page-size="listPageSize"
            :page-sizes="[10, 20, 50, 100, 1000]"
            :total="listTotal"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handleListPageChange"
            @size-change="handleListPageSizeChange"
          />
        </div>
        <div v-if="selectedRows.length > 0 && !props.singleSelect" class="list-panel-footer">
          <span class="selected-hint">已选 {{ selectedRows.length }} 个文件</span>
          <el-button type="primary" size="small" :icon="Plus" @click="handleAddSelected">
            添加到已选择
          </el-button>
        </div>
      </div>
      <!-- 右侧：已选择区域 -->
      <div class="selected-panel">
        <div class="selected-panel-header">
          <span class="selected-panel-title">已选择</span>
          <el-button
            v-if="confirmedSelectedFiles.length > 0 || selectedFolders.length > 0"
            type="danger"
            size="small"
            text
            @click="handleClearAll"
          >
            清空
          </el-button>
        </div>
        <div class="selected-list">
          <div v-if="selectedFolders.length === 0 && confirmedSelectedFiles.length === 0" class="selected-empty">
            <el-empty description="暂无已选择内容" :image-size="60" style="padding: 28px 0;" />
          </div>

          <div v-if="props.allowFolderSelect && selectedFolders.length > 0" class="selected-section">
            <div class="selected-section-title">已选择文件夹 ({{ selectedFolders.length }})</div>
            <el-tree
              class="selected-folder-tree"
              :data="selectedFolderTree"
              :props="{ label: 'label', children: 'children' }"
              node-key="id"
              default-expand-all
              :expand-on-click-node="false"
            >
              <template #default="{ data }">
                <div class="selected-folder-node">
                  <div class="selected-folder-main">
                    <el-icon class="folder-icon"><Folder /></el-icon>
                    <span class="selected-folder-label">{{ data.label }}</span>
                    <el-tag v-if="data.scopeLabel" size="small" type="info" effect="plain" class="scope-tag">
                      {{ data.scopeLabel }}
                    </el-tag>
                    <el-button
                      v-if="data.isLeaf"
                      type="danger"
                      :icon="Delete"
                      size="small"
                      text
                      circle
                      class="remove-btn"
                      @click.stop="handleRemoveFolder(data.folder_id, data.scope)"
                      title="移除"
                    />
                  </div>
                  <el-tooltip v-if="data.path" :content="data.path" placement="top">
                    <div class="selected-folder-path">{{ data.path }}</div>
                  </el-tooltip>
                </div>
              </template>
            </el-tree>
          </div>

          <div v-if="confirmedSelectedFiles.length > 0" class="selected-section">
            <div class="selected-section-title">已选择文件 ({{ confirmedSelectedFiles.length }})</div>
            <div class="selected-items">
              <div
                v-for="file in confirmedSelectedFiles"
                :key="file.file_id"
                class="selected-item"
              >
                <el-icon class="file-icon"><Document /></el-icon>
                <span class="file-name" :title="getDisplayName(file)">{{ getDisplayName(file) }}</span>
                <el-button
                  type="danger"
                  :icon="Delete"
                  size="small"
                  text
                  circle
                  @click="handleRemoveFile(file.file_id)"
                  title="移除"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <span v-if="props.showFileTypeHint || props.showParseStatus">
            筛选条件：{{ listFilterSubtitle }}
          </span>
        </div>
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" :disabled="confirmedSelectedFiles.length === 0 && selectedFolders.length === 0" @click="handleConfirm">
          确认 ({{ selectedFolders.length + confirmedSelectedFiles.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Folder, Search, Plus, Delete, Document, FullScreen, RefreshRight } from '@element-plus/icons-vue'
import { getFolderTreeAPI, getFileListAPI, getFileSpaceTypesAPI } from '@/api/fileManager.js'
import { getProjectSpaceTreeAPI } from '@/api/projectSpace.js'
import { getToken } from '@/utils/request/token.js'
import { useFileParseStatusDict } from '@/views/file-manager-code/composables/useFileParseStatusDict.js'

const {
  loadParseStatusDict,
  resolveStatusValue,
  getLabel: getParseStatusDictLabel,
  getTagType: getParseStatusDictTagType,
  isParsed: isParsedByStatus
} = useFileParseStatusDict()

/** 弹窗会话级文件夹树缓存：同页多次打开复用，手动「刷新文件夹」或强制刷新时更新 */
let cachedTreeRoots = null

function cloneTreeRoots(roots) {
  if (!roots || !Array.isArray(roots)) return []
  return JSON.parse(JSON.stringify(roots))
}

function applyTreeRootsToState(roots) {
  folderPathCache.clear()
  treeData.value = roots
  filteredTreeData.value = roots
  treeExpandedKeys.value = []
}

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  canSelectFileType: {
    type: Array,
    default: () => []
  },
  /** 打开弹框时的初始已选文件,用于反显已有选择 */
  initialSelectedFiles: {
    type: Array,
    default: () => []
  },
  /** 打开弹框时的初始已选文件夹,用于反显已有选择 */
  initialSelectedFolders: {
    type: Array,
    default: () => []
  },
  /** 是否启用单选模式，为 true 时只能选择一个文件 */
  singleSelect: {
    type: Boolean,
    default: false
  },
  /** 是否允许选择文件夹（false 时仅可选文件，隐藏文件夹「+」按钮） */
  allowFolderSelect: {
    type: Boolean,
    default: true
  },
  /** V2 模式：confirm 回传 { folders, files }；默认兼容老调用方仅回传 files[] */
  returnObject: {
    type: Boolean,
    default: false
  },
  /** 未解析文件是否可选；false 时仅允许 parsed 文件 */
  allowUnparsed: {
    type: Boolean,
    default: true
  },
  /** 底部提示：可选择文件后缀名(...) */
  showFileTypeHint: {
    type: Boolean,
    default: true
  },
  /** 是否显示解析状态列 */
  showParseStatus: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const isFullscreen = ref(false)
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

const treeLoading = ref(false)
const treeRefreshLoading = ref(false)
const listLoading = ref(false)
const treeData = ref([])
const treeExpandedKeys = ref([]) // 默认不展开任何节点
const fileList = ref([])
const listPage = ref(1)
const listPageSize = ref(100)
const listTotal = ref(0)
const currentFolderId = ref(null)
const currentFolderName = ref('')
const selectedRows = ref([])
const fileSearchKeyword = ref('')
const confirmedSelectedFiles = ref([]) // 已确认选择的文件列表（去重，包含 folder_path）
const isGlobalSearch = ref(false) // 是否处于全局搜索模式
const selectedFolders = ref([]) // [{ folder_id, folder_name, folder_path, scope, eligible_count }]
const filteredTreeData = ref([]) // 用于展示的过滤后树数据
const listSearchKeyword = ref('')
const listSearchScope = ref(false) // false: 本级, true: 本级及子文件夹

// 缓存 folder_id -> 完整路径 文本，避免重复计算
const folderPathCache = new Map()

/** 按空间根节点拉全量文件：后端 by-space 仅支持 PUBLIC / PERSONAL */
const BY_SPACE_SUPPORTED_ROOT_TYPES = new Set(['PUBLIC', 'PERSONAL'])
const PROJECT_SPACE_ROOT_EMPTY_TEXT =
  '项目空间不支持在空间根节点浏览全部文件，请展开并选择具体项目或文件夹'

function isUnsupportedSpaceRoot(spaceType) {
  return spaceType != null && !BY_SPACE_SUPPORTED_ROOT_TYPES.has(String(spaceType))
}

function isProjectSpaceRootFolderId(folderId) {
  return folderId != null && String(folderId) === 'space_PROJECT'
}

/** 空间根节点不支持 by-space 时的列表空态（不请求接口） */
function applyUnsupportedSpaceRootListState() {
  listLoading.value = false
  fileList.value = []
  listTotal.value = 0
  selectedRows.value = []
}
function convertTreeData(data, defaultFolderType = null) {
  if (!data || !Array.isArray(data)) return []
  return data.map((item) => ({
    name: item.folder_name || item.name,
    id: item.folder_id || item.id,
    folder_type: item.folder_type || defaultFolderType,
    node_type: item.node_type || null,
    isSpaceRoot: false,
    children: item.children ? convertTreeData(item.children, defaultFolderType) : []
  }))
}

// 在树中查找指定 folderId 的路径（包含空间根节点名称）
function findFolderPath(folderId) {
  if (!folderId || !treeData.value || treeData.value.length === 0) return null

  const dfs = (node, path) => {
    const nextPath = [...path, node]
    if (node.id === folderId) {
      return nextPath
    }
    if (!node.children || node.children.length === 0) return null
    for (const child of node.children) {
      const res = dfs(child, nextPath)
      if (res) return res
    }
    return null
  }

  for (const root of treeData.value) {
    const res = dfs(root, [])
    if (res && res.length > 0) return res
  }
  return null
}

// 根据 folderId 获取完整路径字符串，例如：公共空间 / 子文件夹A / 子文件夹B
function getFolderPathText(folderId) {
  if (!folderId) return ''
  if (folderPathCache.has(folderId)) {
    return folderPathCache.get(folderId)
  }
  const pathNodes = findFolderPath(folderId)
  if (!pathNodes || pathNodes.length === 0) {
    folderPathCache.set(folderId, '')
    return ''
  }
  const text = pathNodes.map(n => n.name).join(' / ')
  folderPathCache.set(folderId, text)
  return text
}

function _normalizeExt(ext) {
  if (!ext) return ''
  const s = String(ext).trim()
  if (!s) return ''
  return s.startsWith('.') ? s : `.${s}`
}

/**
 * 从列表行解析小写扩展名（不含点），仅读 file_extension 字段，与后端列表过滤口径一致
 * @param {Object} row 文件行
 * @returns {string} 扩展名
 */
function getRowExtension(row) {
  const fromField = row && row.file_extension
  if (!fromField) return ''
  return _normalizeExt(fromField).slice(1).toLowerCase()
}

/**
 * 当前弹窗允许的后缀集合（小写、不含点）
 * @returns {Set<string>} 后缀集合
 */
function getAllowedExtensionSet() {
  const list = Array.isArray(props.canSelectFileType) ? props.canSelectFileType : []
  const set = new Set()
  list.forEach((ext) => {
    const normalized = _normalizeExt(ext).slice(1).toLowerCase()
    if (normalized) set.add(normalized)
  })
  return set
}

/**
 * 判断行后缀是否在允许列表内；未配置后缀时视为全部允许
 * @param {Object} row 文件行
 * @returns {boolean} 是否允许
 */
function isAllowedFileType(row) {
  const allowed = getAllowedExtensionSet()
  if (allowed.size === 0) return true
  const ext = getRowExtension(row)
  return !!ext && allowed.has(ext)
}

/** 文件类型筛选展示文案 */
const fileTypeFilterLabel = computed(() => {
  const list = Array.isArray(props.canSelectFileType) ? props.canSelectFileType : []
  if (!list.length) return '全部文件'
  return list
    .map((ext) => _normalizeExt(ext).slice(1))
    .filter(Boolean)
    .join('/')
})

/** 解析状态筛选展示文案 */
const parseStatusFilterLabel = computed(() => (
  props.allowUnparsed ? '含未解析' : '仅已解析'
))

/** 列表区副标题：类型 | 解析状态 */
const listFilterSubtitle = computed(() => (
  `${fileTypeFilterLabel.value} | ${parseStatusFilterLabel.value}`
))

/** 列表区空态文案 */
const listEmptyText = computed(() => {
  if (isGlobalSearch.value) return '未搜索到文件'
  if (isProjectSpaceRootFolderId(currentFolderId.value)) {
    return PROJECT_SPACE_ROOT_EMPTY_TEXT
  }
  return '请先在左侧选择一个文件夹'
})

/** 当前选中项目空间根节点时，禁用列表搜索（避免再次触发 by-space） */
const isProjectSpaceRootActive = computed(() => isProjectSpaceRootFolderId(currentFolderId.value))

function isParsedFile(row) {
  if (row?.parse_status != null) {
    return isParsedByStatus(row)
  }
  return String(row?.document_parse_status || '').toLowerCase() === 'parsed'
}

function isRowEligible(row) {
  if (!props.allowUnparsed && !isParsedFile(row)) return false
  if (!isAllowedFileType(row)) return false
  return true
}

/** 与列表接口一致的服务端筛选 query（解析状态 + 可选后缀） */
function serverListFilterQuery() {
  const q = {}
  if (!props.allowUnparsed) {
    q.parse_status = '2'
  }
  const allowed = getAllowedExtensionSet()
  if (allowed.size > 0) {
    q.file_extensions = Array.from(allowed).join(',')
  }
  return q
}

function appendServerFiltersToURLSearchParams(params) {
  const f = serverListFilterQuery()
  Object.keys(f).forEach((k) => {
    const v = f[k]
    if (v != null && v !== '') params.append(k, String(v))
  })
}

function getParseStatusType(row) {
  return getParseStatusDictTagType(row)
}

function getParseStatusLabel(row) {
  return getParseStatusDictLabel(row)
}

// 检查某个 folderId 是否已被选为文件夹（包括作为子孙被选的情况）
function isFolderDisabled(folderId) {
  if (!folderId || selectedFolders.value.length === 0) return false
  return selectedFolders.value.some(f => {
    if (f.scope === 'SELF') {
      // 仅本级：只有自己被选中才算
      return f.folder_id === folderId
    } else {
      // 本级及以下：自己或子孙都算
      return f.folder_id === folderId || isDescendantOf(folderId, f.folder_id)
    }
  })
}

// 判断 childId 是否是 ancestorId 的子孙（后代）
function isDescendantOf(childId, ancestorId) {
  if (!childId || !ancestorId) return false
  const path = findFolderPath(childId)
  if (!path || path.length === 0) return false
  return path.some(node => node.id === ancestorId)
}

// 加载文件夹树（由数据字典 file_space_type 动态驱动，仅返回有查看权限的节点）
async function loadFolderTree(options = {}) {
  const { forceRefresh = false, useClientCache = true } = options

  if (treeRefreshLoading.value) return
  if (treeLoading.value && !forceRefresh) return

  if (useClientCache && !forceRefresh && cachedTreeRoots && cachedTreeRoots.length > 0) {
    applyTreeRootsToState(cloneTreeRoots(cachedTreeRoots))
    return
  }

  treeLoading.value = true
  try {
    let spaceTypes = []
    try {
      const dictRes = await getFileSpaceTypesAPI()
      if (dictRes?.code === 200 && Array.isArray(dictRes?.data)) {
        const sorted = [...dictRes.data].sort((a, b) => {
          const aOrder = typeof a.sort_order === 'number' ? a.sort_order : 0
          const bOrder = typeof b.sort_order === 'number' ? b.sort_order : 0
          return aOrder - bOrder
        })
        spaceTypes = sorted.map((item) => ({
          code: item.key_code,
          label: item.label || item.key_code
        }))
      }
    } catch (e) {
      console.warn('获取空间类型字典失败，使用兜底配置:', e)
    }

    if (spaceTypes.length === 0) {
      spaceTypes = [
        { code: 'PUBLIC', label: '公共空间' },
        { code: 'PERSONAL', label: '个人空间' }
      ]
    }

    const buildSpaceTreeRequest = (st) => {
      if (st.code === 'PROJECT') {
        return getProjectSpaceTreeAPI(forceRefresh ? { refresh: true } : undefined)
      }
      return getFolderTreeAPI({
        space_type: st.code,
        ...(forceRefresh ? { refresh: true } : {})
      })
    }

    const treeResponses = await Promise.all(
      spaceTypes.map((st) => buildSpaceTreeRequest(st))
    )

    const roots = []
    spaceTypes.forEach((st, index) => {
      const res = treeResponses[index]
      if (res?.code === 200 && res?.data) {
        roots.push({
          name: st.label,
          id: `space_${st.code}`,
          folder_type: st.code,
          isSpaceRoot: true,
          children: convertTreeData(res.data, st.code)
        })
      }
    })

    cachedTreeRoots = cloneTreeRoots(roots)
    applyTreeRootsToState(roots)
  } catch (e) {
    console.error('加载文件夹树失败:', e)
    ElMessage.error('加载文件夹树失败')
    treeData.value = []
    filteredTreeData.value = []
    if (forceRefresh) {
      cachedTreeRoots = null
    }
  } finally {
    treeLoading.value = false
  }
}

async function handleRefreshFolderTree() {
  if (treeRefreshLoading.value || treeLoading.value) return
  treeRefreshLoading.value = true
  try {
    await loadFolderTree({ forceRefresh: true, useClientCache: false })
  } finally {
    treeRefreshLoading.value = false
  }
}

// 点击树节点
function handleFolderClick(data) {
  if (data?.isSpaceRoot) {
    // 加载该空间下的文件并显示（支持分页）
    isGlobalSearch.value = false
    currentFolderId.value = data.id
    currentFolderName.value = data.name
    listPage.value = 1
    listSearchKeyword.value = ''
    if (isUnsupportedSpaceRoot(data.folder_type)) {
      applyUnsupportedSpaceRootListState()
      return
    }
    loadFileListBySpace(data.folder_type)
    return
  }
  // 检查是否已被选为文件夹
  if (isFolderDisabled(data.id)) {
    ElMessage.warning('该文件夹已被选择，请从右侧已选区域管理')
    return
  }
  // 退出全局搜索模式
  isGlobalSearch.value = false
  currentFolderId.value = data.id
  currentFolderName.value = data.name
  listPage.value = 1
  loadFileList()
}

// 加载文件列表（仅返回有查看权限的文件，支持按文件名模糊搜索）
async function loadFileList() {
  if (!currentFolderId.value) {
    fileList.value = []
    listTotal.value = 0
    return
  }
  // 如果是空间根节点，调用 loadFileListBySpace
  if (currentFolderId.value.startsWith('space_')) {
    const spaceType = currentFolderId.value.replace('space_', '')
    if (isUnsupportedSpaceRoot(spaceType)) {
      applyUnsupportedSpaceRootListState()
      return
    }
    return loadFileListBySpace(spaceType, listSearchKeyword.value)
  }
  listLoading.value = true
  selectedRows.value = []
  try {
    const params = {
      folder_id: currentFolderId.value,
      page: listPage.value,
      page_size: listPageSize.value,
      recursive: listSearchScope.value,
      ...serverListFilterQuery()
    }
    const kw = listSearchKeyword.value?.trim()
    if (kw) {
      params.search = kw
    }
    const res = await getFileListAPI(params)
    if (res?.code === 200 && res?.data?.files) {
      const files = res.data.files || []
      listTotal.value = Number(res.data.total || 0)

      fileList.value = files.map((f) => ({
        file_id: f.file_id,
        file_name: f.file_name || f.original_name || '',
        file_size: f.file_size,
        file_extension: f.file_extension || '',
        document_parse_status: f.document_parse_status,
        parse_status: f.parse_status != null ? f.parse_status : 0,
        folder_path: getFolderPathText(f.folder_id)
      }))
    } else {
      fileList.value = []
      listTotal.value = 0
    }
  } catch (e) {
    console.error('加载文件列表失败:', e)
    ElMessage.error('加载文件列表失败')
    fileList.value = []
    listTotal.value = 0
  } finally {
    listLoading.value = false
  }
}

function handleListPageChange(page) {
  listPage.value = page
  loadFileList()
}

function handleListPageSizeChange(size) {
  listPageSize.value = size
  listPage.value = 1
  loadFileList()
}

// 按空间加载文件列表（用于点击公共空间/个人空间时），支持分页和搜索
async function loadFileListBySpace(spaceType, searchKeyword = '') {
  if (isUnsupportedSpaceRoot(spaceType)) {
    applyUnsupportedSpaceRootListState()
    return
  }

  listLoading.value = true
  selectedRows.value = []
  isGlobalSearch.value = false

  try {
    if (!treeData.value || treeData.value.length === 0) {
      await loadFolderTree({ useClientCache: true })
    }

    const token = getToken()
    const params = new URLSearchParams()
    params.append('space_type', spaceType)
    params.append('page', String(listPage.value))
    params.append('page_size', String(listPageSize.value))
    if (searchKeyword && searchKeyword.trim()) {
      params.append('search', searchKeyword.trim())
    }
    appendServerFiltersToURLSearchParams(params)

    const resp = await fetch(`/api/v1/file-manager/files/by-space?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Agent-Token': token } : {})
      }
    })

    if (!resp.ok) {
      throw new Error(`加载失败: ${resp.status}`)
    }

    const res = await resp.json()
    if (res?.code === 200 && res?.data?.files) {
      const files = res.data.files || []
      listTotal.value = Number(res.data.total || 0)

      fileList.value = files.map((f) => ({
        file_id: f.file_id,
        file_name: f.file_name || f.original_name || '',
        file_size: f.file_size,
        file_extension: f.file_extension || '',
        document_parse_status: f.document_parse_status,
        parse_status: f.parse_status != null ? f.parse_status : 0,
        folder_path: getFolderPathText(f.folder_id)
      }))
    } else {
      fileList.value = []
      listTotal.value = 0
    }
  } catch (e) {
    console.error('按空间加载文件失败:', e)
    ElMessage.error('按空间加载文件失败')
    fileList.value = []
    listTotal.value = 0
  } finally {
    listLoading.value = false
  }
}

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '-'
  const u = 1024
  if (bytes < u) return bytes + ' B'
  if (bytes < u * u) return (bytes / u).toFixed(1) + ' KB'
  return (bytes / (u * u)).toFixed(1) + ' MB'
}

// 检查行是否可被勾选（根据文件后缀限制）
function checkRowSelectable(row) {
  return isRowEligible(row)
}

function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// 单选模式下的行点击处理
function handleRowClick(row) {
  if (!props.singleSelect) return

  // 检查该行是否可选
  if (!checkRowSelectable(row)) {
    if (!props.allowUnparsed && !isParsedFile(row)) {
      ElMessage.warning('该文件尚未解析，暂不可选')
    } else if (!isAllowedFileType(row)) {
      ElMessage.warning(`仅支持以下类型：${fileTypeFilterLabel.value}`)
    } else {
      ElMessage.warning('该文件不可选')
    }
    return
  }

  // 单选模式下，点击行直接设置为唯一选中的文件
  const newFile = {
    file_id: row.file_id,
    file_name: row.file_name || '',
    folder_path: row.folder_path || ''
  }
  confirmedSelectedFiles.value = [newFile]
}

function handleCancel() {
  dialogVisible.value = false
}

// 将当前选中的文件添加到已选择区域
function handleAddSelected() {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  const newFiles = selectedRows.value.map((r) => ({
    file_id: r.file_id,
    file_name: r.file_name || '',
    folder_path: r.folder_path || ''
  }))
  addFilesToConfirmed(newFiles)
  ElMessage.success(`已添加 ${newFiles.length} 个文件`)
}

async function computeEligibleCount(folderId, scope) {
  const recursive = scope === 'SELF_AND_DESC'
  const res = await getFileListAPI({
    folder_id: folderId,
    page: 1,
    page_size: 1,
    recursive,
    ...serverListFilterQuery()
  })
  if (!(res?.code === 200 && res?.data)) return 0
  return Number(res.data.total || 0)
}

async function addFolderSelection(folderNode, scope) {
  if (!folderNode?.id || folderNode?.isSpaceRoot) return
  const folderId = folderNode.id
  const existed = selectedFolders.value.some((x) => x.folder_id === folderId && x.scope === scope)
  if (existed) {
    ElMessage.info('该文件夹已选择')
    return
  }

  // 检查已选文件中是否有属于该文件夹的文件
  const folderPathPrefix = getFolderPathText(folderId)
  const filesInFolder = confirmedSelectedFiles.value.filter((f) => {
    // 检查文件路径是否以该文件夹路径开头（本级）或是子孙
    if (scope === 'SELF') {
      return f.folder_path === folderPathPrefix
    } else {
      return f.folder_path === folderPathPrefix || f.folder_path?.startsWith(folderPathPrefix + '/')
    }
  })

  const folder_path = folderPathPrefix
  const item = {
    folder_id: folderId,
    folder_name: folderNode.name || '',
    folder_path,
    scope,
    eligible_count: 0
  }
  selectedFolders.value.push(item)

  // 提示合并信息
  if (filesInFolder.length > 0) {
    ElMessage.success(`已选中的 ${filesInFolder.length} 个文件已合并到文件夹"${folderNode.name}"中`)
    // 从已选文件列表中移除这些文件（因为已通过文件夹选择）
    const fileIdsToRemove = new Set(filesInFolder.map((f) => f.file_id))
    confirmedSelectedFiles.value = confirmedSelectedFiles.value.filter((f) => !fileIdsToRemove.has(f.file_id))
  }

  try {
    item.eligible_count = await computeEligibleCount(folderId, scope)
  } catch (e) {
    console.error('统计文件夹数量失败:', e)
    item.eligible_count = 0
  }
}

function handleSelectFolderCommand(folderNode, cmd) {
  // 前置检查：如果该文件夹或其祖先已被选，则提示并返回
  if (isFolderDisabled(folderNode?.id)) {
    ElMessage.warning('该文件夹已被选择，请从右侧已选区域管理')
    return
  }
  const scope = cmd === 'SELF_AND_DESC' ? 'SELF_AND_DESC' : 'SELF'
  addFolderSelection(folderNode, scope)
}

// 添加文件到已选择列表（去重）
function addFilesToConfirmed(files) {
  const existingIds = new Set(confirmedSelectedFiles.value.map((f) => f.file_id))
  const newFiles = files.filter((f) => !existingIds.has(f.file_id))
  confirmedSelectedFiles.value.push(...newFiles)
  if (newFiles.length < files.length) {
    ElMessage.info(`${files.length - newFiles.length} 个文件已存在，已跳过`)
  }
}

// 计算当前已选择列表中，哪些文件名是重复的
const duplicateNameSet = computed(() => {
  const counts = new Map()
  for (const f of confirmedSelectedFiles.value) {
    const name = f.file_name || ''
    if (!name) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  const dup = new Set()
  for (const [name, count] of counts.entries()) {
    if (count > 1) {
      dup.add(name)
    }
  }
  return dup
})

// 获取在右侧“已选择”面板中展示的文件名：
// - 如果文件名在当前列表中出现多次（但 file_id 不同），则展示“完整路径 / 文件名”
// - 否则只展示文件名
function getDisplayName(file) {
  const name = file.file_name || ''
  if (!name) return ''
  if (duplicateNameSet.value.has(name)) {
    const path = file.folder_path || ''
    return path ? `${path} / ${name}` : name
  }
  return name
}

// 从已选择列表中移除文件
function handleRemoveFile(fileId) {
  const index = confirmedSelectedFiles.value.findIndex((f) => f.file_id === fileId)
  if (index > -1) {
    confirmedSelectedFiles.value.splice(index, 1)
  }
}

// 清空已选择列表
function handleClearAll() {
  confirmedSelectedFiles.value = []
  selectedFolders.value = []
  ElMessage.success('已清空')
}

function handleConfirm() {
  const hasFiles = confirmedSelectedFiles.value.length > 0
  const hasFolders = props.allowFolderSelect && selectedFolders.value.length > 0
  if (!hasFiles && !hasFolders) {
    ElMessage.warning(props.allowFolderSelect ? '请至少选择一个文件或文件夹' : '请至少选择一个文件')
    return
  }

  // 构造输出结果
  const result = props.returnObject
    ? {
        folders: props.allowFolderSelect
          ? selectedFolders.value.map((f) => ({
              folder_id: f.folder_id,
              folder_name: f.folder_name,
              folder_path: f.folder_path,
              scope: f.scope,
              eligible_count: f.eligible_count
            }))
          : [],
        files: [...confirmedSelectedFiles.value],
        /** 与左侧文件夹树同源，供 SELF_AND_DESC 匹配子节点 children */
        treeData: treeData.value
      }
    : [...confirmedSelectedFiles.value]

  // 在控制台输出选择结果
  console.log('[FileSelectDialog] 选择结果:', result)

  dialogVisible.value = false
  nextTick(() => {
    emit('confirm', result)
  })
}

// 树节点本地过滤
function filterTreeByName(keyword) {
  if (!keyword || !keyword.trim()) {
    filteredTreeData.value = treeData.value
    treeExpandedKeys.value = []
    return
  }
  const kw = keyword.toLowerCase()
  function filterNode(node) {
    const match = (node.name || '').toLowerCase().includes(kw)
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children.map(filterNode).filter(Boolean)
      if (filteredChildren.length > 0 || match) {
        return { ...node, children: filteredChildren }
      }
    } else if (match) {
      return { ...node }
    }
    return null
  }
  const filtered = treeData.value.map(filterNode).filter(Boolean)
  filteredTreeData.value = filtered

  // 展开所有有子节点的节点
  const expanded = []
  function collectExpanded(nodes) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        expanded.push(node.id)
        collectExpanded(node.children)
      }
    }
  }
  collectExpanded(filtered)
  treeExpandedKeys.value = expanded
}

function handleTreeSearchEnter() {
  filterTreeByName(fileSearchKeyword.value)
}

// 清空树搜索时，还原完整树
function handleTreeSearchClear() {
  fileSearchKeyword.value = ''
  filterTreeByName('')
}

function handleListSearch() {
  listPage.value = 1
  loadFileList()
}

function handleListSearchClear() {
  listSearchKeyword.value = ''
  listPage.value = 1
  loadFileList()
}



function handleClosed() {
  currentFolderId.value = null
  currentFolderName.value = ''
  fileList.value = []
  selectedRows.value = []
  fileSearchKeyword.value = ''
  listSearchKeyword.value = ''
  listSearchScope.value = false
  confirmedSelectedFiles.value = []
  selectedFolders.value = []
  isFullscreen.value = false
  isGlobalSearch.value = false
  filteredTreeData.value = []
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      void loadParseStatusDict()
      loadFolderTree({ useClientCache: true })
      currentFolderId.value = null
      currentFolderName.value = ''
      fileList.value = []
      selectedRows.value = []
      fileSearchKeyword.value = ''
      listSearchKeyword.value = ''
      listSearchScope.value = false
      // 反显：若有初始选中文件则使用，否则清空
      const initial = props.initialSelectedFiles
      confirmedSelectedFiles.value = (initial && initial.length > 0)
        ? initial.map((f) => ({
            file_id: f.file_id,
            file_name: f.file_name || '',
            folder_path: f.folder_path || ''
          }))
        : []
      const initialFolders = props.allowFolderSelect ? props.initialSelectedFolders : []
      selectedFolders.value = (initialFolders && initialFolders.length > 0)
        ? initialFolders.map((f) => ({
            folder_id: f.folder_id,
            folder_name: f.folder_name || '',
            folder_path: f.folder_path || '',
            scope: f.scope || 'SELF',
            eligible_count: f.eligible_count != null ? f.eligible_count : 0
          }))
        : []
      isGlobalSearch.value = false
    }
  }
)

const selectedFolderTree = computed(() => {
  const roots = new Map()
  const ensureNode = (parentChildren, id, name) => {
    let n = parentChildren.get(id)
    if (!n) {
      n = {
        id,
        _name: name,
        childrenMap: new Map(),
        children: [],
        sum: 0
      }
      parentChildren.set(id, n)
    }
    return n
  }

  for (const f of selectedFolders.value) {
    const pathNodes = findFolderPath(f.folder_id) || []
    if (!pathNodes.length) continue
    let level = roots
    let last = null
    for (const pn of pathNodes) {
      const n = ensureNode(level, pn.id, pn.name)
      last = n
      level = n.childrenMap
    }
    if (last) {
      last.sum += Number(f.eligible_count || 0)
      last.isLeaf = true
      last.folder_id = f.folder_id
      last.scope = f.scope
      last.scopeLabel = f.scope === 'SELF_AND_DESC' ? '本级及以下' : '本级'
      last.path = f.folder_path || ''
    }
  }

  const finalize = (map) => {
    const arr = []
    for (const n of map.values()) {
      const children = finalize(n.childrenMap)
      let sum = n.sum
      for (const c of children) sum += Number(c._sum || 0)
      n._sum = sum
      n.children = children
      n.label = `${n._name}（${sum}）`
      arr.push(n)
    }
    return arr
  }
  return finalize(roots)
})

function handleRemoveFolder(folderId, scope) {
  selectedFolders.value = selectedFolders.value.filter((f) => !(f.folder_id === folderId && f.scope === scope))
}
</script>

<style scoped>
.dialog-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.dialog-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-select-body {
  display: flex;
  gap: 16px;
  min-height: 360px;
  height: 60vh;
}

.file-select-dialog.is-fullscreen .file-select-body {
  height: calc(100vh - 120px);
}

.tree-panel {
  width: 260px;
  flex-shrink: 0;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 100%;
  resize: horizontal;
  min-width: 220px;
  max-width: 46vw;
}

.tree-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 10px;
}

.tree-search-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.tree-search-row > * + * {
  margin-left: 6px;
}

.tree-refresh-btn {
  flex-shrink: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
  flex-shrink: 1;
}

.tree-search-row .file-search-input {
  flex: 1;
  min-width: 0;
}

.tree-panel .file-search-input {
  margin-bottom: 0;
}

.tree-panel :deep(.el-tree) {
  min-width: 0;
}

.tree-node .node-label {
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-folder-btn {
  margin-left: 6px;
  flex: 0 0 auto;
}

/* 已选文件夹禁用样式 */
.tree-node.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tree-node .node-label.is-disabled {
  color: #a0a0a0;
  cursor: not-allowed;
}

.selected-tag {
  font-size: 11px;
  color: #67c23a;
  margin-left: 6px;
  flex: 0 0 auto;
}

.folder-icon {
  color: #e6a23c;
  font-size: 16px;
}

.node-label {
  white-space: nowrap;
}

.list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.list-panel-header {
  padding: 10px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  gap: 12px;
}

.list-search-row {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}

.list-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  flex-shrink: 0;
}

.list-panel :deep(.el-table) {
  flex: 1;
}

.list-pagination {
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #ebeef5;
  background: #fff;
}

.list-panel-footer {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.selected-hint {
  font-size: 12px;
  color: #606266;
}

.selected-panel {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.selected-panel-header {
  padding: 10px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.selected-list {
  flex: 1;
  overflow-y: auto;
  max-height: 100%;
  padding: 8px;
}

.selected-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #ebeef5;
  transition: background 0.2s;
}

.selected-item:hover {
  background: #f0f0f0;
}

.selected-item .file-icon {
  color: #409eff;
  font-size: 16px;
  flex-shrink: 0;
}

.selected-item .file-name {
  flex: 1;
  font-size: 12px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  align-items: flex-start;
  padding-top: 8px;
}

.footer-hint {
  margin-right: auto;
  font-size: 12px;
  color: #606266;
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.5;
  max-width: 60%;
}

.parse-status-hint {
  color: #909399;
}

.selected-section {
  margin-bottom: 12px;
}

.selected-section-title {
  font-size: 12px;
  color: #606266;
  margin: 6px 0 8px;
  font-weight: 500;
}

.selected-folder-node {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.selected-folder-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.selected-folder-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-folder-path {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #909399;
  padding-left: 22px;
}

.remove-btn {
  opacity: 0;
  transition: opacity 0.15s;
}

.selected-folder-main:hover .remove-btn {
  opacity: 1;
}

.scope-tag {
  flex-shrink: 0;
}
</style>
