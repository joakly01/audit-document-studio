<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Document } from '@element-plus/icons-vue'
import { service } from '@/services/service'
import type { Material } from '@/domain/types'
import { isMaterialSelectable, mergeSelection, togglePageSelection, reconcileSelection } from '@/domain/fileSelection'
import { useFileBrowser, messageOf, formatSize } from '@/composables/useFileBrowser'
import FolderNavigator from './library/FolderNavigator.vue'
const props=withDefaults(defineProps<{modelValue:boolean;selected:Material[];multiple?:boolean;parsedOnly?:boolean;extensions?:string[];title?:string}>(),{multiple:true,parsedOnly:true,extensions:()=>[],title:'添加资料'})
const emit=defineEmits<{'update:modelValue':[boolean];confirm:[Material[]]}>()
const browser=useFileBrowser()
const {query,folders,files,total,loading,error,folderLoading,folderError,currentPath}=browser
const chosen=ref<Material[]>([]),resolving=ref(false),confirming=ref(false),composition=ref(false),changedNotice=ref('')
let dialogVersion=0
const selectedIds=computed(()=>new Set(chosen.value.map(f=>f.id)))
const availablePage=computed(()=>files.value.filter(eligible))
const pageChecked=computed(()=>availablePage.value.length>0&&availablePage.value.every(f=>selectedIds.value.has(f.id)))
const pagePartial=computed(()=>!pageChecked.value&&availablePage.value.some(f=>selectedIds.value.has(f.id)))
function eligible(file:Material){return isMaterialSelectable(file,props.parsedOnly,props.extensions)}
function reason(file:Material){if(file.canAnalyze===false)return '无分析权限';if(props.parsedOnly&&file.parseStatus!=='parsed')return {unparsed:'未解析',parsing:'解析中',failed:'解析失败',parsed:'解析完成'}[file.parseStatus];return props.extensions.length?`仅支持 ${props.extensions.join('、')}`:''}
function toggle(file:Material,checked:boolean){if(!eligible(file))return;if(checked)chosen.value=mergeSelection(chosen.value,[file],props.multiple);else chosen.value=chosen.value.filter(f=>f.id!==file.id);changedNotice.value=''}
function togglePage(checked:boolean){chosen.value=togglePageSelection(chosen.value,availablePage.value,checked);changedNotice.value=''}
async function removeScope(){const version=dialogVersion;resolving.value=true;try{const scope=await service.resolveSelection({...query,page:1});if(version!==dialogVersion)return;const ids=new Set(scope.map(file=>file.id));chosen.value=chosen.value.filter(file=>!ids.has(file.id));changedNotice.value=''}catch(e){ElMessage.error(messageOf(e))}finally{resolving.value=false}}
function onlyPage(){chosen.value=availablePage.value.slice();changedNotice.value=''}
function clearSelection(){chosen.value=[];changedNotice.value=''}
async function allPages(){const version=dialogVersion;resolving.value=true;changedNotice.value='';try{const selection=await service.resolveSelection({...query,page:1,parseStatus:props.parsedOnly?'parsed':undefined,extensions:props.extensions});if(version!==dialogVersion)return;const available=selection.filter(eligible);chosen.value=mergeSelection(chosen.value,available);ElMessage.success(`本范围已选择 ${available.length} 份资料`)}catch(e){ElMessage.error(messageOf(e))}finally{resolving.value=false}}
async function confirm(){const version=dialogVersion;confirming.value=true;try{const current=chosen.value.length?await service.getMaterials(chosen.value.map(f=>f.id)):[];if(version!==dialogVersion)return;const checked=reconcileSelection(chosen.value,current,props.parsedOnly,props.extensions);if(checked.removed.length){chosen.value=checked.files;changedNotice.value=`${checked.removed.length} 份资料的状态或权限已变化，已取消选择。请核对后再次确认。`;return}emit('confirm',checked.files);emit('update:modelValue',false)}catch(e){ElMessage.error(messageOf(e))}finally{confirming.value=false}}
watch(()=>props.modelValue,async open=>{dialogVersion++;if(open){chosen.value=[...props.selected];changedNotice.value='';query.extensions=props.extensions;await browser.initialize()}},{immediate:true})
</script>
<template>
 <el-dialog :model-value="modelValue" :title="title" width="min(1160px, calc(100vw - 28px))" top="5vh" class="material-picker-dialog" :close-on-click-modal="false" @update:model-value="emit('update:modelValue',$event)">
  <div class="picker-layout">
   <FolderNavigator :folders="folders" :space="query.space" :current-id="query.folderId" :loading="folderLoading" :error="folderError" @space="browser.changeSpace" @select="browser.chooseFolder" @refresh="browser.loadFolders" />
   <section class="picker-main">
    <div class="picker-location"><span><span class="muted">当前目录</span> <strong :title="currentPath">{{currentPath}}</strong></span><el-checkbox v-model="query.includeDescendants" @change="browser.search">包含下级文件夹</el-checkbox></div>
    <div class="picker-toolbar"><el-input v-model="query.keyword" :prefix-icon="Search" clearable placeholder="查找文件" aria-label="查找文件" @compositionstart="composition=true" @compositionend="composition=false" @keydown.enter="!composition&&!$event.isComposing&&browser.search()" @clear="browser.search"/><el-button @click="browser.search">查询</el-button></div>
    <div class="picker-selection"><span>已选 <strong>{{chosen.length}}</strong> 份<span v-if="parsedOnly" class="picker-eligible"> · 仅解析完成的资料可选</span></span><el-button v-if="multiple" link type="primary" :loading="resolving" :disabled="loading||!total" @click="allPages">选择全部页</el-button><el-button v-if="multiple&&chosen.length" link @click="onlyPage">仅保留本页</el-button><el-button v-if="chosen.length" link :disabled="resolving" @click="removeScope">取消本范围选择</el-button><el-button v-if="chosen.length" link @click="clearSelection">清空已选</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon/>
    <el-alert v-if="changedNotice" :title="changedNotice" type="warning" :closable="false" show-icon/>
    <el-table v-loading="loading" :data="files" row-key="id" height="100%" class="picker-table" empty-text="当前范围没有文件">
     <el-table-column width="76"><template #header><el-checkbox v-if="multiple" :model-value="pageChecked" :indeterminate="pagePartial" :disabled="!availablePage.length" aria-label="选择本页" @change="togglePage(Boolean($event))">本页</el-checkbox></template><template #default="{row}"><el-checkbox :model-value="selectedIds.has(row.id)" :disabled="!eligible(row)" :aria-label="`选择 ${row.name}`" @change="toggle(row,Boolean($event))"/></template></el-table-column>
     <el-table-column label="文件名称" min-width="230" show-overflow-tooltip><template #default="{row}"><span class="file-name"><el-icon><Document/></el-icon>{{row.name}}</span><small class="file-path">{{row.path}}</small></template></el-table-column>
     <el-table-column label="解析状态" width="104"><template #default="{row}"><span :class="['parse-state',row.parseStatus]">{{ {parsed:'解析完成',unparsed:'未解析',parsing:'解析中',failed:'解析失败'}[row.parseStatus as string] }}</span><small v-if="row.canAnalyze===false" class="not-selectable">无分析权限</small></template></el-table-column>
     <el-table-column label="大小" width="100"><template #default="{row}">{{formatSize(row.size)}}</template></el-table-column>
    </el-table>
    <el-pagination v-model:current-page="query.page" v-model:page-size="query.size" :total="total" :page-sizes="[20,50,100]" layout="total, prev, pager, next, sizes" @current-change="browser.changePage" @size-change="browser.changeSize"/>
   </section>
  </div>
  <template #footer><span class="picker-footer-count">已选 <strong>{{chosen.length}}</strong> 份资料</span><el-button @click="emit('update:modelValue',false)">取消</el-button><el-button type="primary" :loading="confirming" :disabled="resolving||confirming" @click="confirm">确认添加{{chosen.length?`（${chosen.length}）`:''}}</el-button></template>
 </el-dialog>
