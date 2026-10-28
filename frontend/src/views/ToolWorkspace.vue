<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import {Plus,Paperclip,Close,Document,Refresh} from '@element-plus/icons-vue'
import {toolMap} from '@/domain/tools'
import {feeOptions} from '@/domain/prompts'
import {loadAssociationConfig,restoreRuleCatalogs,selectedRuleCatalog} from '@/domain/configuration'
import type {ToolId,Material,Prompt,JsonObject} from '@/domain/types'
import {useWorkspace} from '@/stores/workspace'
import {cloneDraft,participatingFiles,validateDraft} from '@/domain/validation'
import {rulesFromConfig,type Rule} from '@/domain/rules'
import {service} from '@/services/service'
import MaterialPicker from '@/components/MaterialPicker.vue'
import SourcePreview from '@/components/SourcePreview.vue'
import AttachmentDialog from '@/components/AttachmentDialog.vue'
import PromptPanel from '@/components/PromptPanel.vue'
import RulePicker from '@/components/RulePicker.vue'
import ExtractionSettings from '@/components/config/ExtractionSettings.vue'
import WordSettings from '@/components/config/WordSettings.vue'
import ContractRules from '@/components/config/ContractRules.vue'
import BiddingMaterials from '@/components/config/BiddingMaterials.vue'
import TableSettings from '@/components/config/TableSettings.vue'
import PanelResizer from '@/components/PanelResizer.vue'
import ToolGlyph from '@/components/ToolGlyph.vue'
const route=useRoute(),router=useRouter(),store=useWorkspace()
const tool=computed(()=>String(route.params.tool) as ToolId),definition=computed(()=>toolMap[tool.value]),draft=computed(()=>store.getDraft(tool.value))
const biddingMaterials=ref<InstanceType<typeof BiddingMaterials>|null>(null)
const editorGeneration=ref(0),leftWidth=ref(320),rightWidth=ref(320),attachmentSaving=ref(new Set<string>())
const filePicker=ref(false),previewFile=ref<Material|null>(null),previewDialog=ref(false),attachmentsOpen=ref(false),attachmentFile=ref<Material|null>(null),fileSearch=ref(''),page=ref(1),mobilePanel=ref('materials'),associationRole=ref<'table1'|'table2'|null>(null),biddingMode=ref('bidding_only'),submitting=ref(false),confirmOpen=ref(false),errors=ref<string[]>([])
const files=computed(()=>participatingFiles(draft.value)),filtered=computed(()=>draft.value.files.filter(f=>f.name.includes(fileSearch.value.trim()))),paged=computed(()=>filtered.value.slice((page.value-1)*30,page.value*30))
const selectedForPicker=computed(()=>associationRole.value?[draft.value.config[associationRole.value]].filter(Boolean):draft.value.files)
const stages=computed(()=>definition.value.promptStages.filter(s=>tool.value==='bidding'?draft.value.config.analysisModes.includes(s.key):tool.value==='engineering'?(s.key==='duplicate'?draft.value.config.duplicateEnabled:draft.value.config.parentChildEnabled):tool.value==='contract'?draft.value.config.contractCategory!=='auto':true))
const activeRules=computed(()=>selectedRuleCatalog(draft.value,tool.value==='bidding'?biddingMode.value:'main'))
const workArea=ref<HTMLElement|null>(null),workAreaWidth=ref(0)
let workAreaObserver:ResizeObserver|undefined
let attachmentVersion=0,contextVersion=0,active=true
watch(workArea,node=>{workAreaObserver?.disconnect();if(node){workAreaWidth.value=node.clientWidth;workAreaObserver=new ResizeObserver(()=>workAreaWidth.value=node.clientWidth);workAreaObserver.observe(node)}})
onBeforeUnmount(()=>{active=false;attachmentVersion++;contextVersion++;workAreaObserver?.disconnect()})
const visiblePanel=computed({get:()=>workAreaWidth.value>=620&&mobilePanel.value==='materials'?'config':mobilePanel.value,set:(value:string)=>mobilePanel.value=value})

