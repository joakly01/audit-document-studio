<script setup lang="ts">
import {onMounted,ref} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {service} from '@/services/service'
import type {ExtractionTemplate,TemplateFolder,JsonObject} from '@/domain/types'
import FieldEditor from '@/components/FieldEditor.vue'
import {cloneDraft} from '@/domain/validation'
const props=defineProps<{config:JsonObject}>()
const templates=ref<ExtractionTemplate[]>([]),loading=ref(false),error=ref('')
async function load(){loading.value=true;try{templates.value=await service.listTemplates();error.value=''}catch(e){error.value=(e as Error).message}finally{loading.value=false}}
async function choose(id:string){const t=templates.value.find(t=>t.id===id);if(!t)return;if(props.config.fields.length){try{await ElMessageBox.confirm('将用模板字段替换当前字段。','载入提取模板',{confirmButtonText:'替换',cancelButtonText:'取消'})}catch{return}}props.config.templateId=t.id;props.config.fields=cloneDraft(t.fields)}
async function save(){if(!props.config.fields.length||props.config.fields.some((f:any)=>!f.name.trim())){ElMessage.warning('请先填写提取字段');return}try{const {value}=await ElMessageBox.prompt('为调整后的字段命名','另存为个人模板',{inputPlaceholder:'模板名称',inputValidator:v=>!!v.trim()||'请填写名称',confirmButtonText:'保存',cancelButtonText:'取消'});const folders=await service.listTemplateFolders();const personal=folders.find((f:TemplateFolder)=>f.scope==='personal');if(!personal)throw Error('未找到可写入的个人模板目录，请先在提取模板管理中创建。');const t=await service.saveTemplate({id:'',name:value.trim(),description:'',scope:'personal',folderId:personal.id,fields:cloneDraft(props.config.fields)});templates.value.push(t);props.config.templateId=t.id;ElMessage.success('已保存到个人模板')}catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error((e as Error).message)}}
onMounted(load)
</script>
<template>
 <label class="field-label">提取模板</label><el-select :model-value="config.templateId" filterable placeholder="选择模板载入字段" :loading="loading" @change="choose" style="width:100%"><el-option-group label="系统模板"><el-option v-for="t in templates.filter(t=>t.scope==='system')" :key="t.id" :label="t.name" :value="t.id"/></el-option-group><el-option-group label="个人模板"><el-option v-for="t in templates.filter(t=>t.scope==='personal')" :key="t.id" :label="t.name" :value="t.id"/></el-option-group></el-select>
 <p v-if="error" class="error-banner">{{error}} <el-button link @click="load">重试</el-button></p>
 <FieldEditor v-model="config.fields"/>
 <el-button v-if="config.fields.length" @click="save" style="width:100%;margin:4px 0 16px">另存为个人模板</el-button>
 <el-collapse><el-collapse-item title="附件与文本处理" name="advanced"><el-checkbox v-model="config.mergeAttachments">合并关联附件参与提取</el-checkbox><label class="field-label">文本切片长度（字）</label><el-input-number v-model="config.chunkSize" :min="100" :max="100000" :step="100"/><label class="field-label">重叠长度（字）</label><el-input-number v-model="config.overlap" :min="0" :max="config.chunkSize-1" :step="50"/></el-collapse-item></el-collapse>
</template>
