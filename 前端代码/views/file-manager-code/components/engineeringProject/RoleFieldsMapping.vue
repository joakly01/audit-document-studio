<template>
  <div class="role-fields-block">
    <div class="field-label-col field-label-col--block">
      <span class="field-label-text">语义字段映射</span>
    </div>
    <div v-if="showBackendHint" class="config-status-hint config-status-hint--hint">
      语义映射已保存；分析服务将按 role_fields 读取列名（请确认已部署对应后端版本）。
    </div>
    <div class="role-fields-grid">
      <div v-for="item in roleItems" :key="item.role" class="role-field-row">
        <span class="role-field-label">{{ item.label }}</span>
        <el-select
          v-if="!readonly"
          :model-value="localRoleFields[item.role]"
          filterable
          allow-create
          default-first-option
          clearable
          :placeholder="item.required ? '必选' : '推荐'"
          class="role-field-select"
          @update:model-value="(v) => updateRole(item.role, v)"
        >
          <el-option
            v-for="opt in columnOptions"
            :key="`${item.role}-${opt}`"
            :label="opt"
            :value="opt"
          />
        </el-select>
        <span v-else class="config-readonly-value">{{ localRoleFields[item.role] || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ROLE_FIELD_LABELS, roleFieldOptions } from './engineeringProjectConfigHelpers.js'

const props = defineProps({
  roleFields: { type: Object, default: () => ({}) },
  detectionConfig: { type: Object, required: true },
  sourceColumns: { type: Array, default: () => [] },
  mode: { type: String, default: 'duplicate' },
  readonly: { type: Boolean, default: false },
  showBackendHint: { type: Boolean, default: true }
})

const emit = defineEmits(['update:roleFields'])

const localRoleFields = computed(() => ({ ...(props.roleFields || {}) }))

const columnOptions = computed(() => roleFieldOptions(props.detectionConfig, props.sourceColumns))

const roleItems = computed(() => {
  const base = [
    { role: 'project_name', label: ROLE_FIELD_LABELS.project_name, required: true },
    { role: 'investment', label: ROLE_FIELD_LABELS.investment, required: false },
    { role: 'location', label: ROLE_FIELD_LABELS.location, required: false },
    { role: 'scale', label: ROLE_FIELD_LABELS.scale, required: false },
    { role: 'unit_name', label: ROLE_FIELD_LABELS.unit_name, required: false },
    { role: 'code_field', label: ROLE_FIELD_LABELS.code_field, required: props.mode === 'parent_child' },
    { role: 'plan_start', label: ROLE_FIELD_LABELS.plan_start, required: false },
    { role: 'plan_end', label: ROLE_FIELD_LABELS.plan_end, required: false }
  ]
  return base
})

function updateRole(role, value) {
  emit('update:roleFields', { ...localRoleFields.value, [role]: value || '' })
}
</script>

<style scoped>
.role-fields-grid {
  display: flex;
  flex-direction: column;
}

.role-field-row {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.role-field-label {
  width: 120px;
  flex-shrink: 0;
  font-size: 13px;
  color: #606266;
}

.role-field-select {
  flex: 1;
  max-width: 360px;
}
</style>
