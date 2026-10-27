<script setup lang="ts">
import {computed,ref} from 'vue'
import type {Evidence,JsonObject} from '@/domain/types'
import {rows,evidenceOf,text} from './model'
import EvidenceLinks from './EvidenceLinks.vue'
import ExtractResults from './ExtractResults.vue'
const props=defineProps<{data:JsonObject}>()
defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject]}>()
const active=ref('themes'),query=ref('')
const themes=computed(()=>rows(props.data.themes).filter(row=>!query.value || text(row).includes(query.value)))
</script>
<template><div><el-tabs v-model="active"><el-tab-pane label="主题归纳" name="themes"/><el-tab-pane label="资料要点" name="extractions"/></el-tabs><template v-if="active==='themes'"><el-input v-model="query" clearable placeholder="查找主题或内容" style="max-width:340px;margin-bottom:16px"/><div class="themes"><article v-for="(theme,index) in themes" :key="theme.id ?? index" class="theme-card"><div class="theme-title"><span class="theme-number">{{index+1}}</span><h3>{{theme.name ?? theme.title ?? '主题名称未返回'}}</h3></div><p>{{theme.summary ?? theme.description ?? theme.content ?? '归纳内容未返回'}}</p><EvidenceLinks :evidence="evidenceOf(theme)" @open="$emit('source',$event)"/><el-button text type="primary" @click="$emit('detail',theme)">主题详情</el-button></article></div><div v-if="data.summary && !themes.length" class="summary">{{text(data.summary)}}</div><el-empty v-else-if="!themes.length" description="尚未返回主题归纳结果；可在资料要点中查看已提取内容"/></template><ExtractResults v-else :data="{fields:data.fields,rows:data.extractions}" @source="$emit('source',$event)" @detail="$emit('detail',$event)"/></div></template>
<style scoped>.themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:20px}.theme-card{border:1px solid #e6ebf1;border-radius:8px;padding:20px}.theme-title{display:flex;gap:12px;align-items:center}.theme-title h3{font-size:18px;margin:0}.theme-number{border-radius:6px;color:#3269db;background:#eef4ff;padding:4px 10px}.theme-card p,.summary{white-space:pre-wrap;line-height:1.8}.summary{padding:16px;background:#f7f9fc}</style>
