<script setup lang="ts">
import {computed,ref} from 'vue'
import {ElMessage} from 'element-plus'
import type {Evidence,JsonObject,Task} from '@/domain/types'
import {service} from '@/services/service'
import {rows,text,resultEmptyText} from './model'
import BusinessTable from './BusinessTable.vue'
const props=defineProps<{data:JsonObject;task:Task}>()
const emit=defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject];refresh:[]}>()
const query=ref(''),active=ref(props.task.tool==='engineering' ? 'duplicates' : 'matches'),prompt=ref(''),busy=ref(false)
const sections=computed(()=>props.task.tool==='engineering' ? [{key:'duplicates',label:'重复项目'},{key:'parentChildren',label:'主子项目'}] : [{key:'matches',label:'关联项目'},{key:'differences',label:'金额差异'},{key:'unmatchedA',label:'仅表 A 存在'},{key:'unmatchedB',label:'仅表 B 存在'}])
const filtered=computed(()=>rows(props.data[active.value]).filter(row=>!query.value || text(row).toLowerCase().includes(query.value.toLowerCase())))
async function compare(){busy.value=true;try{await service.continueTask(props.task,'association-compare',{prompt:prompt.value});emit('refresh')}catch(e){ElMessage.error(e instanceof Error ? e.message : '比较分析失败')}finally{busy.value=false}}
</script>
<template><div><p class="ledger-note">{{task.tool==='engineering' ? '分别查看每份台账内的重复项目与主子项目候选关系。评分与原始行号均保留，便于回查。' : '分别查看关联项目、金额差异及两表各自未匹配的项目。候选关系需结合台账原始记录核验。'}}</p><el-alert v-for="(error,i) in data.errors||[]" :key="i" :title="String(error)" type="error" :closable="false"/><el-tabs v-model="active"><el-tab-pane v-for="section in sections" :key="section.key" :name="section.key" :label="`${section.label}（${Array.isArray(data[section.key]) ? rows(data[section.key]).length : '未返回'}）`"/></el-tabs><el-input v-model="query" clearable placeholder="查找项目名称、编号或判断依据" style="max-width:380px;margin-bottom:16px"/><BusinessTable :rows="filtered" :empty-text="resultEmptyText(data,active,!!query)" @source="emit('source',$event)" @detail="emit('detail',$event)"/><el-collapse v-if="task.tool==='association'"><el-collapse-item title="进一步比较关联项目" name="compare"><p class="ledger-note">按补充要求分析已关联项目，保留两侧未匹配记录。</p><el-input v-model="prompt" type="textarea" :rows="3" placeholder="例如：比较关联项目的预算金额，指出差异及可能原因。"/><el-button type="primary" :loading="busy" :disabled="!prompt.trim()" @click="compare" style="margin-top:12px">开始比较</el-button></el-collapse-item></el-collapse></div></template>
<style scoped>.ledger-note{color:#596b80;font-size:14px;line-height:1.7;margin-top:0}</style>
