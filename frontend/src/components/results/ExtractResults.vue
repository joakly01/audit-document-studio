<script setup lang="ts">
import {computed,ref} from 'vue'
import type {Evidence,JsonObject} from '@/domain/types'
import {rows,object,extractionColumns,text,evidenceOf} from './model'
import EvidenceLinks from './EvidenceLinks.vue'
const props=defineProps<{data:JsonObject}>()
defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject]}>()
const query=ref(''),missingOnly=ref(false),page=ref(1)
const columns=computed(()=>extractionColumns(props.data))
const all=computed(()=>rows(props.data.rows ?? props.data.extractions))
const filtered=computed(()=>all.value.filter(row=>(!query.value || String(row.fileName ?? row.name ?? '').includes(query.value)) && (!missingOnly.value || columns.value.some(col=>{const value=object(row.values ?? row.fields ?? row.data)[col];return value==null || value===''}))))
const shown=computed(()=>filtered.value.slice((page.value-1)*20,page.value*20))
function value(row:JsonObject,col:string){return object(row.values ?? row.fields ?? row.data)[col]}
function valueEvidence(row:JsonObject,col:string){const cell=value(row,col);return typeof cell==='object' && cell ? evidenceOf(cell) : evidenceOf(row)}
function valueText(row:JsonObject,col:string){const cell=value(row,col);return text(typeof cell==='object' && cell && 'value' in cell ? cell.value : cell)}
</script>
<template><div class="extract-results"><div class="result-toolbar"><el-input v-model="query" placeholder="查找资料名称" clearable @input="page=1"/><el-checkbox v-model="missingOnly" @change="page=1">只看缺少字段的资料</el-checkbox><span class="muted">{{filtered.length}} 份资料 · {{columns.length}} 个字段</span></div><el-table :data="shown" stripe empty-text="没有符合条件的提取记录"><el-table-column label="资料名称" min-width="220" fixed><template #default="{row}">{{row.fileName ?? row.file_name ?? row.name ?? '资料名称未返回'}}</template></el-table-column><el-table-column v-for="column in columns" :key="column" :label="column" min-width="230"><template #default="{row}"><div class="value-text" :class="{'missing':valueText(row,column)==='未返回'}">{{valueText(row,column)==='未返回' ? '未提取到' : valueText(row,column)}}</div><EvidenceLinks v-if="valueEvidence(row,column).length" :evidence="valueEvidence(row,column)" @open="$emit('source',$event)"/></template></el-table-column><el-table-column label="详情" width="80" fixed="right"><template #default="{row}"><el-button text type="primary" @click="$emit('detail',row)">展开</el-button></template></el-table-column></el-table><el-pagination v-model:current-page="page" :total="filtered.length" :page-size="20" layout="total,prev,pager,next" hide-on-single-page class="pagination"/></div></template>
<style scoped>.result-toolbar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.result-toolbar .el-input{max-width:300px}.muted,.missing{color:#596b80}.value-text{white-space:pre-wrap;max-height:120px;overflow:auto}.pagination{margin-top:16px;justify-content:flex-end}.extract-results{min-width:0}</style>
