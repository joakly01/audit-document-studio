<script setup lang="ts">
import {computed,ref} from 'vue'
import type {Evidence,JsonObject} from '@/domain/types'
import {rows,evidenceOf,text} from './model'
import EvidenceLinks from './EvidenceLinks.vue'
const props=defineProps<{data:JsonObject}>()
defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject]}>()
const query=ref(''),start=ref(''),end=ref(''),page=ref(1)
const filtered=computed(()=>rows(props.data.events).filter(row=>{const d=String(row.date ?? row.time ?? '');return (!query.value || text(row).includes(query.value)) && (!start.value || d>=start.value) && (!end.value || (d && d<=end.value))}).sort((a,b)=>String(a.date || '9999').localeCompare(String(b.date || '9999'))))
const shown=computed(()=>filtered.value.slice((page.value-1)*30,page.value*30))
</script>
<template><div><div class="result-toolbar"><el-input v-model="query" clearable placeholder="查找事项或参与方" @input="page=1"/><el-input v-model="start" type="date" aria-label="开始日期" @change="page=1"/><span>至</span><el-input v-model="end" type="date" aria-label="结束日期" @change="page=1"/><span class="muted">{{filtered.length}} 个事项</span></div><el-alert v-if="start && end && start>end" title="开始日期不能晚于结束日期" type="error" :closable="false"/><el-timeline class="event-timeline"><el-timeline-item v-for="(event,index) in shown" :key="event.id ?? index" :timestamp="event.date || event.time || '日期未提取'" placement="top"><article class="event-card"><strong>{{event.title ?? event.name ?? '事项名称未返回'}}</strong><p>{{event.summary ?? event.description ?? event.content ?? '事项内容未返回'}}</p><p v-if="event.participants" class="muted">涉及人员：{{text(event.participants)}}</p><EvidenceLinks :evidence="evidenceOf(event)" @open="$emit('source',$event)"/><el-button text type="primary" @click="$emit('detail',event)">事项详情</el-button></article></el-timeline-item></el-timeline><el-empty v-if="!filtered.length" description="没有符合条件的事项"/><el-pagination v-model:current-page="page" :page-size="30" :total="filtered.length" layout="total,prev,pager,next" hide-on-single-page/></div></template>
<style scoped>.result-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}.result-toolbar .el-input{max-width:180px}.result-toolbar .el-input:first-child{max-width:300px}.event-timeline{padding-left:8px;max-width:1100px}.event-card{padding:16px 20px;background:#f7f9fc;border:1px solid #e6ebf1;border-radius:8px}.event-card p{white-space:pre-wrap;line-height:1.8}.muted{color:#596b80;font-size:14px}</style>
