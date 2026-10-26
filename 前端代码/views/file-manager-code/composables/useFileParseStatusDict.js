import { ref, computed } from 'vue'
import { getDictItemsByCodeAPI } from '@/api/dict.js'

const DICT_TYPE_CODE = 'file-parse-status'

const DEFAULT_ITEMS = [
  { key_code: 'UNPARSED', value: '0', label: '未解析', description: '{"tagType":"info"}', sort_order: 10 },
  { key_code: 'PARSING', value: '1', label: '解析中', description: '{"tagType":"primary"}', sort_order: 20 },
  { key_code: 'PARSED', value: '2', label: '解析完成', description: '{"tagType":"success"}', sort_order: 30 },
  { key_code: 'FAILED', value: '3', label: '解析失败', description: '{"tagType":"danger"}', sort_order: 40 }
]

function parseTagType(description) {
  if (!description) return 'info'
  try {
    const obj = typeof description === 'string' ? JSON.parse(description) : description
    return obj?.tagType || 'info'
  } catch {
    return 'info'
  }
}

function normalizeRow(row) {
  const value = String(row?.value ?? row?.key_code ?? '').trim()
  if (!value) return null
  return {
    key_code: row?.key_code || value,
    value,
    label: row?.label || value,
    tagType: parseTagType(row?.description),
    sort_order: typeof row?.sort_order === 'number' ? row.sort_order : 0
  }
}

/**
 * 文件解析状态字典（file-parse-status）：DB 存 0/1/2/3，展示名由字典维护。
 */
export function useFileParseStatusDict() {
  const items = ref([])
  const loaded = ref(false)
  const loading = ref(false)

  const itemMap = computed(() => {
    const map = {}
    items.value.forEach((it) => {
      map[it.value] = it
    })
    return map
  })

  const options = computed(() =>
    [...items.value].sort((a, b) => a.sort_order - b.sort_order)
  )

  const loadParseStatusDict = async () => {
    if (loading.value) return
    loading.value = true
    try {
      const res = await getDictItemsByCodeAPI(DICT_TYPE_CODE, { status: 1, tree: false })
      if (res?.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
        items.value = res.data
          .filter((row) => row?.status === 1 || row?.status === undefined)
          .map(normalizeRow)
          .filter(Boolean)
      } else {
        items.value = DEFAULT_ITEMS.map(normalizeRow).filter(Boolean)
      }
    } catch (e) {
      console.error('加载文件解析状态字典失败:', e)
      items.value = DEFAULT_ITEMS.map(normalizeRow).filter(Boolean)
    } finally {
      loading.value = false
      loaded.value = true
    }
  }

  const resolveStatusValue = (row) => {
    if (row == null) return '0'
    if (row.parse_status != null && row.parse_status !== '') {
      return String(row.parse_status)
    }
    const legacy = String(row.document_parse_status || '').toLowerCase()
    const legacyMap = { unparsed: '0', parsing: '1', parsed: '2', failed: '3' }
    return legacyMap[legacy] || '0'
  }

  const getLabel = (rowOrValue) => {
    const value = typeof rowOrValue === 'object' ? resolveStatusValue(rowOrValue) : String(rowOrValue ?? '0')
    return itemMap.value[value]?.label || '未知'
  }

  const getTagType = (rowOrValue) => {
    const value = typeof rowOrValue === 'object' ? resolveStatusValue(rowOrValue) : String(rowOrValue ?? '0')
    return itemMap.value[value]?.tagType || 'info'
  }

  const isParsed = (row) => resolveStatusValue(row) === '2'

  const isReparseEligible = (row) => {
    const v = resolveStatusValue(row)
    return v === '0' || v === '1' || v === '3'
  }

  return {
    items,
    options,
    itemMap,
    loaded,
    loading,
    loadParseStatusDict,
    resolveStatusValue,
    getLabel,
    getTagType,
    isParsed,
    isReparseEligible
  }
}
