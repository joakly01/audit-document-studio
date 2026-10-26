import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getVisibleFileManagerToolsAPI } from '@/api/fileManager.js'
import { getDictItemsByCodeAPI } from '@/api/dict.js'
import {
  normalizeFileManagerToolValue,
  buildFileManagerToolboxGroups
} from './fileManagerToolUtils.js'

export { normalizeFileManagerToolValue } from './fileManagerToolUtils.js'

/** 工具箱分类字典编码 */
export const TOOL_MODULE_DICT_CODE = 'tool_module'

/**
 * 文档资料挖掘工具箱：仅通过 /visible-tools 按当前用户权限加载（禁止回退裸字典，避免绕过 allow/deny）。
 * 分类来自数据字典 tool_module（树：父=分类，子=工具）；子项与功能列表按「值」对齐；
 * 仅当分类下存在可见工具时展示该分类。
 * @returns {{
 *   functionList: import('vue').Ref<Array<{ value: string, label: string }>>,
 *   functionGroups: import('vue').Ref<Array<{ code: string, label: string, tools: Array }>>,
 *   loadFunctionList: () => Promise<void>,
 *   loading: import('vue').Ref<boolean>
 * }}
 */
export function useFileManagerFunctionList() {
  const functionList = ref([])
  const functionGroups = ref([])
  const loading = ref(false)

  /**
   * 规范化单条可见工具
   * @param {Object} item 接口工具项
   * @returns {{ value: string, label: string }|null}
   */
  const normalizeToolItem = (item) => {
    const label = (item?.label || '').trim()
    const rawValue = (item?.value || item?.key_code || '').trim()
    const value = normalizeFileManagerToolValue(rawValue, label)
    const resolvedLabel = label || value
    return value ? { value, label: resolvedLabel } : null
  }

  /**
   * 加载 tool_module 分类树（失败返回空数组，不影响工具列表）
   * @returns {Promise<Array>}
   */
  const loadToolModuleTree = async () => {
    try {
      const res = await getDictItemsByCodeAPI(TOOL_MODULE_DICT_CODE, {
        status: 1,
        tree: true
      })
      if (res?.code === 200 && Array.isArray(res.data)) {
        return res.data
      }
      if (res?.code === 200 && Array.isArray(res.data?.items)) {
        return res.data.items
      }
      return []
    } catch (error) {
      console.warn('[工具箱] 加载 tool_module 分类失败，将平铺展示:', error)
      return []
    }
  }

  /**
   * 根据可见工具与分类树刷新 functionGroups
   * @param {Array} tools 可见工具
   * @param {Array} moduleTree 分类树
   * @returns {void}
   */
  const refreshFunctionGroups = (tools, moduleTree) => {
    const groups = buildFileManagerToolboxGroups(tools, moduleTree)
    if (groups.length > 0) {
      functionGroups.value = groups
      return
    }
    // 无有效分类树时：整表作为一组，避免空白
    functionGroups.value = tools.length > 0
      ? [{ code: '__all__', label: '全部工具', sortOrder: 0, tools }]
      : []
  }

  /**
   * 加载可见工具并按 tool_module 分组
   * @returns {Promise<void>}
   */
  const loadFunctionList = async () => {
    loading.value = true
    try {
      const [toolsRes, moduleTree] = await Promise.all([
        getVisibleFileManagerToolsAPI(),
        loadToolModuleTree()
      ])

      if (toolsRes?.code === 200 && Array.isArray(toolsRes.data)) {
        const seen = new Set()
        const tools = toolsRes.data
          .map(normalizeToolItem)
          .filter((item) => {
            if (!item || seen.has(item.value)) return false
            seen.add(item.value)
            return true
          })
        functionList.value = tools
        refreshFunctionGroups(tools, moduleTree)
        return
      }

      functionList.value = []
      functionGroups.value = []
      ElMessage.warning(toolsRes?.msg || toolsRes?.message || '加载工具箱失败，请稍后重试')
    } catch (error) {
      console.error('加载可见工具列表失败:', error)
      functionList.value = []
      functionGroups.value = []
      ElMessage.warning('加载工具箱失败，请稍后重试')
    } finally {
      loading.value = false
    }
  }

  return {
    functionList,
    functionGroups,
    loading,
    loadFunctionList
  }
}
