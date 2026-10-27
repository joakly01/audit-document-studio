<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {Evidence,JsonObject} from '@/domain/types'
import {displayLabels,evidenceOf,text,visibleColumns} from './model'
import EvidenceLinks from './EvidenceLinks.vue'
const props=withDefaults(defineProps<{rows:JsonObject[];columns?:string[];emptyText?:string;pageSize?:number;showSources?:boolean}>(),{emptyText:'没有符合条件的记录',pageSize:20,showSources:true})
defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject]}>()
const page=ref(1)
const columns=computed(()=>props.columns ?? visibleColumns(props.rows))
const shown=computed(()=>props.rows.slice((page.value-1)*props.pageSize,page.value*props.pageSize))
watch(()=>props.rows,()=>{page.value=1})
</script>
<template><div class="business-table"><el-table :data="shown" stripe :empty-text="emptyText" style="width:100%" @row-dblclick="(row:JsonObject)=>$emit('detail',row)"><el-table-column type="index" label="#" width="60" :index="(index:number)=>(page-1)*pageSize+index+1"/><el-table-column v-for="column in columns" :key="column" :label="displayLabels[column] ?? column" :prop="column" min-width="170" show-overflow-tooltip><template #default="{row}"><span class="cell-text">{{text(row[column])}}</span></template></el-table-column><el-table-column v-if="showSources" label="依据" min-width="150" fixed="right"><template #default="{row}"><EvidenceLinks :evidence="evidenceOf(row)" @open="$emit('source',$event)"/></template></el-table-column><el-table-column label="详情" width="80" fixed="right"><template #default="{row}"><el-button text type="primary" @click="$emit('detail',row)">展开</el-button></template></el-table-column></el-table><div class="table-pagination"><span class="muted">共 <strong>{{rows.length}}</strong> 条</span><el-pagination v-model:current-page="page" :page-size="pageSize" :total="rows.length" layout="prev,pager,next" hide-on-single-page/></div></div></template>
<style scoped>.business-table{min-width:0;width:100%}.table-pagination{display:flex;align-items:center;justify-content:space-between;padding:12px 0}.cell-text{white-space:pre-wrap;overflow-wrap:anywhere}.muted{color:#596b80;font-size:14px}</style>
