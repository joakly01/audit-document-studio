<script setup lang="ts">
import {ref,computed} from 'vue'
import {ElMessage} from 'element-plus'
import type {JsonObject} from '@/domain/types'
import LexiconDialog from './LexiconDialog.vue'
import {addSelectedWords,type LexiconEntry} from '@/domain/lexicon'
const props=defineProps<{config:JsonObject}>()
const libraryOpen=ref(false)
const opened=ref(false),kind=ref<'stopWords'|'newWords'>('stopWords'),draft=ref('')
const title=computed(()=>kind.value==='stopWords'?'停用词':'新词')
function edit(k:'stopWords'|'newWords'){kind.value=k;draft.value=(props.config[k]||[]).join('\n');opened.value=true}
function selectSaved(rows:LexiconEntry[]){Object.assign(props.config,addSelectedWords(props.config.stopWords||[],props.config.newWords||[],rows))}
function apply(){const parsed=[...new Set(draft.value.split(/[\n,，;；]+/).map(v=>v.trim()).filter(Boolean))];const other=kind.value==='stopWords'?'newWords':'stopWords';if(parsed.some(w=>(props.config[other]||[]).includes(w))){ElMessage.warning('同一个词不能同时作为停用词和新词，请先移除另一列表中的词条');return}props.config[kind.value]=parsed;opened.value=false}
async function importWords(e:Event){const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>2*1024*1024){ElMessage.warning('词表文件请控制在 2 MB 以内');return}const txt=await file.text();draft.value=[draft.value,txt].filter(Boolean).join('\n');(e.target as HTMLInputElement).value=''}
function exportWords(){const u=URL.createObjectURL(new Blob([draft.value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=title.value+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}
</script>
<template>
 <el-button @click="libraryOpen=true" style="width:100%;margin-bottom:16px">从我的词库选用</el-button><LexiconDialog v-model="libraryOpen" :stop-words="config.stopWords" :new-words="config.newWords" @apply="selectSaved"/>
 <section class="form-section"><h3>词频统计</h3><label class="field-label">展示词数</label><el-input-number v-model="config.topN" :min="10" :max="500" :step="10"/><p class="help">词云显示高频词，完整词频可在结果中查看。</p></section>
 <section class="word-setting" v-for="row in [{key:'stopWords',name:'停用词',help:'不参与统计的词，如“的”“以及”等。'},{key:'newWords',name:'新词',help:'按完整词语识别，如“政府采购”“专项资金”。'}]" :key="row.key"><div><h3>{{row.name}} <span class="number">{{config[row.key]?.length||0}}</span></h3><p class="help">{{row.help}}</p></div><el-button @click="edit(row.key as 'stopWords'|'newWords')">设置</el-button></section>
 <el-dialog v-model="opened" :title="'设置'+title" width="800px" append-to-body :close-on-click-modal="false"><p class="help">每行一个词，也可使用逗号分隔；应用时自动合并重复词。</p><el-input v-model="draft" type="textarea" :rows="14" :aria-label="title+'列表'" resize="vertical"/><div class="toolbar" style="margin-top:12px"><label class="import-word">导入词表<input type="file" accept=".txt,.csv" @change="importWords"/></label><el-button @click="exportWords">导出词表</el-button><span class="muted">{{draft.split(/[\n,，;；]+/).filter(v=>v.trim()).length}} 个词</span></div><template #footer><el-button @click="opened=false">取消</el-button><el-button type="primary" @click="apply">应用</el-button></template></el-dialog>
</template>
<style scoped>.word-setting{padding:18px 0;border-bottom:1px solid #e6ebf1;display:flex;gap:12px;align-items:start;justify-content:space-between}.word-setting h3{font-size:15px}.word-setting .help{margin-bottom:0}.import-word{position:relative;display:inline-block;border:1px solid #dce3ed;padding:6px 14px;border-radius:7px;font-size:14px;cursor:pointer}.import-word input{position:absolute;inset:0;opacity:0;width:100%;cursor:pointer}</style>
