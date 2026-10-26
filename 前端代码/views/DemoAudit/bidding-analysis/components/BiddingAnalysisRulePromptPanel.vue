<template>
  <div class="bidding-rule-prompt">
    <el-form-item v-if="showTemplateRules && template && templateRules.bidding.length" label="招标规则">
      <div class="bidding-rule-prompt-tags">
        <el-tag
          v-for="rule in templateRules.bidding"
          :key="rule.id"
          size="small"
          type="success"
          effect="plain"
          class="bidding-rule-prompt-tag"
        >
          {{ rule.name }}
        </el-tag>
      </div>
    </el-form-item>

    <el-form-item v-if="showTemplateRules && template && templateRules.tender.length" label="投标规则">
      <div class="bidding-rule-prompt-tags">
        <el-tag
          v-for="rule in templateRules.tender"
          :key="rule.id"
          size="small"
          type="primary"
          effect="plain"
          class="bidding-rule-prompt-tag"
        >
          {{ rule.name }}
        </el-tag>
      </div>
    </el-form-item>

    <el-form-item v-if="showTemplateRules && template && templateRules.joint.length" label="联合规则">
      <div class="bidding-rule-prompt-tags">
        <el-tag
          v-for="rule in templateRules.joint"
          :key="rule.id"
          size="small"
          type="warning"
          effect="plain"
          class="bidding-rule-prompt-tag"
        >
          {{ rule.name }}
        </el-tag>
      </div>
    </el-form-item>

    <div v-if="template" class="bidding-rule-prompt-panel">
      <div class="bidding-rule-prompt-panel-head">
        <span class="bidding-rule-prompt-panel-title">分析提示词</span>
      </div>

      <el-form label-width="100px" class="bidding-rule-prompt-form">
        <el-form-item label="提示词内容">
          <div class="bidding-rule-prompt-preview-wrap">
            <div class="bidding-rule-prompt-preview">
              {{ currentPromptText || '未设置提示词' }}
            </div>
            <div class="bidding-rule-prompt-preview-actions">
              <el-button :disabled="!currentPromptText" @click="viewDialogVisible = true">
                查看全文
              </el-button>
              <el-button type="primary" @click="openEditDialog">编辑</el-button>
              <el-button :disabled="!isPromptCustomized" @click="restoreDefaultPrompt">
                恢复默认
              </el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="状态">
          <el-tag v-if="isPromptCustomized" type="warning" size="small" effect="plain">
            已自定义
          </el-tag>
          <el-tag v-else type="info" size="small" effect="plain">使用模板默认</el-tag>
          <span class="bidding-rule-prompt-status-tip">修改仅对本次分析生效</span>
        </el-form-item>
      </el-form>
    </div>

    <el-empty v-if="!template" description="请选择分析模板" :image-size="80" />

    <el-dialog
      v-model="viewDialogVisible"
      title="分析提示词详情"
      width="640px"
      destroy-on-close
    >
      <pre class="bidding-rule-prompt-dialog-text">{{ currentPromptText }}</pre>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑分析提示词"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-input
        v-model="editingPromptText"
        type="textarea"
        :rows="16"
        resize="none"
        placeholder="请输入分析提示词内容"
        class="bidding-rule-prompt-edit-textarea"
      />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEditPrompt">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getTemplateDefaultPrompt,
  listRulesFromTemplate,
} from '../utils/biddingAnalysisPromptConfig.js'

defineOptions({ name: 'BiddingAnalysisRulePromptPanel' })

const props = defineProps({
  template: { type: Object, default: null },
  /** 多模式拼接后的默认提示词；传入时优先于单模板 defaultPrompt */
  defaultPromptText: { type: String, default: '' },
})

const emit = defineEmits(['change'])

const promptOverride = ref(null)
const viewDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editingPromptText = ref('')

const allTemplateRules = computed(() => listRulesFromTemplate(props.template))

const templateRules = computed(() => ({
  bidding: allTemplateRules.value.filter((item) => item.docType === 'bidding'),
  tender: allTemplateRules.value.filter((item) => item.docType === 'tender'),
  joint: allTemplateRules.value.filter((item) => item.docType === 'joint'),
}))

const showTemplateRules = computed(() => !props.defaultPromptText)

const defaultPromptText = computed(() => {
  if (props.defaultPromptText) return props.defaultPromptText
  return getTemplateDefaultPrompt(props.template)
})

const currentPromptText = computed(() => {
  if (promptOverride.value?.text) return promptOverride.value.text
  return defaultPromptText.value
})

const isPromptCustomized = computed(() => !!promptOverride.value?.customized)