watch(tool,()=>{
 attachmentVersion++;contextVersion++
 leftWidth.value=rightWidth.value=tool.value==='extract'?368:320
 filePicker.value=false;attachmentsOpen.value=false;previewDialog.value=false;confirmOpen.value=false;associationRole.value=null;attachmentFile.value=null
 const key='audit:reanalysis:'+tool.value,serialized=sessionStorage.getItem(key)
 if(serialized){try{const recovered=JSON.parse(serialized);if(recovered.tool===tool.value)store.replaceDraft(recovered)}catch{ElMessage.warning('无法恢复再次分析配置，请重新选择。')}sessionStorage.removeItem(key)}
 const materials=sessionStorage.getItem('audit:selected-files');if(materials&&tool.value!=='bidding'&&tool.value!=='association'){try{draft.value.files=JSON.parse(materials).filter((f:Material)=>f.parseStatus==='parsed'&&f.canAnalyze!==false)}catch{}sessionStorage.removeItem('audit:selected-files')}
 draft.value.config.ruleCatalogs ||= {};draft.value.config.modeRules ||= {};draft.value.config.promptConfigs ||= {};draft.value.config.fieldRules ||= {};restoreRuleCatalogs(draft.value)
 previewFile.value=files.value[0]||null;fileSearch.value='';page.value=1;errors.value=[];mobilePanel.value='materials';biddingMode.value=draft.value.config.analysisModes?.[0]||'bidding_only'
},{immediate:true})
watch(fileSearch,()=>page.value=1)
watch(()=>filtered.value.length,()=>page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/30))))
function add(role?:'table1'|'table2'){associationRole.value=role||null;filePicker.value=true}
function added(next:Material[]){if(associationRole.value){draft.value.config[associationRole.value]=next[0]||null;associationRole.value=null}else draft.value.files=next;if(!previewFile.value||!files.value.some(f=>f.id===previewFile.value?.id))previewFile.value=files.value[0]||null}
function remove(f:Material){draft.value.files=draft.value.files.filter(x=>x.id!==f.id);delete draft.value.attachments[f.id];if(previewFile.value?.id===f.id)previewFile.value=draft.value.files[0]||null}
function preview(f:Material){previewFile.value=f;if(definition.value.layout==='two')previewDialog.value=true;else mobilePanel.value='source'}
async function attach(f:Material){
 if(attachmentSaving.value.has(f.id))return
 const target=draft.value,version=++attachmentVersion
 if(target.sourceTaskId&&!service.capabilities.taskAttachmentOverrides){ElMessage.info('当前环境暂不支持调整历史任务的附件，原关联附件保持不变。');return}
 attachmentsOpen.value=false
 try{
  const attachments=target.attachments[f.id]||(f.attachmentIds?.length?await service.getMaterials(f.attachmentIds):[])
  if(!active||version!==attachmentVersion||target!==draft.value||!target.files.some(file=>file.id===f.id))return
  target.attachments[f.id]=attachments;attachmentFile.value=f;attachmentsOpen.value=true
 }catch(e){if(active&&version===attachmentVersion&&target===draft.value)ElMessage.error((e as Error).message)}
}
async function attachmentConfirmed(next:Material[]){
 const file=attachmentFile.value,target=draft.value,sourceTaskId=target.sourceTaskId;if(!file||attachmentSaving.value.has(file.id))return
 attachmentSaving.value.add(file.id)
 try {
  if(!sourceTaskId)await service.saveAttachments(file.id,next.map(f=>f.id))
  if(!target.files.some(f=>f.id===file.id))return
  if(!sourceTaskId)file.attachmentIds=next.map(f=>f.id)
  target.attachments[file.id]=next
  if(active&&target===draft.value)ElMessage.success(sourceTaskId?'已更新本次分析的附件':'关联附件已保存')
 }catch(e){if(active&&target===draft.value)ElMessage.error((e as Error).message)}finally{attachmentSaving.value.delete(file.id)}
}
function promptLoaded(p:Prompt,stage:string){
 const c=draft.value.config
 c.promptConfigs[stage]=cloneDraft(p.config||{})
 const rules=rulesFromConfig(p.config,tool.value,stage)
 if(['risk','contract','bidding'].includes(tool.value)){
  c.ruleCatalogs[stage]=rules
  if(tool.value==='risk')c.riskPoints=cloneDraft(rules)
  else if(tool.value==='bidding')c.modeRules[stage]=cloneDraft(rules)
  else if(stage==='main')c.rules=cloneDraft(rules)
 }
 if(tool.value==='engineering'){
  const key=stage==='duplicate'?'duplicate_detection':'parent_child_analysis'
  c[key]=cloneDraft(p.config?.[key]||p.config||{});for(const file of Object.values(c.engineeringMappings||{}) as JsonObject[])delete file[stage]
  if(typeof c[key].threshold==='number')c[stage==='duplicate'?'duplicateThreshold':'parentChildThreshold']=c[key].threshold
 }
 if(tool.value==='association')loadAssociationConfig(c,p.config||{})
}
function modeChanged(){if(!draft.value.config.analysisModes.includes(biddingMode.value))biddingMode.value=draft.value.config.analysisModes[0]||'bidding_only'}
function confirm(){errors.value=validateDraft(draft.value);if(errors.value.length){mobilePanel.value='config';return}if(!draft.value.name.trim())draft.value.name=definition.value.name+' · '+new Date().toLocaleString('zh-CN',{hour12:false});confirmOpen.value=true}
async function submit(){
 if(submitting.value)return
 errors.value=validateDraft(draft.value);if(errors.value.length){confirmOpen.value=false;return}
 const context=contextVersion,snapshot=cloneDraft(draft.value);snapshot.files=cloneDraft(files.value);submitting.value=true
 try{const task=await service.submitTask(snapshot);if(!active)return;if(context!==contextVersion){ElMessage.success(`任务「${snapshot.name}」已提交，可在任务中心查看。`);return}confirmOpen.value=false;await router.push('/tasks/'+encodeURIComponent(task.id))}
 catch(e){if(active)ElMessage.error((e as Error).message)}finally{submitting.value=false}
}
async function reset(){try{await ElMessageBox.confirm('清空当前草稿，重新选择资料和分析内容？','重新设置',{confirmButtonText:'清空',cancelButtonText:'取消'});attachmentVersion++;contextVersion++;store.reset(tool.value);editorGeneration.value++;draft.value.config.ruleCatalogs={};draft.value.config.modeRules={};draft.value.config.promptConfigs={};draft.value.config.fieldRules={};previewFile.value=null;errors.value=[]}catch{}}
</script>
<template>
 <div ref="workArea" class="tool-page" v-if="definition" :key="tool">
  <header class="page-heading"><div class="tool-heading"><ToolGlyph :tool="tool"/><h1 :title="definition.description">{{definition.name}}</h1><p class="tool-description sr-only">{{definition.description}}</p></div><div class="actions"><el-button text :icon="Refresh" aria-label="重新设置" title="重新设置" @click="reset"/><el-button @click="router.push('/tool/'+tool+'/history')">分析记录</el-button><el-button type="primary" @click="confirm" :loading="submitting">{{definition.action}}</el-button></div></header>
  <div v-if="draft.sourceTaskId" class="reanalysis-note">已载入历史资料与设置。修改后提交，将生成新的分析记录。</div>
  <div class="panel-tabs"><el-radio-group v-model="visiblePanel"><el-radio-button v-if="workAreaWidth<620" value="materials">添加资料</el-radio-button><el-radio-button v-if="definition.layout==='three'" value="source">查看原文</el-radio-button><el-radio-button value="config">设置分析内容</el-radio-button></el-radio-group></div>
  <div class="workspace" :style="{'--left-width':leftWidth+'px','--right-width':rightWidth+'px'}" :class="[definition.layout, 'show-'+mobilePanel,tool+'-workspace']">
   <aside class="materials panel" :class="{'selected-panel':mobilePanel==='materials'}"><div class="panel-heading"><h2 class="section-title"><span class="step">Step 1</span>{{definition.step1}}</h2><el-button v-if="tool==='bidding'" class="material-add" type="primary" :icon="Plus" @click="biddingMaterials?.addProject()">添加项目</el-button><el-button v-else-if="tool!=='association'" class="material-add" type="primary" :icon="Plus" @click="add()">添加</el-button></div>
    <BiddingMaterials ref="biddingMaterials" v-if="tool==='bidding'" :config="draft.config" @preview="preview" class="scroll-body"/>
    <div v-else-if="tool==='association'" class="scroll-body association-materials"><p class="help">分别选择两张台账，再配置右侧字段对应关系。</p><section v-for="(label,key) in {table1:'对照表 A',table2:'对照表 B'}" :key="key" class="table-role"><h3>{{label}}</h3><template v-if="draft.config[key]"><button class="table-file" @click="preview(draft.config[key])">{{draft.config[key].name}}</button><p class="muted">{{draft.config[key].path}}</p></template><p v-else class="help">尚未选择台账</p><el-button @click="add(key)" style="width:100%">{{draft.config[key]?'更换台账':'选择台账'}}</el-button></section></div>
    <template v-else><p class="selection-guide">点击“添加”选择文件，下方为已选资料。</p><div class="file-search"><el-input v-model="fileSearch" placeholder="查找已选资料" clearable aria-label="查找已选资料"/></div><div class="selected-list scroll-body"><div v-if="!filtered.length" class="empty-state">{{draft.files.length?'没有符合条件的资料':'尚未添加资料'}}</div><article v-for="f in paged" :key="f.id" :class="['selected-file',{active:previewFile?.id===f.id}]"><button class="file-open" @click="preview(f)" :title="f.name"><el-icon><Document/></el-icon><span>{{f.name}}</span></button><button v-if="tool==='extract'" class="icon-button" :disabled="attachmentSaving.has(f.id)" :aria-busy="attachmentSaving.has(f.id)" :aria-label="'关联附件 '+f.name" :title="'关联附件（'+(draft.attachments[f.id]?.length||f.attachmentIds?.length||0)+'）'" @click="attach(f)"><el-icon><Paperclip/></el-icon><sup v-if="draft.attachments[f.id]?.length">{{draft.attachments[f.id].length}}</sup></button><button class="icon-button" :aria-label="'移除 '+f.name" :title="'移出本次资料：'+f.name" @click="remove(f)"><el-icon><Close/></el-icon></button></article></div><div v-if="filtered.length>30" class="file-pagination"><span>第 {{(page-1)*30+1}}–{{Math.min(page*30,filtered.length)}} 份 / {{filtered.length}} 份</span><el-pagination v-model:current-page="page" :page-size="30" :total="filtered.length" layout="prev,next" small/></div></template>
    <PanelResizer v-if="definition.layout==='three'" v-model="leftWidth" :default-value="tool==='extract'?368:320" label="调整资料栏宽度"/><footer class="selection-total">已选 <strong>{{files.length}}</strong> 份{{tool==='prepaid'||tool==='contract'?'合同':'资料'}}</footer>
   </aside>
   <section v-if="definition.layout==='three'" class="source panel" :class="{'selected-panel':mobilePanel==='source'}"><SourcePreview :file="previewFile" :step="true"/></section>
   <section class="configuration panel" :class="{'selected-panel':mobilePanel==='config'}"><PanelResizer v-if="definition.layout==='three'" v-model="rightWidth" :default-value="tool==='extract'?368:320" reverse label="调整配置栏宽度"/><div class="panel-heading"><h2 class="section-title"><span class="step">Step {{definition.layout==='three'?3:2}}</span>{{definition.step3}}</h2></div><div class="config-content scroll-body">
     <ExtractionSettings v-if="tool==='extract'" :config="draft.config"/>
     <WordSettings v-else-if="tool==='word'" :config="draft.config"/>
     <template v-else>
      <section v-if="tool==='bidding'" class="form-section bidding-modes-section"><h3>检查方式</h3><el-checkbox-group v-model="draft.config.analysisModes" @change="modeChanged" class="bidding-modes"><div v-for="stage in definition.promptStages" :key="stage.key" :class="['bidding-mode-card',{active:biddingMode===stage.key&&draft.config.analysisModes.includes(stage.key)}]"><el-checkbox :value="stage.key">{{stage.label}}</el-checkbox><el-button link :type="biddingMode===stage.key?'primary':undefined" :disabled="!draft.config.analysisModes.includes(stage.key)" @click="biddingMode=stage.key">{{biddingMode===stage.key?'当前规则':'查看规则'}}<span v-if="draft.config.modeRules[stage.key]" class="mode-rule-count">{{draft.config.modeRules[stage.key].length}}</span></el-button></div></el-checkbox-group><p class="help">联合分析需同一项目同时包含招标文件和投标文件。</p></section>
      <section v-if="tool==='contract'" class="form-section"><h3>合同类别</h3><el-radio-group v-model="draft.config.contractCategory"><el-radio value="auto">自动识别</el-radio><el-radio value="construction">施工合同</el-radio><el-radio value="non_construction">非施工合同</el-radio></el-radio-group><div><el-checkbox v-model="draft.config.autoAnalysis">补充自动分析</el-checkbox></div><p class="help">{{draft.config.contractCategory==='auto'?'自动识别合同类别并使用系统检查内容。指定类别后，可调整规则和提示词。':'按下方规则检查合同；开启补充自动分析，可同时查找规则之外的关注事项。'}}</p></section>
      <section v-if="tool==='prepaid'" class="form-section"><h3>费用类型</h3><el-select :model-value="draft.config.feeTypes[0]" placeholder="选择费用类型" @change="draft.config.feeTypes=[$event];draft.prompts={}"><el-option v-for="f in feeOptions" :key="f.value" :value="f.value" :label="f.label"/></el-select><p class="help">提取计费约定后，在结果页填写计费基数并继续计算。</p></section>
      <PromptPanel v-for="stage in stages" v-show="tool!=='bidding'||stage.key===biddingMode" :key="tool+stage.key+String(editorGeneration)+String(draft.sourceTaskId||'')+(tool==='prepaid'?draft.config.feeTypes[0]||'':'')" v-model="draft.prompts[stage.key]" :tool="tool" :stage="stage.key" :expense-type="tool==='prepaid'?draft.config.feeTypes[0]:undefined" :label="stage.label+'提示词'" @loaded="promptLoaded($event,stage.key)"/>
      <section v-if="tool==='risk'" class="form-section"><h3>检查方式</h3><el-radio-group v-model="draft.config.riskMode"><el-radio value="byFile">按资料检查</el-radio><el-radio value="byRisk">按风险点检查</el-radio></el-radio-group><p class="help">{{draft.config.riskMode==='byFile'?'每份资料检查全部已选风险点。':'针对每个风险点，逐份检查已选资料。'}}</p></section>
      <RulePicker v-if="tool==='risk'" :items="activeRules" v-model="draft.config.riskPoints" label="风险点"/>
      <ContractRules v-if="tool==='contract'&&draft.config.contractCategory!=='auto'" :items="activeRules" :config="draft.config"/>
      <RulePicker variant="table" v-if="tool==='bidding'&&draft.config.analysisModes.length" :items="activeRules" :model-value="draft.config.modeRules[biddingMode]||[]" @update:model-value="draft.config.modeRules[biddingMode]=$event" label="检查规则"/>
      <section v-if="tool==='meeting'" class="form-section"><h3>议题聚类</h3><label class="field-label">议题相似度</label><el-slider v-model="draft.config.similarityThreshold" :min="0" :max="100" :format-tooltip="(v:number)=>v+'%'"/><p class="help">{{draft.config.similarityThreshold}}% · 越高，归为同一类的议题越相近。</p><label class="field-label">每类最少议题数</label><el-input-number v-model="draft.config.minClusterSize" :min="2" :max="100"/></section>
      <TableSettings v-if="tool==='engineering'||tool==='association'" :draft="draft"/>
     </template>
    </div><footer v-if="errors.length" class="submit-footer"><div class="validation-errors" role="alert"><p v-for="err in errors" :key="err">{{err}}</p></div></footer></section>
  </div>
  <MaterialPicker v-model="filePicker" :selected="selectedForPicker" :multiple="!associationRole" :extensions="['engineering','association'].includes(tool)?['xlsx','xls','csv']:undefined" @confirm="added"/>
  <AttachmentDialog v-model="attachmentsOpen" :file="attachmentFile" :attachments="draft.attachments[attachmentFile?.id||'']||[]" :candidates="draft.files" @confirm="attachmentConfirmed"/>
  <el-dialog v-model="previewDialog" title="查看原文" width="1100px" append-to-body><div style="height:70dvh"><SourcePreview :file="previewFile" :step="false"/></div></el-dialog>
  <el-dialog v-model="confirmOpen" :title="'确认'+definition.name" width="540px" :close-on-click-modal="false"><p class="confirm-summary">本次使用 <strong class="number">{{files.length}}</strong> 份资料<span v-if="tool==='extract'">，提取 <strong class="number">{{draft.config.fields.length}}</strong> 个字段</span>。</p><label class="field-label">分析名称</label><el-input v-model="draft.name" maxlength="120" aria-label="分析名称"/><p class="help" style="margin-top:14px">提交后可在当前页面查看进度与结果，也可从“分析记录”返回。</p><template #footer><el-button :disabled="submitting" @click="confirmOpen=false">返回修改</el-button><el-button type="primary" :loading="submitting" :disabled="!draft.name.trim()" @click="submit">确认提交</el-button></template></el-dialog>
 </div>
