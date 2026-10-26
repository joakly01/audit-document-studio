'use strict';
// Reuse files explicitly. A source task never becomes an editable target draft.
const mrBase={modalContent,handleAction,closeModal,libHandoff};
const MR_PAGE_SIZE=10;
function mrResolve(id,target=state.toolId){
 let d=file(id),seen=new Set();
 while(d){
  if(seen.has(d.id)||d.deleted)return {id:null,reason:'原资料已移除'};
  seen.add(d.id);const p=auditFileAccess(d);
  if(!p.read)return {id:null,reason:'没有查看权限'};
  if(!libReady(d))return {id:null,reason:libStatus(d)};
  if(!p.analyze)return {id:null,reason:'没有分析权限'};
  const issue=libEligible(d,target);if(issue)return {id:null,reason:issue};
  if(!d.refSourceId)return {id:d.id,reason:''};
  d=file(d.refSourceId);
 }
 return {id:null,reason:'原资料已移除'};
}
function mrSplit(ids,target){
 const accepted=[],excluded=[];for(const raw of [...new Set(ids||[])]){const resolved=mrResolve(raw,target);if(resolved.id){if(!accepted.includes(resolved.id))accepted.push(resolved.id);}else excluded.push({raw,reason:resolved.reason});}
 return {accepted,excluded};
}
function mrFileName(id){const d=file(id);return d&&!d.deleted&&auditFileAccess(d).read?d.name:'资料不可查看';}
function mrDraft(id){const w=state.work[id];return w?.taskId?w.preparationDraft||null:w||null;}
function mrFresh(id){const old=state.work[id];try{delete state.work[id];return structuredClone(ws(id));}finally{if(old)state.work[id]=old;else delete state.work[id];}}
function mrExisting(id){const d=mrDraft(id);return [...new Set(d?.ids||[])];}
function mrPickerAllowed(){return modal==='picker'&&state.view==='tool'&&!modalData.main&&!modalData.table&&!modalData.v6TextSearch&&!modalData.libraryTextSearch;}
function mrSingle(p){return !!(p.backPicker?.bid&&p.backPicker.role==='tender');}
function mrTasks(p){const q=(p.recordQuery||'').trim().toLowerCase();return state.tasks.filter(t=>!tcMerge(t)&&tcResolve(t)&&Array.isArray(t.ids)&&t.ids.length&&[t.name,t.notes,tool(tcResolve(t)).name].join(' ').toLowerCase().includes(q)).slice().sort((a,b)=>(Date.parse(b.created)||0)-(Date.parse(a.created)||0));}
function mrRecordRows(p){
 const tasks=mrTasks(p),pages=Math.max(1,Math.ceil(tasks.length/MR_PAGE_SIZE));p.recordPage=Math.max(1,Math.min(p.recordPage||1,pages));
 return '<div class="mr-table-scroll"><table class="mr-table"><thead><tr><th>分析记录</th><th>可选资料</th><th>操作</th></tr></thead><tbody>'+tasks.slice((p.recordPage-1)*MR_PAGE_SIZE,p.recordPage*MR_PAGE_SIZE).map(t=>{const n=mrSplit(t.ids,p.target).accepted.length;return '<tr><td><strong>'+E(t.name||tool(tcResolve(t)).name)+'</strong><small>'+E(tool(tcResolve(t)).name)+' · '+E(tcDate(t.created))+'</small></td><td><strong>'+n+'</strong> / '+t.ids.length+' 份</td><td>'+B('选文件','mr-task','soft sm','data-id="'+E(t.id)+'" '+(n?'':'disabled'))+'</td></tr>';}).join('')+'</tbody></table>'+(!tasks.length?'<p class="mr-empty">没有匹配的分析记录。</p>':'')+'</div>'+mrPager('record',p.recordPage,pages,tasks.length);
}
function mrTaskDocs(p){const t=state.tasks.find(t=>t.id===p.taskId),q=(p.fileQuery||'').trim().toLowerCase(),seen=new Set();return (t?.ids||[]).flatMap(raw=>{const resolved=mrResolve(raw,p.target),key=resolved.id||raw;if(seen.has(key))return [];seen.add(key);return [{raw,id:resolved.id,name:mrFileName(raw),reason:resolved.reason}];}).filter(d=>!q||d.name.toLowerCase().includes(q));}
function mrSelected(p){return [...new Set(p.selected||[])].filter(id=>mrResolve(id,p.target).id===id);}
function mrPageSelection(p){const existing=new Set(p.backPicker.selected||[]),docs=mrTaskDocs(p).slice(((p.filePage||1)-1)*MR_PAGE_SIZE,(p.filePage||1)*MR_PAGE_SIZE).filter(d=>d.id&&!existing.has(d.id)),selected=new Set(mrSelected(p)),chosen=docs.filter(d=>selected.has(d.id)).length;return{total:docs.length,chosen};}
function mrFileRows(p){
 const docs=mrTaskDocs(p),pages=Math.max(1,Math.ceil(docs.length/MR_PAGE_SIZE));p.filePage=Math.max(1,Math.min(p.filePage||1,pages));const shown=docs.slice((p.filePage-1)*MR_PAGE_SIZE,p.filePage*MR_PAGE_SIZE),selected=new Set(mrSelected(p)),existing=new Set(p.backPicker.selected||[]),eligible=shown.filter(d=>d.id&&!existing.has(d.id)),all=eligible.length>0&&eligible.every(d=>selected.has(d.id)),single=mrSingle(p);
 requestAnimationFrame(()=>{if(modal!=='mr-files'||modalData!==p)return;const input=$('[data-mr-change="page"]'),state=mrPageSelection(p);if(input){input.indeterminate=state.chosen>0&&state.chosen<state.total;input.setAttribute('aria-checked',input.indeterminate?'mixed':String(input.checked));}});
 return '<div class="mr-file-selection">'+(!single?'<label><input type="checkbox" data-mr-change="page" '+(all?'checked':'')+' '+(eligible.length?'':'disabled')+' aria-label="选择本页可选文件">本页</label><div>'+A('选择全部页（'+docs.filter(d=>d.id&&!existing.has(d.id)).length+' 份）','mr-select-all')+'</div>':'<span>招标文件仅选 <strong>1</strong> 份；加入后替换当前招标文件选择。</span>')+'</div><div class="mr-table-scroll"><table class="mr-table"><thead><tr><th class="mr-checkbox"></th><th>文件名称</th><th>状态</th></tr></thead><tbody>'+shown.map(d=>{const already=!!d.id&&existing.has(d.id),checked=single?(p.selected[0]||p.backPicker.selected[0])===d.id:already||selected.has(d.id);return '<tr><td><input type="'+(single?'radio':'checkbox')+'" name="mr-file" data-mr-change="file" value="'+E(d.id||d.raw)+'" '+(checked?'checked':'')+' '+(!d.id||!single&&already?'disabled':'')+' aria-label="选择 '+E(d.name)+'"></td><td><strong>'+E(d.name)+'</strong></td><td>'+E(d.reason||(!single&&already?'本次已选':'可添加'))+'</td></tr>';}).join('')+'</tbody></table>'+(!docs.length?'<p class="mr-empty">没有匹配的文件。</p>':'')+'</div>'+mrPager('file',p.filePage,pages,docs.length);
}
function mrPager(kind,page,pages,total){return '<div class="mr-pager"><span>共 <strong>'+total+'</strong> '+(kind==='record'?'条':'份')+'</span><div>'+B('上一页','mr-page','sm','data-kind="'+kind+'" data-step="-1" '+(page<=1?'disabled':''))+'<span>第 '+page+' / '+pages+' 页</span>'+B('下一页','mr-page','sm','data-kind="'+kind+'" data-step="1" '+(page>=pages?'disabled':''))+'</div></div>';}
function mrRecordsModal(p){return modalFrame('从分析记录选资料','选取原分析的主文件，继续使用当前工具的设置。','<div class="search mr-search"><input id="mr-record-query" data-mr-input="record" aria-label="查找分析记录" placeholder="查找分析名称或工具" value="'+E(p.recordQuery||'')+'"></div><div id="mr-record-list" class="mr-list">'+mrRecordRows(p)+'</div><p id="mr-error" class="error" role="alert"></p>',B('返回资料库','mr-cancel')+B('加入本次选择（'+mrSelected(p).length+'）','mr-add','primary',mrSelected(p).length?'':'disabled'),'mr-dialog');}
function mrFilesModal(p){const task=state.tasks.find(t=>t.id===p.taskId);return modalFrame('选择要沿用的资料',E(task?.name||'分析记录'),'<div class="mr-file-heading">'+A('返回分析记录','mr-records-back')+'<span>仅添加文件，不复制原分析的设置和历史附件关联。</span></div><div class="search mr-search"><input id="mr-file-query" data-mr-input="file" aria-label="查找原分析文件" placeholder="查找文件名称" value="'+E(p.fileQuery||'')+'"></div><div id="mr-file-list" class="mr-list">'+mrFileRows(p)+'</div><p id="mr-error" class="error" role="alert"></p>',B('取消','mr-cancel')+B('加入本次选择（'+mrSelected(p).length+'）','mr-add','primary',mrSelected(p).length?'':'disabled'),'mr-dialog');}
function mrOpenRecords(){const backPicker=structuredClone(modalData);openModal('mr-records',{target:state.toolId,backPicker,selected:[],recordQuery:'',recordPage:1,filePage:1});}
function mrReturnPicker(p,add=false){
 const back=structuredClone(p.backPicker);
 if(add){const selected=mrSelected(p);if(!selected.length){const error=$('#mr-error');if(error)error.textContent='所选资料已不可用于本次分析，请重新选择。';return;}back.selected=mrSingle(p)?[selected[0]]:[...new Set([...(back.selected||[]),...selected])];}
 mrBase.closeModal();openModal('picker',back);
}
function mrHandoffList(p){const q=(p.handoffQuery||'').trim().toLowerCase(),rows=(p.incoming||[]).map(raw=>{const d=mrResolve(raw,p.target);return {raw,id:d.id,name:mrFileName(raw),reason:d.reason};}).filter(d=>!q||d.name.toLowerCase().includes(q)),pages=Math.max(1,Math.ceil(rows.length/MR_PAGE_SIZE));p.handoffPage=Math.max(1,Math.min(p.handoffPage||1,pages));return '<div class="mr-table-scroll"><table class="mr-table"><thead><tr><th>本次带入资料</th><th>处理</th></tr></thead><tbody>'+rows.slice((p.handoffPage-1)*MR_PAGE_SIZE,p.handoffPage*MR_PAGE_SIZE).map(d=>'<tr><td>'+E(d.name)+'</td><td>'+E(d.reason||'可带入')+'</td></tr>').join('')+'</tbody></table>'+(!rows.length?'<p class="mr-empty">没有匹配的文件。</p>':'')+'</div>'+mrPager('handoff',p.handoffPage,pages,rows.length);}
function mrHandoffModal(p){
 const split=mrSplit(p.incoming,p.target),existing=mrExisting(p.target),draft=mrDraft(p.target),shared=split.accepted.filter(id=>existing.includes(id)).length,association=p.target==='association';
 const choices=association?[...new Set([...existing,...split.accepted])].filter(id=>mrResolve(id,'association').id===id):[];
 const slots=association?'<div class="mr-table-slots">'+['A','B'].map((slot,i)=>'<label class="field"><span>表'+(i?'二':'一')+'</span><select data-mr-change="slot" data-slot="'+slot+'" aria-label="指定表'+(i?'二':'一')+'"><option value="">请选择台账</option>'+choices.map(id=>'<option value="'+E(id)+'" '+((p['table'+slot]??draft?.['table'+slot]??'')===id?'selected':'')+'>'+E(mrFileName(id))+'</option>').join('')+'</select></label>').join('')+'</div><p class="mr-note">明确指定两张不同台账，未指定的文件不参与比较。原字段配置保留，可在进入工具后核对。</p>':existing.length?'<fieldset class="mr-handoff-modes"><legend>如何使用这些资料</legend><label><input type="radio" name="mr-handoff-mode" value="merge" data-mr-change="handoff-mode" '+(p.mode!=='replace'?'checked':'')+'>加入现有资料<span>保留已有配置与资料分组</span></label><label><input type="radio" name="mr-handoff-mode" value="replace" data-mr-change="handoff-mode" '+(p.mode==='replace'?'checked':'')+'>替换本次资料<span>保留分析设置，仅替换准备中的文件范围</span></label></fieldset>':'';
 return modalFrame('确认带入资料',E(tool(p.target).name),'<div class="mr-handoff-summary"><span>已有 <strong>'+existing.length+'</strong> 份</span><span>本次可带入 <strong>'+split.accepted.length+'</strong> 份</span>'+(shared?'<span>重复 <strong>'+shared+'</strong> 份，自动去重</span>':'')+(split.excluded.length?'<span>不适用 <strong>'+split.excluded.length+'</strong> 份</span>':'')+'</div>'+slots+(p.target==='bidding'?'<p class="mr-note">原项目及文件角色保留；新增资料需在工具中指定项目与角色。</p>':'')+'<details class="mr-handoff-files" '+(split.excluded.length?'open':'')+'><summary>查看本次文件与可用状态</summary><div class="search mr-search"><input id="mr-handoff-query" data-mr-input="handoff" aria-label="查找本次带入文件" placeholder="查找文件名称" value="'+E(p.handoffQuery||'')+'"></div><div id="mr-handoff-list" class="mr-list">'+mrHandoffList(p)+'</div></details><p id="mr-error" class="error" role="alert"></p>',B('取消','close-modal')+B('进入'+tool(p.target).name,'mr-handoff-confirm','primary',split.accepted.length||association&&choices.length?'':'disabled'),'mr-dialog mr-handoff-dialog');
}
function mrApplyHandoff(p){
 const split=mrSplit(p.incoming,p.target);if(!split.accepted.length){if(modal==='mr-handoff')$('#mr-error').textContent='本次所选资料均已不可用于该工具，请返回检查。';else toast('本次所选资料均不可用于该工具。');return;}
 const current=mrDraft(p.target),w=structuredClone(current||mrFresh(p.target)),oldIds=[...new Set(w.ids||[])];
 if(p.target==='association'){
  const a=p.tableA??w.tableA,b=p.tableB??w.tableB,allowed=new Set([...oldIds,...split.accepted].filter(id=>mrResolve(id,'association').id===id));
  if(!a||!b||a===b||!allowed.has(a)||!allowed.has(b)){const error=$('#mr-error');if(error)error.textContent='请明确选择两张不同且可分析的台账。';return;}
  w.tableA=a;w.tableB=b;w.ids=[a,b];
 }else{
  w.ids=p.mode==='replace'?split.accepted:[...new Set([...oldIds,...split.accepted])];
  if(p.target==='bidding'){
   const keep=new Set(w.ids);w.projects=(w.projects||[]).map(project=>({...project,tender:(project.tender||[]).filter(id=>keep.has(id)),bidders:(project.bidders||[]).map(b=>({...b,files:(b.files||[]).filter(id=>keep.has(id))}))}));
   const assigned=new Set(w.projects.flatMap(project=>[...project.tender,...project.bidders.flatMap(b=>b.files)]));w.unassigned=w.ids.filter(id=>!assigned.has(id));
  }
 }
 w.taskId=null;w.tab='preview';w.preview=w.ids.includes(w.preview)?w.preview:w.ids[0]||null;
 if(w.attachmentOverrides)w.attachmentOverrides=Object.fromEntries(Object.entries(w.attachmentOverrides).filter(([id])=>w.ids.includes(id)));
 const {preparationDraft,...draft}=w;w.preparationDraft=structuredClone(draft);state.work[p.target]=w;
 if(modal)mrBase.closeModal();fullResult=false;nav('tool',p.target);persist();toast('已带入资料，请确认本次分析设置。');
}
function mrOpenHandoff(target,incoming){
 if(!TOOLS.some(t=>t.id===target))return;const split=mrSplit(incoming,target),existing=mrExisting(target),p={target,incoming:[...new Set(incoming||[])],mode:'merge',handoffPage:1,handoffQuery:''};
 if(target!=='association'&&!existing.length&&!split.excluded.length&&split.accepted.length)return mrApplyHandoff(p);
 return openModal('mr-handoff',p);
}
libHandoff=function(target,ids){return mrOpenHandoff(target,ids);};
modalContent=function(){
 if(modal==='mr-records')return mrRecordsModal(modalData);if(modal==='mr-files')return mrFilesModal(modalData);if(modal==='mr-handoff')return mrHandoffModal(modalData);
 const html=mrBase.modalContent();if(!mrPickerAllowed())return html;const root=document.createElement('div');root.innerHTML=html;const footer=root.querySelector('.modalfoot>.grow');
 if(footer){footer.classList.add('mr-picker-entry');footer.innerHTML=A('从分析记录选资料','mr-open-records');}else root.querySelector('.modalfoot')?.insertAdjacentHTML('afterbegin','<span class="grow mr-picker-entry">'+A('从分析记录选资料','mr-open-records')+'</span>');return root.innerHTML;
};
closeModal=function(){if(['mr-records','mr-files'].includes(modal))return mrReturnPicker(modalData);return mrBase.closeModal();};
function mrPaint(kind,preserveScroll=true){const p=modalData,node=$('#mr-'+kind+'-list');if(node){const scroll=preserveScroll?node.querySelector('.mr-table-scroll')?.scrollTop||0:0,active=document.activeElement,focus=node.contains(active)?{change:active.dataset.mrChange,value:active.value,action:active.dataset.action,step:active.dataset.step,kind:active.dataset.kind}:null;node.innerHTML=kind==='record'?mrRecordRows(p):kind==='file'?mrFileRows(p):mrHandoffList(p);const list=node.querySelector('.mr-table-scroll');if(list)list.scrollTop=scroll;if(focus){const next=[...node.querySelectorAll('input,button')].find(n=>focus.change?n.dataset.mrChange===focus.change&&n.value===focus.value:n.dataset.action===focus.action&&n.dataset.step===focus.step&&n.dataset.kind===focus.kind);next?.focus({preventScroll:true});}}if(['record','file'].includes(kind)){const button=$('[data-action="mr-add"]'),n=mrSelected(p).length;if(button){button.textContent='加入本次选择（'+n+'）';button.disabled=!n;}}}
handleAction=function(action,el){
 const d=el?.dataset||{};
 if(action==='open-tool'&&state.view==='library'&&state.librarySelected.length)return mrOpenHandoff(d.id,state.librarySelected);
 if(action==='mr-open-records'&&mrPickerAllowed())return mrOpenRecords();
 if(action==='mr-task'&&modal==='mr-records'){modalData.taskId=d.id;modalData.fileQuery='';modalData.filePage=1;return openModal('mr-files',modalData);}
 if(action==='mr-records-back'&&modal==='mr-files')return openModal('mr-records',modalData);
 if(action==='mr-cancel'&&['mr-records','mr-files'].includes(modal))return mrReturnPicker(modalData);
 if(action==='mr-add'&&['mr-records','mr-files'].includes(modal))return mrReturnPicker(modalData,true);
 if(action==='mr-select-all'&&modal==='mr-files'&&!mrSingle(modalData)){const p=modalData,existing=new Set(p.backPicker.selected||[]);p.selected=[...new Set([...p.selected,...mrTaskDocs(p).filter(d=>d.id&&!existing.has(d.id)).map(d=>d.id)])];return mrPaint('file');}
 if(action==='mr-page'&&modal?.startsWith('mr-')){const kind=d.kind,property=kind==='record'?'recordPage':kind==='file'?'filePage':'handoffPage';modalData[property]+=Number(d.step);return mrPaint(kind,false);}
 if(action==='mr-handoff-confirm'&&modal==='mr-handoff')return mrApplyHandoff(modalData);
 return mrBase.handleAction(action,el);
};
window.addEventListener('input',event=>{const el=event.target,kind=el.dataset.mrInput;if(!modal?.startsWith('mr-')||!kind)return;event.stopImmediatePropagation();modalData[kind==='record'?'recordQuery':kind==='file'?'fileQuery':'handoffQuery']=el.value;modalData[kind==='record'?'recordPage':kind==='file'?'filePage':'handoffPage']=1;mrPaint(kind);},true);
window.addEventListener('change',event=>{
 const el=event.target,key=el.dataset.mrChange;if(!modal?.startsWith('mr-')||!key)return;event.stopImmediatePropagation();const p=modalData;
 if(key==='handoff-mode'){p.mode=el.value;return;}if(key==='slot'){p['table'+el.dataset.slot]=el.value;return;}
 if(key==='file'){if(mrResolve(el.value,p.target).id!==el.value)return;const selected=new Set(p.selected);if(mrSingle(p))p.selected=[el.value];else{el.checked?selected.add(el.value):selected.delete(el.value);p.selected=[...selected];}mrPaint('file');return;}
 if(key==='page'){const existing=new Set(p.backPicker.selected||[]),ids=mrTaskDocs(p).slice((p.filePage-1)*MR_PAGE_SIZE,p.filePage*MR_PAGE_SIZE).filter(d=>d.id&&!existing.has(d.id)).map(d=>d.id),selected=new Set(p.selected);ids.forEach(id=>el.checked?selected.add(id):selected.delete(id));p.selected=[...selected];mrPaint('file');}
},true);
render();
