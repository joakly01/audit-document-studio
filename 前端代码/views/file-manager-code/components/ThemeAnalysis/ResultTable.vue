<template>
  <div class="result-table-container" :class="{ 'is-fullscreen': isFullscreen }">
    <div v-if="!hideTabHeader" class="action-bar">
      <el-button
        type="primary"
        plain
        :icon="FullScreen"
        size="small"
        @click="toggleFullscreen"
      >
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </el-button>
    </div>

    <div class="content-tabs">
      <el-tabs
        v-if="!hideTabHeader"
        v-model="activeTab"
        class="result-tabs"
      >
        <el-tab-pane label="信息提取" name="table">
          <div class="table-wrapper">
            <el-table
              v-if="dataColumns.length > 0 || displayRows.length > 0"
              :data="displayRows"
              border
              stripe
              class="sd-table--clean"
              style="width: 100%"
              :header-cell-style="{ background: '#f5f7fa', color: '#303133', fontWeight: '600' }"
            >
              <el-table-column type="index" label="序号" width="60" align="center" fixed="left" />
              <el-table-column prop="fileName" label="文件名" min-width="160" fixed="left">
                <template #default="{ row }">
                  <div class="extracted-value-cell file-name-cell">{{ row.fileName || '-' }}</div>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in dataColumns"
                :key="col"
                :label="col"
                min-width="160"
              >
                <template #default="{ row }">
                  <div class="extracted-value-cell">{{ cellText(row, col) }}</div>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无数据，请配置提示词并点击立即执行" />
          </div>
        </el-tab-pane>
        <el-tab-pane label="主题归纳" name="markdown">
          <div class="markdown-wrapper">
            <el-empty
              v-if="!themeSummaryText || !String(themeSummaryText).trim()"
              description="完成信息提取后，点击「运行主题归纳（智能体）」查看结果"
              :image-size="80"
            />
            <div
              v-else
              class="theme-summary-md"
              v-html="themeSummaryHtml"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
      <template v-else>
        <div v-show="activeTab === 'table'" class="table-wrapper table-wrapper--embedded">
          <el-table
            v-if="dataColumns.length > 0 || displayRows.length > 0"
            :data="displayRows"
            border
            stripe
            class="sd-table--clean"
            style="width: 100%"
          >
            <el-table-column type="index" label="序号" width="60" align="center" fixed="left" />
            <el-table-column prop="fileName" label="文件名" min-width="160" fixed="left">
              <template #default="{ row }">
                <div class="extracted-value-cell file-name-cell">{{ row.fileName || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column
              v-for="col in dataColumns"
              :key="col"
              :label="col"
              min-width="160"
            >
              <template #default="{ row }">
                <div class="extracted-value-cell">{{ cellText(row, col) }}</div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据" />
        </div>
        <div v-show="activeTab === 'markdown'" class="markdown-wrapper markdown-wrapper--embedded">
          <el-empty
            v-if="!themeSummaryText || !String(themeSummaryText).trim()"
            description="暂无主题归纳结果"
            :image-size="80"
          />
          <div
            v-else
            class="theme-summary-md"
            v-html="themeSummaryHtml"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FullScreen } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
  langPrefix: 'hljs language-',
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch (_) {
        /* empty */
      }
    }
    try {
      return hljs.highlightAuto(str).value
    } catch (_) {
      return md.utils.escapeHtml(str)
    }
  },
})

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const t = token.attrIndex('target')
  if (t < 0) token.attrPush(['target', '_blank'])
  else token.attrs[t][1] = '_blank'
  token.attrPush(['rel', 'noopener noreferrer'])
  return self.renderToken(tokens, idx, options)
}

/**
 * 模型常把整段回答包在 ``` / ```markdown 里，markdown-it 会当成代码块显示成「未渲染」的源码
 */
