<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {service} from '@/services/service'
import type {Prompt,PromptChoice,ToolId} from '@/domain/types'
import {matchesExpense,promptExpenseType} from '@/domain/prompts'
const props=defineProps<{tool:ToolId;stage:string;label:string;expenseType?:string;modelValue?:PromptChoice}>()
const emit=defineEmits<{'update:modelValue':[PromptChoice];loaded:[Prompt]}>()
const options=ref<Prompt[]>([]),loading=ref(false),error=ref(''),editor=ref(false),text=ref(''),saving=ref(false)
const applicable=computed(()=>options.value.filter(p=>matchesExpense(p,props.expenseType)))
const groups=computed(()=>[
 {label:'公共提示词 / 系统提示词',items:applicable.value.filter(p=>p.scope==='public'&&p.category==='system')},
 {label:'公共提示词 / 功能提示词',items:applicable.value.filter(p=>p.scope==='public'&&p.category==='function')},
 {label:'公共提示词 / 场景提示词',items:applicable.value.filter(p=>p.scope==='public'&&p.category==='scenario')},
 {label:'机构提示词',items:applicable.value.filter(p=>p.scope==='organization')},
 {label:'个人提示词',items:applicable.value.filter(p=>p.scope==='personal')}
].filter(g=>g.items.length))
const defaultPrompt=computed(()=>applicable.value.find(p=>p.isDefault&&p.scope==='public'&&p.category==='system'&&(!props.expenseType||promptExpenseType(p)===props.expenseType))||applicable.value.find(p=>p.isDefault&&p.scope==='public'&&p.category==='system'))
function apply(p:Prompt){emit('update:modelValue',{id:p.id,name:p.name,content:p.content,originalContent:p.content,customized:false});emit('loaded',p)}
async function choose(id:string){const p=applicable.value.find(v=>v.id===id);if(!p)return;if(props.modelValue?.customized){try{await ElMessageBox.confirm('切换提示词将替换本阶段已修改的内容及配套规则。','切换提示词',{confirmButtonText:'替换',cancelButtonText:'取消'})}catch{return}}apply(p)}
async function load(){loading.value=true;error.value='';try{options.value=await service.listPrompts(props.tool,props.stage);if(!props.modelValue?.content&&defaultPrompt.value)apply(defaultPrompt.value)}catch(e){error.value=String((e as Error).message)}finally{loading.value=false}}
function edit(){text.value=props.modelValue?.content||'';editor.value=true}
function save(){if(!text.value.trim()){ElMessage.warning('提示词内容不能为空');return}const p=props.modelValue;emit('update:modelValue',{id:p?.id||'',name:p?.name||'本次提示词',originalContent:p?.originalContent||'',content:text.value,customized:text.value!==p?.originalContent});editor.value=false}
async function personal(){if(!text.value.trim())return;try{const {value}=await ElMessageBox.prompt('填写个人提示词名称','另存为个人提示词',{inputValue:(props.modelValue?.name||props.label)+' · 个人',inputValidator:v=>!!v.trim()||'请填写名称',confirmButtonText:'保存',cancelButtonText:'取消'});saving.value=true;const current=options.value.find(p=>p.id===props.modelValue?.id);const p=await service.savePrompt({name:value.trim(),content:text.value,scope:'personal',tool:props.tool,stage:props.stage,config:{...current?.config,...(props.expenseType?{expense_type:props.expenseType}:{})}});options.value.push(p);emit('update:modelValue',{id:p.id,name:p.name,content:p.content,originalContent:p.content,customized:false});editor.value=false;ElMessage.success('已保存到个人提示词')}catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error((e as Error).message)}finally{saving.value=false}}
onMounted(load)
</script>
<template>
 <section class="prompt-panel">
  <div class="prompt-heading"><label class="field-label">{{label}}</label><el-button text type="primary" @click="edit">{{modelValue?.content?'查看 / 编辑':'编写提示词'}}</el-button></div>
  <el-select :model-value="modelValue?.id" :loading="loading" placeholder="选择提示词" filterable @change="choose" style="width:100%">
   <el-option v-if="modelValue?.id&&!options.some(p=>p.id===modelValue?.id)" :value="modelValue.id" :label="modelValue.name+'（历史快照）'" />
   <el-option-group v-for="group in groups" :key="group.label" :label="group.label"><el-option v-for="p in group.items" :key="p.id" :value="p.id" :label="p.name" /></el-option-group>
  </el-select>
  <p v-if="error" class="prompt-error">{{error}} <el-button link type="primary" @click="load">重试</el-button></p>
  <p v-else class="prompt-summary">{{modelValue?.customized?'已针对本次分析修改':modelValue?.content?'已载入，可按需要修改':'请选择提示词，或编写本次分析要求。'}}</p>
  <el-dialog v-model="editor" :title="label+' · 编辑提示词'" width="1120px" class="prompt-editor" append-to-body :close-on-click-modal="false">
   <div class="editor-caption"><span>{{modelValue?.name||'本次提示词'}}</span><el-button text @click="text=defaultPrompt?.content||modelValue?.originalContent||''" :disabled="!defaultPrompt&&!modelValue?.originalContent">恢复默认</el-button></div>
   <el-input v-model="text" type="textarea" resize="none" aria-label="提示词正文" class="prompt-text" placeholder="描述需要分析的内容、判断要求和输出格式" />
   <template #footer><div class="editor-footer"><span class="muted">{{text.length.toLocaleString()}} 字</span><el-button v-if="service.capabilities.personalPrompts" :loading="saving" @click="personal">另存为个人提示词</el-button><span class="grow"/><el-button @click="editor=false">取消</el-button><el-button type="primary" @click="save">应用到本次分析</el-button></div></template>
  </el-dialog>
 </section>
</template>
<style scoped>
.prompt-panel{margin-bottom:16px}.prompt-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.prompt-heading .field-label{margin:0 0 6px}.prompt-heading .el-button{font-size:14px;padding:4px;min-height:30px}.prompt-summary{font-size:14px;color:#596b80;margin:6px 0 0}.prompt-error{color:#a33e3e;font-size:14px}.editor-caption{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px}.prompt-text :deep(textarea){height:clamp(200px,calc(100dvh - 240px),650px);font-size:16px;line-height:1.8;padding:16px}.editor-footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1}
</style>