const setPromptText = (text, { customized = true } = {}) => {
  const trimmed = (text || '').trim()
  if (!customized || trimmed === defaultPromptText.value) {
    promptOverride.value = null
  } else {
    promptOverride.value = { text: trimmed, customized: true }
  }
  emit('change', buildPayload())
}

const openEditDialog = () => {
  editingPromptText.value = currentPromptText.value
  editDialogVisible.value = true
}

const confirmEditPrompt = () => {
  const text = editingPromptText.value.trim()
  if (!text) {
    ElMessage.warning('提示词内容不能为空')
    return
  }
  setPromptText(text, { customized: true })
  editDialogVisible.value = false
  ElMessage.success('分析提示词已保存（仅本次分析生效）')
}

const restoreDefaultPrompt = () => {
  promptOverride.value = null
  emit('change', buildPayload())
  ElMessage.success('已恢复为模板默认提示词')
}

const resetPromptState = () => {
  promptOverride.value = null
  emit('change', buildPayload())
}

const confirmResetIfNeeded = async () => {
  if (!isPromptCustomized.value) {
    resetPromptState()
    return true
  }
  try {
    await ElMessageBox.confirm(
      '切换模板将丢失未保存的提示词修改，是否继续？',
      '提示',
      {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    resetPromptState()
    return true
  } catch {
    return false
  }
}

const buildPayload = () => {
  if (!props.template) return null
  return {
    templateId: props.template.id,
    promptId: props.template.promptId ?? null,
    templateName: props.template.name,
    promptText: currentPromptText.value,
    customized: isPromptCustomized.value,
    rules: allTemplateRules.value.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      docType: rule.docType,
    })),
  }
}

watch(
  () => [props.template?.id, props.template?.promptId, props.defaultPromptText],
  () => {
    if (isPromptCustomized.value) return
    resetPromptState()
  }
)

defineExpose({
  buildPayload,
  resetPromptState,
  confirmResetIfNeeded,
  hasPromptCustomization: () => isPromptCustomized.value,
})
</script>

<style scoped>
.bidding-rule-prompt-tags {
  display: flex;
  flex-wrap: wrap;
}

.bidding-rule-prompt-tags > * {
  margin-right: 10px;
  margin-bottom: 10px;
}

.bidding-rule-prompt-tag {
  margin: 0 10px 10px 0;
}

.bidding-rule-prompt-panel {
  margin-top: 4px;
  padding: 12px 12px 4px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
}

.bidding-rule-prompt-panel-head {
  margin-bottom: 12px;
}

.bidding-rule-prompt-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sd-primary, #195fb4);
  padding-left: 8px;
  border-left: 3px solid var(--sd-primary, #195fb4);
  line-height: 1.4;
}

.bidding-rule-prompt-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.bidding-rule-prompt-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.bidding-rule-prompt-form :deep(.el-form-item__label) {
  height: 32px;
  line-height: 32px;
  padding-right: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--sd-ink-muted, #525252);
}

.bidding-rule-prompt-form :deep(.el-form-item__content) {
  line-height: 32px;
  font-size: 13px;
}

.bidding-rule-prompt :deep(> .el-form-item) {
  margin-bottom: 16px;
}

.bidding-rule-prompt :deep(> .el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  color: var(--sd-ink-muted, #525252);
}

.bidding-rule-prompt-preview-actions :deep(.el-button) {
  height: 32px;
  min-height: 32px;
  padding: 0 12px;
  font-size: 13px;
  box-sizing: border-box;
}

.bidding-rule-prompt-preview-wrap {
  width: 100%;
}

.bidding-rule-prompt-preview {
  min-height: 72px;
  max-height: 96px;
  padding: 8px 10px;
  overflow-y: auto;
  background: var(--sd-canvas, #ffffff);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--sd-ink-muted, #525252);
  white-space: pre-wrap;
  word-break: break-word;
}

.bidding-rule-prompt-preview-actions {
  display: flex;
  flex-wrap: wrap;
  margin-top: 8px;
}

.bidding-rule-prompt-preview-actions > * + * {
  margin-left: 8px;
}

.bidding-rule-prompt-status-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}

.bidding-rule-prompt-dialog-text {
  margin: 0;
  max-height: 420px;
  overflow-y: auto;
  padding: 12px;
  background: var(--sd-surface-1, #f4f4f4);
  border: 1px solid var(--sd-hairline, #e0e0e0);
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.bidding-rule-prompt-edit-textarea :deep(.el-textarea__inner) {
  font-size: 13px;
  line-height: 1.6;
}
</style>
