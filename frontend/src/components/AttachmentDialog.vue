<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Search, Document } from '@element-plus/icons-vue'
import { service } from '@/services/service'
import { ElMessage } from 'element-plus'
import { reconcileSelection } from '@/domain/fileSelection'
import { messageOf } from '@/composables/useFileBrowser'
import type { Material } from '@/domain/types'
const props=defineProps<{modelValue:boolean;file:Material|null;attachments:Material[];candidates:Material[]}>()
const emit=defineEmits<{'update:modelValue':[boolean];confirm:[Material[]]}>()
const keyword=ref(''),chosen=ref<Set<string>>(new Set()),page=ref(1),confirming=ref(false)
let dialogVersion=0
onBeforeUnmount(()=>dialogVersion++)
const candidates=computed(()=>[...new Map([...props.candidates,...props.attachments].filter(f=>f.id!==props.file?.id&&f.parseStatus==='parsed'&&f.canAnalyze!==false).map(f=>[f.id,f])).values()])
const filtered=computed(()=>candidates.value.filter(f=>f.name.toLowerCase().includes(keyword.value.trim().toLowerCase())))
const shown=computed(()=>filtered.value.slice((page.value-1)*15,page.value*15))
const all=computed(()=>shown.value.length>0&&shown.value.every(f=>chosen.value.has(f.id)))
const partial=computed(()=>!all.value&&shown.value.some(f=>chosen.value.has(f.id)))
function toggle(id:string,value:boolean){const next=new Set(chosen.value);value?next.add(id):next.delete(id);chosen.value=next}
function togglePage(value:boolean){shown.value.forEach(f=>toggle(f.id,value))}
async function confirm(){if(confirming.value)return;const version=dialogVersion;confirming.value=true;try{const selected=candidates.value.filter(f=>chosen.value.has(f.id));const checked=reconcileSelection(selected,await service.getMaterials(selected.map(f=>f.id)));if(version!==dialogVersion)return;if(checked.removed.length){chosen.value=new Set(checked.files.map(f=>f.id));ElMessage.warning('附件状态或权限已变化，请核对后再次确认。');return}emit('confirm',checked.files);emit('update:modelValue',false)}catch(e){if(version===dialogVersion)ElMessage.error(messageOf(e))}finally{if(version===dialogVersion)confirming.value=false}}
watch(()=>[props.modelValue,props.file?.id],()=>{dialogVersion++;confirming.value=false;if(props.modelValue){keyword.value='';page.value=1;chosen.value=new Set(props.attachments.map(f=>f.id))}},{flush:'sync',immediate:true})
watch(keyword,()=>page.value=1)
</script>
<template><el-dialog :model-value="modelValue" title="关联附件" width="min(820px, calc(100vw - 28px))" :close-on-click-modal="false" @update:model-value="emit('update:modelValue',$event)"><div class="attachment-parent">主文件：<strong>{{file?.name}}</strong></div><p class="attachment-help">选择补充资料作为附件，与主文件一同分析。可选范围为已添加资料及已有附件。</p><div class="attachment-toolbar"><el-input v-model="keyword" :prefix-icon="Search" placeholder="查找附件" aria-label="查找附件" clearable/><span>已选 <strong>{{chosen.size}}</strong> 份</span></div><el-table :data="shown" max-height="420" row-key="id" empty-text="没有可关联的已解析资料"><el-table-column width="80"><template #header><el-checkbox :disabled="confirming" :model-value="all" :indeterminate="partial" aria-label="选择本页附件" @change="togglePage(Boolean($event))">本页</el-checkbox></template><template #default="{row}"><el-checkbox :disabled="confirming" :model-value="chosen.has(row.id)" :aria-label="`关联 ${row.name}`" @change="toggle(row.id,Boolean($event))"/></template></el-table-column><el-table-column label="文件名称" min-width="300" show-overflow-tooltip><template #default="{row}"><span class="attachment-name"><el-icon><Document/></el-icon>{{row.name}}</span></template></el-table-column><el-table-column label="目录" prop="path" min-width="170" show-overflow-tooltip/></el-table><el-pagination v-model:current-page="page" :total="filtered.length" :page-size="15" layout="total,prev,pager,next"/><template #footer><el-button @click="emit('update:modelValue',false)">取消</el-button><el-button type="primary" :loading="confirming" @click="confirm">确认关联{{chosen.size?`（${chosen.size}）`:''}}</el-button></template></el-dialog></template>
<style scoped>.attachment-parent{font-size:15px;line-height:1.7;overflow-wrap:anywhere}.attachment-parent strong{font-weight:500}.attachment-help{font-size:14px;color:#596b80;margin:12px 0 18px}.attachment-toolbar{display:flex;gap:18px;align-items:center;margin-bottom:12px}.attachment-toolbar .el-input{max-width:400px}.attachment-toolbar>span{white-space:nowrap}.attachment-toolbar strong{color:#2555b4}.attachment-name{display:flex;gap:8px;align-items:center}.el-pagination{margin-top:14px;justify-content:flex-end;flex-wrap:wrap}</style>