</template>
<style scoped>
.picker-layout{height:min(640px,70vh);display:grid;grid-template-columns:260px minmax(0,1fr);border:1px solid #e6ebf1;border-radius:8px;overflow:hidden}.picker-main{display:flex;flex-direction:column;min-width:0;padding:0 16px 12px;gap:10px}.picker-location{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e6ebf1;min-height:52px;flex-wrap:wrap}.picker-location>span{display:flex;min-width:0;gap:10px}.picker-location strong{font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.picker-toolbar{display:flex;gap:8px}.picker-toolbar .el-input{max-width:380px}.picker-selection{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;min-height:30px;font-size:14px;color:#596b80}.picker-selection strong,.picker-footer-count strong{color:#2555b4;font-size:17px}.picker-eligible{font-size:13px}.picker-table{flex:1;min-height:100px}.file-name{display:flex;gap:8px;align-items:center}.file-path{display:block;color:#596b80;font-size:12px;text-overflow:ellipsis;overflow:hidden}.parse-state.parsed{color:#1d735b}.parse-state.failed,.not-selectable{color:#a33e3e}.not-selectable{display:block}.picker-footer-count{margin-right:auto;color:#596b80;float:left;line-height:36px}.el-pagination{justify-content:flex-end;flex-wrap:wrap}.muted{color:#596b80}.picker-main :deep(.el-table__cell){font-size:14px;padding:9px 0}
@media(max-width:760px){.picker-layout{grid-template-columns:190px minmax(0,1fr)}.picker-location{align-items:flex-start;padding:8px 0}.picker-location>span{max-width:100%}.picker-main{padding:0 8px 8px}.picker-eligible{display:block}.picker-selection{align-items:flex-start}.picker-main :deep(.el-pagination__sizes){display:none}}
@media(max-width:560px){.picker-layout{display:flex;flex-direction:column;height:70vh}.picker-layout>.directory-nav{max-height:180px;flex:none;border-bottom:1px solid #e6ebf1}.picker-main{flex:1;min-height:0}.picker-footer-count{display:none}}
</style>