</template>
<style scoped>

.tool-page{height:100%;display:flex;flex-direction:column;container-type:inline-size}
.tool-heading{display:flex;align-items:center;gap:10px;min-width:0}.tool-heading h1{white-space:nowrap}
.workspace{display:grid;gap:6px;flex:1;min-height:0;background:#edf1f7}
.workspace.three{grid-template-columns:minmax(260px,min(34%,var(--left-width))) minmax(0,1fr) minmax(280px,min(34%,var(--right-width)))}
.workspace.two{grid-template-columns:360px minmax(0,1fr)}.workspace.bidding-workspace{grid-template-columns:420px minmax(0,1fr)}
.workspace>section,.workspace>aside{position:relative;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:0;border-radius:0}
.panel-heading{padding:6px 12px;min-height:46px;height:46px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #e6ebf1;flex:none}.panel-heading h2{font-size:16px}.panel-heading .el-button{padding:5px 10px;min-height:32px;font-size:14px}
.panel-heading .material-add{font-size:16px;font-weight:600;padding:5px 12px}
.selection-guide{padding:10px 12px 8px;font-size:14px;color:#596b80}.file-search{padding:0 12px 10px}.selected-list{padding:0 8px}
.selected-file{display:flex;align-items:center;min-width:0;gap:2px;padding:2px 4px;border-radius:5px}.selected-file.active{background:#eef4ff}.file-open{display:flex;gap:7px;align-items:center;flex:1;min-width:0;padding:7px 3px;border:0;background:none;color:#1e3046;text-align:left;font-size:16px}.file-open span:last-child{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.file-open .el-icon{flex:none;color:#6280a4}.selected-file.active .file-open{color:#245ec5}.selected-file .icon-button{position:relative;width:28px}.selected-file sup{position:absolute;right:0;top:0;font-size:14px;line-height:16px;color:#245ec5;background:#eef4ff}
.selection-total{padding:10px 12px;border-top:1px solid #e6ebf1;background:#fff;font-size:14px;flex:none}.selection-total strong{font-size:18px;color:#245ec5;margin:0 3px}
.file-pagination{padding:8px 12px;font-size:14px;color:#596b80;display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e6ebf1}
.config-content{padding:14px}.submit-footer{border-top:1px solid #e6ebf1;padding:10px 14px;background:#fff}.validation-errors{max-height:140px;overflow:auto;font-size:14px;color:#a33e3e}.validation-errors p{margin:4px 0}
.panel-tabs{display:none;padding:6px 12px;background:#fff;border-bottom:1px solid #e6ebf1}
.association-materials{padding:0 14px}.table-role{border:1px solid #e6ebf1;border-radius:8px;padding:14px;margin:16px 0}.table-role .muted{font-size:14px;margin:6px 0 14px;word-break:break-all}.table-file{margin-top:10px;border:0;background:transparent;color:#245ec5;padding:0;text-align:left}
.reanalysis-note{background:#eef4ff;color:#245ec5;padding:7px 18px;font-size:14px}.confirm-summary{margin-bottom:12px}.two .config-content{max-width:100%}.source :deep(.source-preview){height:100%;border:0;border-radius:0}
@container(max-width:1099px){.workspace.two,.workspace.bidding-workspace{grid-template-columns:320px minmax(0,1fr)}}
@container(max-width:999px){.panel-resizer{display:none}.panel-tabs{display:block}.workspace.three,.workspace.two,.workspace.bidding-workspace{grid-template-columns:280px minmax(0,1fr)}.three .source,.three .configuration{display:none}.three .source.selected-panel,.three .configuration.selected-panel{display:flex}.three.show-materials .configuration{display:flex}}
@container(max-width:619px){.workspace.three,.workspace.two,.workspace.bidding-workspace{display:flex;gap:0}.workspace>aside,.workspace>section,.three.show-materials .configuration{display:none;flex:1}.workspace>.selected-panel{display:flex!important}.page-heading{gap:8px}.tool-heading{gap:0}.tool-heading :deep(.tool-glyph){display:none}.page-heading h1{font-size:16px}.page-heading .el-button{font-size:14px;padding:6px 9px}.page-heading .el-button.is-text{padding:6px;min-width:28px}.page-heading .el-button--primary{font-size:16px}.page-heading .actions{gap:6px}.panel-tabs :deep(.el-radio-button__inner){padding:9px 12px;font-size:14px}.section-title .step{display:none}}
@container(max-width:379px){.page-heading{height:auto;min-height:56px;flex-wrap:wrap}.page-heading .actions{margin-left:auto}}
.bidding-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.bidding-mode-card{border:1px solid #e6ebf1;border-radius:7px;padding:10px;background:#fff;display:flex;flex-direction:column;gap:6px;min-width:0}.bidding-mode-card.active{border-color:#8aaceb;background:#f5f8ff}.bidding-mode-card .el-checkbox{margin:0;align-items:flex-start;font-weight:600}.bidding-mode-card :deep(.el-checkbox__input){margin-top:5px}.bidding-mode-card :deep(.el-checkbox__label){padding-left:7px;line-height:1.5}.bidding-mode-card>.el-button{display:flex;justify-content:space-between;font-size:14px;min-height:26px}.mode-rule-count{margin-left:auto;padding:0 4px;background:#eef4ff;border-radius:3px;font-variant-numeric:tabular-nums}
</style>
