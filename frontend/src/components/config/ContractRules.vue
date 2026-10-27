<script setup lang="ts">
import {ref} from 'vue'
import {ElMessage} from 'element-plus'
import RulePicker from '@/components/RulePicker.vue'
import type {Rule} from '@/domain/rules'
import type {JsonObject} from '@/domain/types'
import {cloneDraft} from '@/domain/validation'
const props=defineProps<{config:JsonObject;items:Rule[]}>()
const editing=ref(false),current=ref<Rule|null>(null),form=ref<JsonObject>({})
function edit(rule?:Rule){current.value=rule||null;form.value=rule?{...cloneDraft(rule.raw||{}),title:rule.raw?.title||rule.label,description:rule.description}:{};editing.value=true}
function save(){const fields=['title','description','laws_and_regulations','judgment_rule'];if(fields.some(f=>!String(form.value[f]||'').trim())){ElMessage.warning('请填写检查事项、检查说明、判断依据和判定标准');return}const rule:Rule={id:current.value?.id||crypto.randomUUID(),label:form.value.title,description:form.value.description,path:current.value?.path||'本次自定义',raw:cloneDraft(form.value)};const c=props.config;c.ruleCatalogs||={};c.ruleCatalogs.main=[...props.items.filter(r=>r.id!==rule.id),rule];c.rules=[...c.rules.filter((r:Rule)=>r.id!==rule.id),rule];editing.value=false}
</script>
<template><div><div class="contract-rule-tools"><el-button @click="edit()">添加检查规则</el-button></div><RulePicker :items="items" v-model="config.rules" label="合同检查规则"><template #actions="{rule}"><el-button text type="primary" @click="edit(rule)">编辑规则</el-button></template></RulePicker><el-dialog v-model="editing" :title="current?'编辑合同规则':'添加合同规则'" width="900px" append-to-body :close-on-click-modal="false"><el-form label-position="top"><el-form-item v-for="row in [{key:'title',label:'检查事项'},{key:'description',label:'检查说明'},{key:'laws_and_regulations',label:'判断依据'},{key:'judgment_rule',label:'判定标准'}]" :key="row.key" :label="row.label" required><el-input v-model="form[row.key]" :type="row.key==='title'?'text':'textarea'" :rows="3" :aria-label="row.label"/></el-form-item></el-form><template #footer><el-button @click="editing=false">取消</el-button><el-button type="primary" @click="save">保存并选用</el-button></template></el-dialog></div></template>
<style scoped>.contract-rule-tools{display:flex;justify-content:flex-end;margin-bottom:10px}</style>
