'use strict';
// Align preparation surfaces; retain original configuration, execution and result handlers.
const twBase={workbench,configPanel,render,handleAction,modalContent,nav,route,openTask,run,newAnalysis,isLocked,closeModal};
const TW_IDS=TOOLS.map(t=>t.id).filter(id=>id!=='extract');
const TW_META={
 word:['添加资料','设置统计规则','设置停用词、新词和展示词数，生成词云与词频表。'],
 theme:['添加资料','设置主题归纳提示词','分别选择资料要点和主题归纳提示词。'],
 timeline:['添加资料','设置事项提取提示词','选择事项提取提示词，明确提取哪些日期和事项。'],
 risk:['添加资料','设置风险分析内容','选择本次要检查的风险点，设置检查要求和遍历顺序。'],
 meeting:['添加资料','设置会议分析提示词','选择会议分析提示词，按需调整议题聚类。'],
 contract:['添加合同','设置检查规则','选择合同类别与检查规则，按需合并关联附件分析。'],
 bidding:['添加项目资料','设置检查内容','明确项目、招标资料与投标单位，再选择招标、投标或联合分析。'],
 prepaid:['添加合同','设置计费要求','先提取计费约定，核对后填写计费基数并计算费用。'],
 engineering:['添加台账','设置比较规则','分别设置重复项目和主子项目的字段、预筛与评分规则。'],
 association:['选择对照表','设置关联规则','对应两表字段后设置预筛、评分、硬规则和比较上限。']
};
const twViews={};
let twAttachmentReturn=null;
function tv(id=state.toolId){return twViews[id]??={query:'',closed:[],tab:'original',panel:'materials',preview:null};}
function twActive(){return state.view==='tool'&&TW_IDS.includes(state.toolId);}
function twPreparing(){return twActive()&&!currentTask();}
function twDocs(){return selectedDocs(currentTask()?.ids||ws().ids);}
function twHeading(n,label,extra=''){return '<div class="ew-panel-head tw-panel-head"><h2><span class="tw-step">Step '+n+'</span>'+label+'</h2>'+extra+'</div>';}
function twFile(d,extra=''){
 return '<div class="tw-file '+(ws().preview===d.id?'active':'')+'">'+ficon(d)+'<button class="tw-file-name" data-action="tw-preview" data-id="'+E(d.id)+'" title="'+E(d.name)+'">'+E(d.name)+'</button>'+extra+'</div>';
}
function twTree(docs,path='',depth=0){
 const v=tv(),paths=[...new Set(docs.flatMap(d=>folderPath(d.folder).split('/').filter(Boolean).map((_,i)=>folderPath(d.folder).split('/').slice(0,i+1).join('/'))))];
 return paths.filter(p=>p.split('/').slice(0,-1).join('/')===path).map(p=>{const space=docs[0]?.space,key=space+'::'+p,closed=v.closed.includes(key)&&!v.query;return '<div class="tw-folder" style="--depth:'+depth+'"><button data-action="tw-folder" data-key="'+E(key)+'" aria-expanded="'+!closed+'" title="'+E(p)+'">'+I(closed?'chevron':'down','icon-sm')+I('folder','icon-sm')+'<span>'+E(folderName(p))+'</span><small>'+docs.filter(d=>underFolder(d.folder,p)).length+'</small></button></div>'+(!closed?twTree(docs,p,depth+1):'');}).join('')+docs.filter(d=>folderPath(d.folder)===path).map(d=>'<div style="--depth:'+depth+'" class="tw-tree-row">'+twFile(d,(!['engineering','association'].includes(state.toolId)?B(I('paperclip','icon-sm'),'attachments','ghost sm tw-icon','data-id="'+E(d.id)+'" title="管理关联附件" aria-label="关联 '+E(d.name)+' 的附件"'):'')+B(I('close','icon-sm'),'tw-remove','ghost sm tw-icon','data-id="'+E(d.id)+'" title="仅移出本次分析，不删除原文件" aria-label="移出 '+E(d.name)+'"'))+'</div>').join('');
}
function twBidGroups(docs=twDocs()){
 const keep=new Set(docs.map(d=>d.id)),pick=ids=>selectedDocs(ids).filter(d=>keep.has(d.id)),w=ws();return (pick(w.unassigned||[]).length?'<div class="tw-role-group"><h3>待指定项目与角色 <strong>'+w.unassigned.length+'</strong></h3>'+pick(w.unassigned).map(d=>twFile(d,B(I('edit','icon-sm'),'assign-bid','ghost sm tw-icon','data-id="'+E(d.id)+'" title="指定项目与文件角色" aria-label="指定 '+E(d.name)+' 的项目与角色"'))).join('')+'</div>':'')+w.projects.filter(p=>pick(p.tender).length||p.bidders.some(b=>pick(b.files).length)).map(p=>'<section class="tw-role-group"><h3>'+E(p.name||'未命名项目')+'</h3><h4>招标资料 <strong>'+p.tender.length+'</strong></h4>'+pick(p.tender).map(d=>twFile(d)).join('')+p.bidders.filter(b=>pick(b.files).length).map(b=>'<h4>投标单位 · '+E(b.name||'未命名单位')+' <strong>'+b.files.length+'</strong></h4>'+pick(b.files).map(d=>twFile(d)).join('')).join('')+'</section>').join('');
}
function twTables(){const w=ws();return ['A','B'].map((slot,i)=>{const d=file(w['table'+slot]);return '<section class="tw-table-slot"><h3>表'+(i?'二':'一')+'</h3><label>业务名称<input data-work="table'+slot+'Name" aria-label="表'+slot+'业务名称" value="'+E(w['table'+slot+'Name'])+'"></label>'+(d?twFile(d):'<p>选择需要比较的 Excel 或 CSV 台账。</p>')+'<div class="row">'+B(d?'更换台账':'选择台账','pick-table','soft sm','data-slot="'+slot+'"')+(d?B('移出','remove-table','ghost sm','data-slot="'+slot+'"'):'')+'</div></section>';}).join('')+'<p class="tw-note">两张表不能相同。预览按页读取，核验时保留来源行与列。</p>';}
function twMaterials(){
 const id=state.toolId,v=tv(),docs=twDocs(),matched=docs.filter(d=>(d.name+' '+ewPath(d)).toLowerCase().includes(v.query.toLowerCase())),shown=id!=='association'&&typeof wnWindow==='function'?wnWindow(matched,v.query):matched;
 return '<aside class="ew-materials tw-materials" aria-label="Step 1 '+TW_META[id][0]+'">'+twHeading(1,id==='association'?'选择对照表':B(I('plus','icon-sm')+'添加资料','add-tool-materials','soft sm','aria-label="'+TW_META[id][0]+'"'))+'<p class="tw-intro">'+(id==='association'?'分别指定两张台账，保留各自的业务含义。':id==='bidding'?'添加资料后，请明确项目、文件角色和投标单位。':'点击“添加资料”选择文件，下方为已选资料。')+'</p>'+(id==='association'?'':(id==='bidding'?'<div class="tw-group-action">'+B(I('settings','icon-sm')+'管理项目与单位','tw-bid-groups','w100 sm')+'</div>':'<div class="ew-material-controls"><div class="search">'+I('search','icon-sm')+'<input id="tw-tree-query" data-tw-input="query" aria-label="查找本次资料" placeholder="查找已添加的文件或目录" value="'+E(v.query)+'"></div></div>'))+'<div class="tw-tree">'+(id==='association'?twTables():id==='bidding'?twBidGroups(shown):SPACE_ORDER.filter(s=>shown.some(d=>d.space===s)).map(s=>'<div class="ew-space">'+E(s)+'</div>'+twTree(shown.filter(d=>d.space===s))).join(''))+(!docs.length&&id!=='association'&&id!=='bidding'?'<div class="tw-empty-small">点击上方“添加资料”，选择本次需要分析的文件。</div>':!shown.length&&docs.length&&id!=='association'&&id!=='bidding'?'<div class="tw-empty-small">没有匹配资料，查找不改变分析范围。</div>':'')+'</div>'+(id!=='association'&&typeof wnMaterialPager==='function'?wnMaterialPager(): '')+'<div class="ew-scope-note">已选 <strong>'+docs.length+'</strong> 份资料'+(id==='association'?' · 按两表字段比较':id==='bidding'?' · 按项目与角色分析':'')+'</div></aside>';
}
function twPreview(){const d=file(ws().preview),v=tv(),allowed=d&&auditFileAccess(d).preview;return '<section class="ef-preview tw-preview" aria-label="Step 2 查看原文">'+twHeading(2,'查看原文',d?B(I('expand','icon-sm'),'source','ghost sm tw-icon','data-id="'+E(d.id)+'" aria-label="对照查看原文件与解析内容" title="对照查看原文件与解析内容"'):'')+(d?'<div class="ef-preview-caption"><div><strong title="'+E(d.name)+'">'+E(d.name)+'</strong></div><div class="ef-preview-tabs" role="tablist" aria-label="预览内容">'+[['original','原文件'],['parsed','解析文本']].map(([key,label])=>'<button role="tab" aria-selected="'+(v.tab===key)+'" class="'+(v.tab===key?'active':'')+'" data-action="tw-preview-tab" data-tab="'+key+'">'+label+'</button>').join('')+'</div></div><div class="ef-preview-content" id="ef-raw-content" '+(v.tab!=='original'?'hidden':'')+'>'+previewMessage(allowed?'正在打开原文件':'无预览权限','可根据需要查看原文，不影响分析范围。')+'</div><div class="ef-preview-content" id="tw-parsed-content" '+(v.tab!=='parsed'?'hidden':'')+'>'+(allowed?previewParsedMarkup(d):previewMessage('无预览权限','请联系资料管理员。'))+'</div>':'<div class="ef-empty"><span class="ef-empty-symbol">'+I('file')+'</span><h2>添加资料后，可在这里查看原文</h2><p>'+E(TW_META[state.toolId][2])+'</p><p class="tw-note">左侧全部资料参与分析；查看原文为可选操作。</p></div>')+'</section>';}
configPanel=function(){
 if(!twActive())return twBase.configPanel();
 const root=document.createElement('div');root.innerHTML=twBase.configPanel();const panel=root.querySelector('aside');if(!panel)return root.innerHTML;
 if(currentTask())return root.innerHTML;
 // Existing controls retain their original data handlers and parameter contracts.
 const head=panel.querySelector(':scope>.ew-panel-head,:scope>.row.between');head?.remove();
 panel.classList.add('tw-config','ew-config');panel.setAttribute('aria-label','Step 3 '+TW_META[state.toolId][1]);
 panel.insertAdjacentHTML('afterbegin',twHeading(3,TW_META[state.toolId][1]));
 const body=panel.querySelector(':scope>.ew-config-body')||document.createElement('div');
 if(!body.parentNode){body.className='ew-config-body';[...panel.children].filter(n=>!n.classList.contains('tw-panel-head')).forEach(n=>body.append(n));panel.append(body);}
 body.querySelector('.ew-config-scope')?.remove();body.insertAdjacentHTML('afterbegin','<p class="tw-intro">'+E(TW_META[state.toolId][2])+'</p>');
 body.querySelectorAll('[data-action="nav-templates"]').forEach(n=>n.remove());
 if(!AW_IDS.includes(state.toolId)){
  // Each stage already has its own prompt editor; avoid a second generic prompt entry.
  body.querySelectorAll('.config-toolbar [data-action="prompt"]').forEach(n=>n.remove());
  body.querySelectorAll('[data-action="save-template"]').forEach(n=>{n.textContent='另存为个人方案';n.classList.add('tw-save-as');});
 }
 if(state.toolId==='association'){
  const g=currentConfig().association;body.insertAdjacentHTML('beforeend','<section class="config-section"><div class="row between"><h3>字段与关联规则</h3>'+B('配置','v2-association','soft sm')+'</div><p>已配置 <strong>'+g.rows.length+'</strong> 个比较字段</p><p class="hint">完全一致 > '+g.full+' 分；部分一致 ≥ '+g.partial+' 分。硬规则 '+g.hardRules.length+' 项。</p><p class="hint">'+(g.mode==='batch'?'批量模式：每行最多 '+g.perRow+' 对，全局最多 '+g.total+' 对。':'标准模式')+'</p></section>');
 }
 return root.innerHTML;
};
function twHeader(){const t=tool(state.toolId);return '<header class="aw-commandbar tw-commandbar work-commandbar"><div class="aw-heading"><span class="tool-symbol" style="--tool-color:'+toolColor[t.id]+'">'+I(t.icon)+'</span><h1>'+E(t.name)+'</h1></div><div class="aw-command-actions tw-command-actions">'+B(I('tasks','icon-sm')+'任务中心','nav-tasks','sm')+B(I('play','icon-sm')+(t.id==='prepaid'?'提取计费约定':'开始分析'),'run','primary sm',twDocs().length?'':'disabled')+'</div></header>';}
workbench=function(){
 if(!twActive()||currentTask())return twBase.workbench();
 const w=ws(),docs=twDocs(),v=tv();if(!docs.some(d=>d.id===w.preview))w.preview=docs[0]?.id||null;
 return '<div class="ew-workspace tw-workspace ef-preparing">'+twHeader()+'<nav class="tw-mobile-tabs" aria-label="分析工作区">'+[['materials',(state.toolId==='association'?'对照表':'已选资料')+' '+twDocs().length],['preview','查看原文'],['config',TW_META[state.toolId][1]]].map(([key,label])=>B(label,'tw-panel',v.panel===key?'active':'','data-panel="'+key+'"')).join('')+'</nav><div class="ew-grid tw-grid" data-tw-panel="'+v.panel+'">'+twMaterials()+'<main class="ew-center aw-center">'+twPreview()+'</main>'+configPanel()+'</div></div>';
};
function twMountPreview(){if(!twPreparing()||modal==='source')return;const d=file(ws().preview),v=tv();if(!d||!auditFileAccess(d).preview)return;if(!v.preview||v.preview.id!==d.id)v.preview={id:d.id,toolId:state.toolId,inline:true,rawPage:1,rawZoom:'fit'};if(activeFilePreview?.data!==v.preview)previewEnsure(v.preview);}
render=function(){
 const v=twActive()?tv():null,oldRoot=twPreparing()?$('#ef-raw-content'):null,session=activeFilePreview;
 const keep=oldRoot&&session?.data.toolId===state.toolId&&session.id===ws().preview&&auditFileAccess(file(ws().preview)).preview;
 const scroll=$('.tw-config>.ew-config-body')?.scrollTop||0,tree=$('.tw-tree')?.scrollTop||0;
 // The extraction layer releases inline sessions; detach this tool's session while it renders.
 if(keep){oldRoot.remove();activeFilePreview=null;}
 twBase.render();
 if(keep){const root=$('#ef-raw-content');if(root&&twPreparing()&&ws().preview===session.id){root.replaceWith(oldRoot);activeFilePreview=session;}else{activeFilePreview=session;previewRelease();}}
 if(twPreparing()){
  const root=$('#ef-raw-content');if(root)root.hidden=tv().tab!=='original';
  const body=$('.tw-config>.ew-config-body');if(body)body.scrollTop=scroll;const list=$('.tw-tree');if(list)list.scrollTop=tree;
  twMountPreview();
 }
};
modalContent=function(){
 if(modal==='attachments'&&twActive()){
  const d=file(modalData.id||ws().preview||twDocs()[0]?.id),task=currentTask();if(!d)return modalFrame('关联附件','','请先添加一份主文件。',B('关闭','close-modal'),'small');
  const ids=raAttachmentIds(d,task),docs=selectedDocs(ids).filter(d=>auditFileAccess(d).read),editable=!task&&efCanLink(d);
  return modalFrame('关联附件',E(d.name),'<p class="hint">'+(task?'本次执行时的附件快照，只读保留。':state.toolId==='contract'?'是否将附件合并分析，请在右侧配置中设置。解除关联不删除原文件。':'从已添加资料中选择补充文件，附件关联不会改变本次主文件范围。')+'</p><div class="ew-attachments-table">'+(docs.length?simpleTable(['附件名称','位置','操作'],docs.map(a=>[E(a.name),E(ewPath(a)),(auditFileAccess(a).preview?A('查看原文','source','data-id="'+E(a.id)+'"'):'<span class="hint">无原文查看权限</span>')+(editable?' '+A('移除关联','unlink-attachment','data-main="'+E(d.id)+'" data-id="'+E(a.id)+'"'):'')]),true):'<div class="ew-empty-small">暂无可查看的关联附件。</div>')+'</div>',B('关闭','close-modal')+(editable?B(I('plus','icon-sm')+'关联已有资料','pick-attachment','primary','data-id="'+E(d.id)+'"'):''),'medium');
 }
 if(modal==='tw-bid-groups'){const root=document.createElement('div');root.innerHTML=biddingPreparation();root.querySelectorAll('[data-action="sample"]').forEach(n=>n.remove());return modalFrame('管理项目与投标单位','按实际业务指定文件归属；同一项目内的招标资料与各投标单位分别管理。',root.innerHTML,B('完成','close-modal','primary'),'tw-bid-dialog');}
 if(modal==='tw-submit'){const c=ws().config;return modalFrame(state.toolId==='prepaid'?'提取计费约定':'确认开始分析','本次全部 '+twDocs().length+' 份资料使用右侧配置；提交后可在任务中心查看进度和结果。','<label class="field">任务名称<input id="tw-task-name" maxlength="100" value="'+E(c.taskName||tool(state.toolId).name+' · '+new Date().toLocaleDateString('zh-CN'))+'"></label><label class="field">任务备注（选填）<textarea id="tw-task-notes" rows="3">'+E(c.taskNotes||'')+'</textarea></label><label class="field">提交后去向<select id="tw-execution"><option value="1">当前页面查看进度</option><option value="2">前往任务中心跟踪</option></select></label><p id="tw-submit-error" class="error" role="alert"></p>',B('取消','close-modal')+B('确认开始','tw-submit-confirm','primary'),'medium');}
 return twBase.modalContent();
};
closeModal=function(){
 if(modal==='source'&&twAttachmentReturn&&twActive()){
  const back=twAttachmentReturn;twAttachmentReturn=null;twBase.closeModal();openModal('attachments',back);return;
 }
 return twBase.closeModal();
};
handleAction=function(action,el){
 // Removing a historical record must not turn its snapshot into the editable draft.
 if(action==='confirm-delete-task')for(const [id,w] of Object.entries(state.work)){if(TW_IDS.includes(id)&&w.taskId===el.dataset.id){const draft=structuredClone(w.preparationDraft||twEmptyDraft(id));state.work[id]={...draft,taskId:null,tab:'preview',preparationDraft:structuredClone(draft)};}}
 if(twActive()&&currentTask()&&['pick-attachment','unlink-attachment'].includes(action))return toast('历史附件只读，请通过“再次分析”修改。');
 if(twActive()&&action==='source'&&modal==='attachments')twAttachmentReturn=structuredClone(modalData);
 if(twPreparing()){
  const v=tv(),w=ws();
  if(action==='preview'||action==='tw-preview'){if(!w.ids.includes(el.dataset.id))return;w.preview=el.dataset.id;v.panel='preview';render();return;}
  if(action==='tw-preview-tab'){v.tab=el.dataset.tab;$('#ef-raw-content').hidden=v.tab!=='original';$('#tw-parsed-content').hidden=v.tab!=='parsed';$$('.tw-preview [data-action="tw-preview-tab"]').forEach(n=>{const active=n.dataset.tab===v.tab;n.classList.toggle('active',active);n.setAttribute('aria-selected',String(active));});if(v.tab==='original')twMountPreview();return;}
  if(action==='tw-folder'){const key=el.dataset.key;v.closed=v.closed.includes(key)?v.closed.filter(k=>k!==key):[...v.closed,key];render();return;}
  if(action==='tw-panel'){v.panel=el.dataset.panel;render();return;}
  if(action==='tw-remove'){const id=el.dataset.id,index=w.ids.indexOf(id);if(index<0)return;w.ids.splice(index,1);render();toast('已移出本次分析，原文件保留。',()=>{if(!w.ids.includes(id))w.ids.splice(index,0,id);render();});return;}
  if(action==='tw-bid-groups'){openModal('tw-bid-groups');return;}
  if(action==='source'&&activeFilePreview?.data.inline)previewRelease();
  if(action==='run'&&!AW_IDS.includes(state.toolId)){const errors=validate(false);if(errors.length)return toast(errors[0]);openModal('tw-submit');return;}
  if(action==='tw-submit-confirm'&&modal==='tw-submit'){
   const name=$('#tw-task-name').value.trim();if(!name){$('#tw-submit-error').textContent='请填写任务名称。';return;}
   const errors=validate(false);if(errors.length){$('#tw-submit-error').textContent=errors.join('；');return;}
   w.config.taskName=name;w.config.taskNotes=$('#tw-task-notes').value.trim();const execution=+$('#tw-execution').value;w.config.executionMode=execution;closeModal();run();if(execution===2)nav('tasks');return;
  }
 }
 if(action==='open-tool'&&TW_IDS.includes(el.dataset.id))twRestoreDraft(el.dataset.id);
 return twBase.handleAction(action,el);
};
window.addEventListener('input',e=>{if(!twPreparing()||e.target.dataset.twInput!=='query')return;e.stopImmediatePropagation();const input=e.target,caret=input.selectionStart;tv().query=input.value;render();const next=$('#tw-tree-query');next?.focus();next?.setSelectionRange(caret,caret);},true);
// Every tool has an editable preparation entry and an explicit, immutable historical result URL.
let twHistoryId=null;
function twSaveDraft(id=state.toolId){const w=state.work[id];if(!w||w.taskId)return;const {preparationDraft,...draft}=w;w.preparationDraft=structuredClone(draft);}
function twEmptyDraft(id){const previous=state.work[id];try{delete state.work[id];return structuredClone(ws(id));}finally{if(previous)state.work[id]=previous;else delete state.work[id];}}
function twRestoreDraft(id){const w=ws(id);if(w.taskId){const draft=structuredClone(w.preparationDraft||twEmptyDraft(id));state.work[id]={...draft,taskId:null,tab:'preview',preparationDraft:structuredClone(draft)};}tv(id).panel='materials';}
nav=function(view,id){const target=id||state.toolId;if(view==='tool'&&TW_IDS.includes(target)&&!twHistoryId)twRestoreDraft(target);twBase.nav(view,id);if(view==='tool'&&TW_IDS.includes(target)&&twHistoryId)history.replaceState(history.state,'','#tool/'+target+'/'+encodeURIComponent(twHistoryId));};
openTask=function(id){const task=state.tasks.find(t=>t.id===id),target=task&&!tcMerge(task)&&tcResolve(task);if(!TW_IDS.includes(target))return twBase.openTask(id);twSaveDraft(target);const previous=twHistoryId;twHistoryId=id;try{return twBase.openTask(id);}finally{twHistoryId=previous;}};
run=function(retry){if(!TW_IDS.includes(state.toolId))return twBase.run(retry);if(!retry)twSaveDraft();const result=twBase.run(retry),task=currentTask();if(task&&state.view==='tool')history.replaceState(history.state,'','#tool/'+state.toolId+'/'+encodeURIComponent(task.id));return result;};
newAnalysis=function(){const result=twBase.newAnalysis();if(TW_IDS.includes(state.toolId)&&!currentTask()){tv().panel='materials';history.replaceState(history.state,'','#tool/'+state.toolId);twSaveDraft();}return result;};
isLocked=function(){return twActive()&&currentTask()?true:twBase.isLocked();};
window.removeEventListener('hashchange',twBase.route);
route=function(){const [view,id,encoded,entryMode]=(location.hash.slice(1)||'library').split('/');if(view==='tool'&&TW_IDS.includes(id)){let taskId='';try{taskId=decodeURIComponent(encoded||'');}catch{}const task=state.tasks.find(t=>t.id===taskId&&!tcMerge(t)&&tcResolve(t)===id);if(task){if(ws(id).taskId!==task.id){openTask(task.id);if(['config','download'].includes(entryMode)){history.replaceState(history.state,'','#tool/'+id+'/'+encodeURIComponent(task.id)+'/'+entryMode);render();}return;}}else{twRestoreDraft(id);if(encoded)history.replaceState(history.state,'','#tool/'+id);}}twBase.route();};
window.addEventListener('hashchange',route);
route();