function unwrapOuterMarkdownFence(text) {
  let s = String(text).trim()
  if (!s) return s
  const maxLayers = 3
  for (let i = 0; i < maxLayers; i++) {
    if (!s.startsWith('```')) break
    const firstNl = s.indexOf('\n')
    if (firstNl === -1) break
    const firstLine = s.slice(0, firstNl).trim()
    if (!/^```[\w-]*\s*$/.test(firstLine)) break
    const body = s.slice(firstNl + 1)
    const close = body.lastIndexOf('```')
    if (close === -1) break
    s = body.slice(0, close).trim()
  }
  return s
}

const props = defineProps({
  /** 表头列名（须含「文件名」在第一项，其余为动态属性列；也可仅传动态列，由内部与文件名合并） */
  columns: {
    type: Array,
    default: () => []
  },
  /** { fileName, values: { 列名: 值 } }[] */
  rows: {
    type: Array,
    default: () => []
  },
  /** 主题归纳（Dify）结果展示文本 */
  themeSummaryText: {
    type: String,
    default: ''
  },
  /** 隐藏内部 Tab 头（由父级顶栏切换） */
  hideTabHeader: {
    type: Boolean,
    default: false
  },
  /** 当前子 Tab：table | markdown */
  activeTab: {
    type: String,
    default: 'table'
  }
})

const emit = defineEmits(['update:activeTab', 'fullscreen-change'])

const isFullscreen = ref(false)

/**
 * 子 Tab 双向绑定（支持父级顶栏控制）
 */
const activeTab = computed({
  get: () => props.activeTab || 'table',
  set: (val) => emit('update:activeTab', val)
})

const dataColumns = computed(() => {
  const c = props.columns || []
  if (!c.length) return []
  if (c[0] === '文件名') {
    return c.slice(1)
  }
  return c
})

const displayRows = computed(() => props.rows || [])

const themeSummaryHtml = computed(() => {
  const raw = props.themeSummaryText
  if (raw === undefined || raw === null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  const normalized = unwrapOuterMarkdownFence(s.split('\\n').join('\n'))
  if (!normalized) return ''
  return md.render(normalized)
})

const cellText = (row, col) => {
  const v = row?.values?.[col]
  if (v === undefined || v === null || v === '') return '-'
  return String(v)
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen-change', isFullscreen.value)
  if (isFullscreen.value) {
    ElMessage.success('已进入全屏模式，按 ESC 或点击按钮退出')
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
    emit('fullscreen-change', false)
  }
}

const showThemeTab = () => {
  activeTab.value = 'markdown'
}

defineExpose({ showThemeTab, toggleFullscreen })

watch(isFullscreen, (val) => {
  emit('fullscreen-change', val)
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
@import 'highlight.js/styles/github.css';

.result-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

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

.action-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sd-hairline, #e0e0e0);
  flex-shrink: 0;
}

.content-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-tabs {
  height: 100%;
  display: flex;
}

.result-tabs :deep(.el-tabs__header) {
  margin: 0;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.result-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

.result-tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}

.table-wrapper {
  flex: 1;
  height: 100%;
  overflow: auto;
  padding: 12px;
}

.table-wrapper--embedded,
.markdown-wrapper--embedded {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 12px;
}

.markdown-wrapper--embedded {
  padding: 5px;
}

.markdown-wrapper {
  height: 100%;
  overflow: auto;
  padding: 5px;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.theme-summary-md {
  flex: 1;
  min-height: 200px;
  max-height: 100%;
  overflow: auto;
  padding: 16px 20px;
  line-height: 1.65;
  color: #303133;
  font-size: 14px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  word-break: break-word;
}

.theme-summary-md :deep(h1) {
  font-size: 1.35em;
  margin: 0.6em 0 0.4em;
  font-weight: 600;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 0.25em;
}

.theme-summary-md :deep(h2) {
  font-size: 1.2em;
  margin: 0.75em 0 0.4em;
  font-weight: 600;
}

.theme-summary-md :deep(h3) {
  font-size: 1.1em;
  margin: 0.65em 0 0.35em;
  font-weight: 600;
}

.theme-summary-md :deep(p) {
  margin: 0.5em 0;
}

.theme-summary-md :deep(ul),
.theme-summary-md :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.theme-summary-md :deep(blockquote) {
  margin: 0.6em 0;
  padding: 0.25em 0 0.25em 0.85em;
  border-left: 4px solid #dcdfe6;
  color: #606266;
  background: #fff;
}

.theme-summary-md :deep(pre) {
  margin: 0.75em 0;
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.theme-summary-md :deep(pre.hljs) {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
}

.theme-summary-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.92em;
}

.theme-summary-md :deep(p code),
.theme-summary-md :deep(li code) {
  padding: 0.15em 0.4em;
  border-radius: 3px;
  background: #f0f2f5;
  color: #c7254e;
}

.theme-summary-md :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.theme-summary-md :deep(a) {
  color: #409eff;
  text-decoration: none;
}

.theme-summary-md :deep(a:hover) {
  text-decoration: underline;
}

.theme-summary-md :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75em 0;
  font-size: 13px;
}

.theme-summary-md :deep(th),
.theme-summary-md :deep(td) {
  border: 1px solid #dcdfe6;
  padding: 8px 10px;
  text-align: left;
}

.theme-summary-md :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}

.theme-summary-md :deep(hr) {
  border: none;
  border-top: 1px solid #e4e7ed;
  margin: 1em 0;
}

.theme-summary-md :deep(img) {
  max-width: 100%;
  height: auto;
}

.extracted-value-cell {
  padding: 4px 0;
  line-height: 1.6;
}

.file-name-cell {
  color: #409eff;
  font-weight: 500;
  word-break: break-all;
}
</style>
