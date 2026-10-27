<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { FullScreen, Close, Document, Refresh } from '@element-plus/icons-vue'
import { service } from '@/services/service'
import type { Evidence, Material, SourceContent } from '@/domain/types'
import { sourcePreviewUrl } from '@/domain/sourcePreview'
import { messageOf } from '@/composables/useFileBrowser'
const props=withDefaults(defineProps<{file:Material|null;step?:boolean;evidence?:Evidence}>(),{step:true})
const content=ref<SourceContent>({}),loading=ref(false),error=ref(''),tab=ref('original'),expanded=ref(false),page=ref(1)
const officeHost=ref<HTMLElement>(),officeError=ref(''),officeLoading=ref(false),tableSheets=ref<string[]>([]),sheet=ref(''),tableColumns=ref<string[]>([]),tableRows=ref<Record<string,string>[]>([]),tablePage=ref(1)
let request:AbortController|undefined,officeRequest:AbortController|undefined,workbook:any
const extension=computed(()=>props.file?.extension.toLowerCase().replace(/^\./,'')||'')
const safeUrl=computed(()=>sourcePreviewUrl(content.value.url,window.location.href,props.file?.canDownload!==false))
const isPdf=computed(()=>content.value.mimeType?.includes('pdf')||/\.pdf(?:[?#]|$)/i.test(safeUrl.value)||extension.value==='pdf')
const isImage=computed(()=>content.value.mimeType?.startsWith('image/')||['png','jpg','jpeg','gif','webp','bmp'].includes(extension.value))
const isWord=computed(()=>!isPdf.value&&extension.value==='docx')
const isSheet=computed(()=>!isPdf.value&&['xlsx','xls','csv'].includes(extension.value))
const pdfUrl=computed(()=>`${safeUrl.value.split('#')[0]}#page=${page.value}&view=FitH&toolbar=0`)
const visibleRows=computed(()=>tableRows.value.slice((tablePage.value-1)*50,tablePage.value*50))
async function load(){request?.abort();officeRequest?.abort();request=new AbortController();const active=request;content.value={};error.value='';officeError.value='';tableRows.value=[];tableColumns.value=[];tableSheets.value=[];page.value=props.evidence?.page||1;workbook=undefined;officeLoading.value=false;loading.value=false;if(!props.file)return;if(props.file.canDownload===false){error.value='无原文件查看权限。';return}loading.value=true;try{const data=await service.getSource(props.file,active.signal);if(active!==request)return;content.value=data;if(!data.url&&data.text)tab.value='text';else tab.value='original';loading.value=false;await nextTick();await renderOffice()}catch(e){if(!active.signal.aborted)error.value=messageOf(e)}finally{if(active===request)loading.value=false}}
async function renderOffice(){if(tab.value!=='original'||!safeUrl.value||(!isWord.value&&!isSheet.value))return;officeRequest?.abort();officeRequest=new AbortController();const active=officeRequest;officeLoading.value=true;officeError.value='';try{const response=await fetch(safeUrl.value,{credentials:new URL(safeUrl.value).origin===window.location.origin?'same-origin':'omit',signal:active.signal});if(!response.ok)throw new Error(`原文件加载失败（${response.status}）`);const data=await response.arrayBuffer();if(active!==officeRequest)return;if(data.byteLength>50*1024*1024)throw new Error('该文件较大，请下载原件查看，或使用服务端生成的预览。');if(isWord.value){await nextTick();const {renderAsync}=await import('docx-preview');if(active!==officeRequest||active.signal.aborted)return;if(officeHost.value){const host=document.createElement('div');await renderAsync(data,host,undefined,{inWrapper:true,ignoreWidth:false,ignoreHeight:false,breakPages:true,renderAltChunks:false});if(active!==officeRequest||active.signal.aborted)return;for(const link of host.querySelectorAll('a')){const href=link.getAttribute('href')||'';if(!/^(https?:|mailto:|#)/i.test(href))link.removeAttribute('href');link.setAttribute('rel','noopener noreferrer')}officeHost.value?.replaceChildren(host)}}else{const XLSX=await import('xlsx');if(active!==officeRequest||active.signal.aborted)return;workbook=XLSX.read(data,{type:'array',cellDates:true});tableSheets.value=workbook.SheetNames;sheet.value=tableSheets.value[0]||'';await changeSheet()}}catch(e){if(!active.signal.aborted)officeError.value=messageOf(e)}finally{if(active===officeRequest)officeLoading.value=false}}
async function changeSheet(){if(!workbook||!sheet.value)return;const XLSX=await import('xlsx');const rows=XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheet.value],{header:1,defval:'',raw:false});const columns=Array.from({length:rows.reduce((max,row)=>Math.max(max,row.length),0)},(_,index)=>XLSX.utils.encode_col(index));tableColumns.value=columns;tableRows.value=rows.map(row=>Object.fromEntries(columns.map((_,index)=>[`c${index}`,String(row[index]??'')])));tablePage.value=1}
watch(()=>[props.file?.id,props.file?.canDownload],load,{immediate:true})
watch(()=>props.evidence?.page,value=>{if(value)page.value=value})
watch(tab,async()=>{await nextTick();await renderOffice()})
watch(expanded,async()=>{await nextTick();if(isWord.value)await renderOffice()})
onBeforeUnmount(()=>{request?.abort();officeRequest?.abort()})
</script>
<template>
 <section :class="['source-preview',{'source-expanded':expanded}]" @keydown.esc="expanded=false">
  <header class="source-head">
   <span class="source-title"><span v-if="step" class="step-index">Step 2</span> 查看原文</span>
   <strong v-if="file" class="source-name" :title="file.name">{{file.name}}</strong>
   <div class="source-tabs"><button :class="{active:tab==='original'}" @click="tab='original'">原文件</button><button :class="{active:tab==='text'}" @click="tab='text'">解析文本</button></div>
   <el-button text :icon="expanded?Close:FullScreen" :aria-label="expanded?'退出放大':'放大查看'" :title="expanded?'退出放大':'放大查看'" @click="expanded=!expanded"/>
  </header>
  <div v-if="file&&tab==='original'&&isPdf&&safeUrl" class="source-controls"><el-button size="small" :disabled="page<=1" aria-label="上一页" @click="page--">‹</el-button><span>第</span><el-input-number v-model="page" :min="1" :max="content.totalPages||99999" controls-position="right" size="small" aria-label="原文页码"/><span>{{content.totalPages?`/ ${content.totalPages} 页`:'页'}}</span><span class="source-control-hint">适合宽度</span></div>
  <div class="source-body" v-loading="loading||officeLoading">
   <el-empty v-if="!file" :image-size="72" description="点击左侧文件查看原文"/>
   <div v-else-if="error" class="source-state"><el-alert :title="error" type="error" :closable="false" show-icon/><el-button :icon="Refresh" @click="load">重新加载</el-button></div>
   <template v-else-if="!loading">
    <div v-if="tab==='text'" class="parsed-text"><template v-if="content.text"><div v-if="evidence?.quote" class="evidence-quote"><strong>关联摘录</strong><p>{{evidence.quote}}</p></div><pre>{{content.text}}</pre></template><el-empty v-else :image-size="64" description="尚无可用的解析文本"/></div>
    <template v-else>
     <iframe v-if="safeUrl&&isPdf" :src="pdfUrl" :title="`${file.name} 原文预览`" class="pdf-frame"/>
     <div v-else-if="safeUrl&&isImage" class="image-preview"><img :src="safeUrl" :alt="file.name"/></div>
     <div v-else-if="safeUrl&&isWord" ref="officeHost" class="word-preview"/>
     <div v-else-if="safeUrl&&isSheet" class="sheet-preview"><div class="sheet-controls"><el-select v-model="sheet" aria-label="工作表" @change="changeSheet"><el-option v-for="name in tableSheets" :key="name" :value="name" :label="name"/></el-select><span>{{tableRows.length}} 行</span></div><el-table :data="visibleRows" height="100%" border><el-table-column v-for="(column,index) in tableColumns" :key="index" :prop="`c${index}`" :label="column" min-width="150" show-overflow-tooltip/></el-table><el-pagination v-model:current-page="tablePage" :page-size="50" :total="tableRows.length" layout="prev,pager,next"/></div>
     <div v-else class="source-state"><el-icon size="40"><Document/></el-icon><p>{{safeUrl?'此格式暂不支持在线预览，可下载原文件查看。':'服务尚未返回可用的原文件预览地址。'}}</p><el-button v-if="content.text" @click="tab='text'">查看解析文本</el-button><a v-if="safeUrl" :href="safeUrl" target="_blank" rel="noopener noreferrer" download>下载原文件</a></div>
     <el-alert v-if="officeError" :title="officeError" type="error" :closable="false" show-icon class="office-error"/>
    </template>
   </template>
  </div>
 </section>
</template>
<style scoped>
.source-preview{height:100%;min-height:280px;display:flex;flex-direction:column;min-width:0;background:#f2f4f7;border:1px solid #e6ebf1;border-radius:8px;overflow:hidden}.source-head{min-height:46px;padding:0 10px;display:flex;align-items:center;gap:10px;background:white;border-bottom:1px solid #e6ebf1;flex-shrink:0}.source-title{font-weight:600;font-size:14px;white-space:nowrap}.step-index{color:#3269db;margin-right:5px}.source-name{min-width:0;flex:1;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.source-tabs{display:flex;flex-shrink:0;gap:12px;height:44px}.source-tabs button{border:none;border-bottom:2px solid transparent;background:transparent;color:#596b80;font:inherit;font-size:14px;padding:0;cursor:pointer;white-space:nowrap}.source-tabs button.active{color:#2555b4;border-bottom-color:#3269db}.source-controls{min-height:38px;display:flex;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid #e6ebf1;background:#fff;font-size:14px}.source-controls .el-input-number{width:78px}.source-control-hint{margin-left:auto;color:#596b80;font-size:13px}.source-body{flex:1;min-height:0;overflow:auto;position:relative}.pdf-frame{display:block;width:100%;height:100%;min-height:400px;border:none;background:white}.source-state{min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px;text-align:center;color:#596b80}.parsed-text{padding:20px;background:#fff;min-height:100%}.parsed-text pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:16px;line-height:1.85;margin:0}.image-preview{padding:16px;text-align:center}.image-preview img{max-width:100%;height:auto}.word-preview :deep(.docx-wrapper){padding:16px;background:#f2f4f7}.word-preview :deep(.docx-wrapper>section.docx){max-width:100%;margin-bottom:16px}.source-expanded{position:fixed;inset:14px;z-index:4000;box-shadow:0 0 0 100vmax #17243b99;max-height:calc(100dvh - 28px);height:calc(100dvh - 28px)}.sheet-preview{display:flex;flex-direction:column;gap:10px;padding:10px;height:100%;min-height:350px}.sheet-controls{display:flex;gap:12px;align-items:center}.sheet-controls .el-select{width:200px}.sheet-preview .el-table{flex:1;min-height:200px}.evidence-quote{padding:12px;background:#fff5e5;border-left:3px solid #b77b22;margin-bottom:20px;line-height:1.7}.evidence-quote p{margin:6px 0 0}.office-error{position:sticky;bottom:0}.source-preview :deep(.el-button.is-text){padding:5px;min-width:28px}@media(max-width:1180px){.source-title .step-index{display:none}.source-head{gap:6px}.source-title{font-size:13px}.source-tabs{gap:8px}}@media(max-width:600px){.source-name{display:none}.source-title{flex:1}.source-expanded{inset:6px;max-height:calc(100dvh - 12px);height:calc(100dvh - 12px)}}
</style>
