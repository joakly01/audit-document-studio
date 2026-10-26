'use strict';
// Mirrors AttachmentSelectDialog: append links from selected files / opened folder,
// without replacing the main extraction scope or granting directory edit rights.
const eaBase={modalContent,handleAction,closeModal};
function eaPreparing(){return state.view==='tool'&&!currentTask()&&!['engineering','association','bidding'].includes(state.toolId);}
function eaCandidates(p=modalData){
 const main=file(p.id),excluded=new Set([p.id,...raAttachmentIds(main)]),scope=p.scope;
 const ids=[...ws().ids,...(scope?inDirectory(scope.space,scope.path,false).map(d=>d.id):[])];
 return selectedDocs([...new Set(ids)]).filter(d=>!excluded.has(d.id)&&libReady(d)&&auditFileAccess(d).analyze);
}
function eaShown(p=modalData){return eaCandidates(p).filter(d=>!p.query||d.name.toLowerCase().includes(p.query.trim().toLowerCase()));}
function eaPaint(){const top=$('.ea-table-scroll')?.scrollTop||0;paintModal();const table=$('.ea-table-scroll');if(table)table.scrollTop=top;}
modalContent=function(){
 if(modal!=='ef-select-attachments')return eaBase.modalContent();
 const p=modalData,docs=eaShown(p),size=10,pages=Math.max(1,Math.ceil(docs.length/size));p.page=Math.max(1,Math.min(p.page,pages));const rows=pageItems(docs,p.page,size),selected=new Set(p.selected),all=rows.length&&rows.every(d=>selected.has(d.id));requestAnimationFrame(()=>{if(modal==='ef-select-attachments'&&modalData===p){const check=$('[data-ea-change=page]');if(check)check.indeterminate=rows.some(d=>selected.has(d.id))&&!all;}});
 return modalFrame('选择附件',E(file(p.id)?.name||''),'<p class="ea-hint">从已添加资料'+(p.scope?'或已打开文件夹':'')+'中选择解析完成的文件；主文件和已关联附件不重复列出。</p><div class="ea-toolbar"><div class="search">'+I('search','icon-sm')+'<input id="ea-query" data-ea-input="query" aria-label="搜索附件文件名" placeholder="搜索文件名" value="'+E(p.query)+'"></div><span>已选 <strong>'+p.selected.length+'</strong> / '+eaCandidates(p).length+'</span>'+B('选择全部页（'+docs.length+'）','ea-all','ghost sm',docs.length?'':'disabled')+'</div><div class="ea-table-scroll"><table class="table ea-table"><thead><tr><th><label><input type="checkbox" data-ea-change="page" aria-label="选择本页附件" '+(all?'checked':'')+' '+(!rows.length?'disabled':'')+'>本页</label></th><th>文件名称</th><th>位置</th></tr></thead><tbody>'+rows.map(d=>'<tr data-ea-file="'+E(d.id)+'"><td><input type="checkbox" data-ea-change="file" data-id="'+E(d.id)+'" aria-label="关联 '+E(d.name)+'" '+(selected.has(d.id)?'checked':'')+'></td><td><label class="ea-name" title="'+E(d.name)+'">'+ficon(d)+E(d.name)+'</label></td><td><span title="'+E(ewPath(d))+'">'+E(ewPath(d))+'</span></td></tr>').join('')+(!docs.length?'<tr><td colspan="3"><div class="ew-empty-small">'+(p.query?'没有匹配的附件。':'暂无可关联文件，请先添加补充资料，或打开对应文件夹。')+'</div></td></tr>':'')+'</tbody></table></div><div class="ea-pagination"><span>'+p.page+' / '+pages+' 页 · '+docs.length+' 份</span><div class="row">'+B('上一页','ea-prev','sm',p.page<=1?'disabled':'')+B('下一页','ea-next','sm',p.page>=pages?'disabled':'')+'</div></div><p class="error" id="ea-error" role="alert">'+E(p.error||'')+'</p>',B('取消','close-modal')+B('确认关联'+(p.selected.length?' '+p.selected.length+' 份':''),'ea-confirm','primary',p.selected.length?'':'disabled'),'ea-dialog');
};
handleAction=function(action,el){
 if(eaPreparing()&&action==='pick-attachment'){
  const id=el.dataset.id;if(!efCanLink(file(id)))return toast('当前没有关联此文件附件的权限。');
  openModal('ef-select-attachments',{id,back:structuredClone(modalData),scope:state.toolId==='extract'&&efView.attachmentScope?structuredClone(efView.attachmentScope):null,selected:[],query:'',page:1,error:''});return;
 }
 if(eaPreparing()&&action==='unlink-attachment'&&!efCanLink(file(el.dataset.main)))return toast('当前没有修改附件关联的权限。');
 if(modal==='ef-select-attachments'){
  const p=modalData;
  if(action==='ea-all'){p.selected=[...new Set([...p.selected,...eaShown(p).map(d=>d.id)])];eaPaint();return;}
  if(action==='ea-prev'||action==='ea-next'){p.page+=action==='ea-next'?1:-1;eaPaint();$('.ea-table-scroll').scrollTop=0;return;}
  if(action==='ea-confirm'){
   if(!efCanLink(file(p.id))){p.error='权限或任务状态已变化，不能修改附件关联。';eaPaint();return;}
   const available=new Set(eaCandidates(p).map(d=>d.id));
   if(!p.selected.length||p.selected.some(id=>!available.has(id))){p.error='部分文件的解析状态、权限或可选范围已变化，请重新选择。';p.selected=p.selected.filter(id=>available.has(id));eaPaint();return;}
   const d=file(p.id);raSetAttachmentIds(d,[...raAttachmentIds(d),...p.selected]);persist();openModal('attachments',p.back);render();paintModal();toast('已关联 '+p.selected.length+' 份附件，本次主文件范围保持不变。');return;
  }
 }
 return eaBase.handleAction(action,el);
};
closeModal=function(){if(modal==='ef-select-attachments'){const back=modalData.back;openModal('attachments',back);return;}const refresh=modal==='attachments'&&eaPreparing(),result=eaBase.closeModal();if(refresh&&!modal)render();return result;};
window.addEventListener('input',e=>{if(modal!=='ef-select-attachments'||e.target.dataset.eaInput!=='query')return;e.stopImmediatePropagation();const caret=e.target.selectionStart;modalData.query=e.target.value;modalData.page=1;eaPaint();const input=$('#ea-query');input?.focus();input?.setSelectionRange(caret,caret);},true);
window.addEventListener('change',e=>{if(modal!=='ef-select-attachments'||!e.target.dataset.eaChange)return;e.stopImmediatePropagation();const p=modalData,ids=e.target.dataset.eaChange==='page'?pageItems(eaShown(p),p.page,10).map(d=>d.id):[e.target.dataset.id],valid=new Set(eaCandidates(p).map(d=>d.id)),scope=new Set(ids);p.selected=e.target.checked?[...new Set([...p.selected,...ids.filter(id=>valid.has(id))])]:p.selected.filter(id=>!scope.has(id));p.error='';eaPaint();},true);
document.addEventListener('click',e=>{const row=e.target.closest('[data-ea-file]');if(modal!=='ef-select-attachments'||!row||e.target.closest('input,button,a'))return;row.querySelector('input')?.click();});
render();
