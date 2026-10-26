<template>
  <el-dialog
    v-model="dialogVisible"
    title="批量设置"
    width="900px"
    :close-on-click-modal="false"
    class="batch-settings-dialog"
  >
    <div class="batch-settings-content">
      <div class="batch-config-field">
        <div class="field-config-desc">
          所有文件将统一使用以下字段配置。选择自定义字段时，可以点击"从模板加载"将模板字段添加到编辑区。
        </div>
        <div class="batch-file-list batch-file-list--spaced">
          <el-table
            :data="bindings.batchSettingsFileList.value"
            row-key="rowKey"
            :tree-props="{ children: 'children' }"
            default-expand-all
            border
            max-height="200"
          >
            <el-table-column prop="name" label="名称" min-width="300" />
            <el-table-column prop="typeLabel" label="类型" width="120" />
            <el-table-column label="设置模式" width="120">
              <template #default="{ row }">
                <el-tag
                  v-if="row.settings && row.settings.configured"
                  :type="row.settings.mode === 'prompt' ? 'primary' : 'success'"
                  size="small"
                >
                  {{ row.settings.mode === 'prompt' ? 'Prompt模式' : '字段模式' }}
                </el-tag>
                <span v-else style="color: #909399;">未设置</span>
              </template>
            </el-table-column>
            <el-table-column label="设置内容" min-width="300">
              <template #default="{ row }">
                <div v-if="row.settings && row.settings.configured" style="color: #606266;">
                  <template v-if="row.settings.mode === 'prompt'">
                    <span>{{ row.settings.prompt || '-' }}</span>
                  </template>
                  <template v-else-if="row.settings.template">
                    <span>模板：{{ bindings.getTemplateName(row.settings.template) }}</span>
                  </template>
                  <template v-else-if="row.settings.fieldDefinitions && row.settings.fieldDefinitions.length > 0">
                    <span>自定义字段：{{ row.settings.fieldDefinitions.map(f => f.name || '未命名字段').filter(Boolean).join('、') }}</span>
                  </template>
                  <template v-else>
                    <span>未配置</span>
                  </template>
                </div>
                <span v-else style="color: #909399;">-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="unified-field-config">
          <div class="unified-field-config__mode">
            <el-radio-group
              v-model="bindings.batchSettingsTemplateMap.value.type"
              size="default"
              @change="bindings.handleBatchFieldModeChange"
            >
              <el-radio-button label="template">使用模板</el-radio-button>
              <el-radio-button label="custom">自定义字段</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="bindings.batchSettingsTemplateMap.value.type === 'template'" class="template-mode">
            <el-select
              v-model="bindings.batchSettingsTemplateMap.value.value"
              placeholder="选择模板"
              size="default"
              style="width: 100%;"
              filterable
              :loading="bindings.templateLoading.value"
            >
              <el-option
                v-for="template in bindings.templateOptions.value"
                :key="template.value"
                :label="template.label"
                :value="template.value"
              />
            </el-select>
          </div>
          <div v-if="bindings.batchSettingsTemplateMap.value.type === 'custom'" class="custom-mode">
            <div class="custom-mode__toolbar">
              <el-dropdown @command="(templateValue) => bindings.handleLoadFieldsFromTemplate(templateValue)">
                <el-button size="small" type="primary" plain :loading="bindings.templateLoading.value">
                  <el-icon><component :is="bindings.icons.Plus" /></el-icon>
                  从模板加载字段
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="template in bindings.templateOptions.value"
                      :key="template.value"
                      :command="template.value"
                    >
                      {{ template.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="field-definition-list" v-if="bindings.batchSettingsFieldMap.value.length > 0">
              <div
                v-for="(field, fieldIndex) in bindings.batchSettingsFieldMap.value"
                :key="field.id || fieldIndex"
                class="field-item"
              >
                <div class="field-item-content">
                  <div class="field-row field-row--split">
                    <div class="field-row__main">
                      <div class="field-label">字段名称 *</div>
                      <el-input v-model="field.name" placeholder="请输入字段名称" size="small" style="width: 100%;" />
                    </div>
                    <div class="field-row__action">
                      <el-button
                        type="danger"
                        size="small"
                        :icon="bindings.icons.Delete"
                        @click="bindings.handleBatchRemoveField(fieldIndex)"
                      >
                        删除
                      </el-button>
                    </div>
                  </div>
                  <div class="field-row">
                    <div class="field-label">字段描述</div>
                    <el-input v-model="field.description" placeholder="对要抽取的字段进行描述" size="small" />
                  </div>
                </div>
              </div>
            </div>
            <div class="field-item field-item-new">
              <div class="field-item-content">
                <div class="field-row">
                  <div class="field-label">字段名称 *</div>
                  <el-input
                    v-model="bindings.batchSettingsNewFieldMap.value.name"
                    placeholder="请输入字段名称"
                    size="small"
                    style="width: 100%;"
                    @keyup.enter="bindings.handleBatchAddField"
                  />
                </div>
                <div class="field-row field-row--spaced-top">
                  <div class="field-label">字段描述</div>
                  <el-input
                    v-model="bindings.batchSettingsNewFieldMap.value.description"
                    placeholder="对要抽取的字段进行描述"
                    size="small"
                    @keyup.enter="bindings.handleBatchAddField"
                  />
                </div>
              </div>
            </div>
            <div class="add-field-button">
              <el-button type="primary" plain size="small" @click="bindings.handleBatchAddField">
                <el-icon><component :is="bindings.icons.Plus" /></el-icon>
                添加字段
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="bindings.handleBatchSettingsCancel">取消</el-button>
        <el-button type="primary" @click="bindings.handleBatchSettingsConfirm">
          确认保存
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** 与 OcrViewer leftSidebarBindings 一致 */
  bindings: {
    type: Object,
    required: true
  }
})

/**
 * 弹窗显隐（双向绑定 batchSettingsDialogVisible）
 */
const dialogVisible = computed({
  get: () => props.bindings.batchSettingsDialogVisible.value,
  set: (val) => {
    props.bindings.batchSettingsDialogVisible.value = val
  }
})
</script>

<style scoped>
.batch-file-list--spaced {
  margin-top: 20px;
}

.unified-field-config {
  margin-top: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
}

.unified-field-config__mode {
  margin-bottom: 16px;
}

.custom-mode__toolbar {
  margin-bottom: 12px;
}

.field-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.field-item-new {
  background: #fafafa;
  border: 1px dashed #dcdfe6;
}

.field-row--split {
  display: flex;
  margin-bottom: 8px;
}

.field-row--split > * + * {
  margin-left: 12px;
}

.field-row__main {
  flex: 1;
  min-width: 0;
}

.field-row__action {
  width: 80px;
  flex-shrink: 0;
}

.field-row--spaced-top {
  margin-top: 8px;
}

.field-label {
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

.add-field-button {
  margin-top: 8px;
}
</style>
