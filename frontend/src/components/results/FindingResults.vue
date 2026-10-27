<script setup lang="ts">
import {computed,ref} from 'vue'
import type {Evidence,JsonObject,ToolId} from '@/domain/types'
import {rows,text,resultEmptyText} from './model'
import BusinessTable from './BusinessTable.vue'
const props=defineProps<{data:JsonObject;tool:ToolId}>()
defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject]}>()
const query=ref(''),level=ref(''),category=ref('')
const all=computed(()=>rows(props.data.findings))
const levels=computed(()=>[...new Set(all.value.map(r=>r.level ?? r.riskLevel ?? r.risk_level).filter(Boolean))])
const categories=computed(()=>[...new Set(all.value.map(r=>r.projectName ?? r.project ?? r.category ?? r.riskPoint ?? r.risk_point).filter(Boolean))])
const filtered=computed(()=>all.value.filter(row=>(!query.value || text(row).toLowerCase().includes(query.value.toLowerCase())) && (!level.value || (row.level ?? row.riskLevel ?? row.risk_level)===level.value) && (!category.value || (row.projectName ?? row.project ?? row.category ?? row.riskPoint ?? row.risk_point)===category.value)))
</script>
<template><div><div class="result-toolbar"><el-input v-model="query" clearable :placeholder="tool==='risk' ? '查找风险点、资料或线索' : '查找规则、条款或资料'"/><el-select v-if="levels.length" v-model="level" clearable placeholder="全部风险等级"><el-option v-for="item in levels" :key="item" :label="item" :value="item"/></el-select><el-select v-if="categories.length" v-model="category" clearable filterable :placeholder="tool==='bidding' ? '全部项目' : '全部类别'"><el-option v-for="item in categories" :key="item" :label="item" :value="item"/></el-select><span class="muted">{{filtered.length}} 条检查记录</span></div><p class="result-note">检查结果用于定位待核验事项，请结合来源资料确认事实。</p><pre v-if="data.automaticAnalysis" class="auto-analysis">{{data.automaticAnalysis}}</pre><BusinessTable :rows="filtered" :empty-text="resultEmptyText(data,'findings',!!(query || level || category))" @source="$emit('source',$event)" @detail="$emit('detail',$event)"/></div></template>
<style scoped>.auto-analysis{white-space:pre-wrap;font:inherit;line-height:1.7;padding:16px;background:#f8fafc;border:1px solid #e6ebf1;border-radius:8px}.result-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.result-toolbar .el-input{max-width:320px}.result-toolbar .el-select{max-width:210px}.muted,.result-note{font-size:14px;color:#596b80}.result-note{margin:16px 0}</style>
