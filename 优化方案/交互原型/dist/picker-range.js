'use strict';
const pickerRangeBase={pickerModal,handleAction,paintModal,pickerItems};
function pickerExtractScope(){return state.view==='tool'&&TOOLS.some(t=>t.id===state.toolId)&&!modalData.table&&!modalData.main&&!modalData.v6TextSearch&&!modalData.libraryTextSearch;}
function pickerScopeMarkup(root,p){const scope=root.querySelector('.picker-center [data-v3-change="picker-scope"]');if(scope){scope.hidden=true;scope.tabIndex=-1;if(p.table){const bar=root.querySelector('.picker-center>.selectionbar');bar?.classList.add('directory-file-toolbar');bar?.insertAdjacentHTML('afterbegin',rangeScopeMarkup(!!p.recursive,'picker'));const count=bar?.querySelector(':scope>span');if(count)count.textContent=count.textContent.replace('含子文件夹','当前文件夹及子文件夹').replace('仅本级','当前文件夹');}}}
function pickerRangeEligible(d){return !!d&&!d.deleted&&!d.local&&auditFileAccess(d).read&&(!pickerExtractScope()||libReady(d)&&auditFileAccess(d).analyze&&!libEligible(d,state.toolId));}
pickerItems=function(){const items=pickerRangeBase.pickerItems();if(!pickerExtractScope())return items;const p=modalData;return [...items.filter(i=>i.kind==='folder'),...inDirectory(p.space,p.folder,!!p.recursive,p.query||'').filter(d=>!d.deleted&&auditFileAccess(d).read).map(file=>({kind:'file',file}))];};
const pickerRangePageSize=7; // Shared with the mixed folder/file picker, including folder rows.
function pickerRangeContext(){
 const p=modalData,items=pickerItems(),eligible=item=>item.kind==='file'&&pickerRangeEligible(item.file);
 const all=items.filter(eligible).map(item=>item.file.id),page=pageItems(items,p.page,pickerRangePageSize).filter(eligible).map(item=>item.file.id),selected=new Set(p.selected||[]),scope=new Set(all);
 return{all,page,chosen:all.filter(id=>selected.has(id)),pageChosen:page.filter(id=>selected.has(id)),outside:[...selected].filter(id=>!scope.has(id)).length};
}
pickerModal=function(){
 const html=pickerRangeBase.pickerModal(),p=modalData;if(p.table){const root=document.createElement('div');root.innerHTML=html;pickerScopeMarkup(root,p);return root.innerHTML;}
 const root=document.createElement('div');root.innerHTML=html;root.querySelectorAll('[data-action="picker-directory"],[data-action="v3-picker-range"]').forEach(n=>{const separator=n.previousSibling;if(separator?.nodeType===Node.TEXT_NODE&&separator.textContent.trim()==='·')separator.remove();n.remove();});const c=pickerRangeContext(),all=c.all.length>0&&c.chosen.length===c.all.length,pageAll=c.page.length>0&&c.pageChosen.length===c.page.length;
 pickerScopeMarkup(root,p);const center=root.querySelector('.picker-center');if(center){center.dataset.rangePage=p.page;center.dataset.rangeScope=JSON.stringify([p.space,p.folder,p.recursive,p.query]);}
 if(pickerExtractScope()){
  root.querySelector('.modalhead h2')?.insertAdjacentHTML('beforeend','<span class="picker-ready-inline">仅解析完成可选</span>');
  root.querySelectorAll('[data-change="picker-check"]').forEach(input=>{const d=file(input.dataset.id),allowed=pickerRangeEligible(d),row=input.closest('tr');input.disabled=!allowed;input.checked=allowed&&p.selected.includes(d.id);input.toggleAttribute('checked',input.checked);if(row){row.classList.toggle('picker-unavailable',!allowed);row.title=allowed?'':!libReady(d)?'仅解析完成的资料可选；当前状态：'+libStatus(d):libEligible(d,state.toolId)||'当前没有此文件的分析权限';if(row.children[2])row.children[2].innerHTML=libStatusTag(d);}});
  const note=document.createElement('p');note.className='picker-ready-note';note.setAttribute('role','note');note.textContent='仅可选择解析完成、类型受支持且有分析权限的资料；未解析完成的资料请先查看上传记录。';root.querySelector('.picker-center>.browser-toolbar')?.after(note);
  const count=root.querySelector('.picker-center>.selectionbar>span');if(count)count.innerHTML='可选 <strong>'+c.all.length+'</strong> / '+pickerItems().filter(i=>i.kind==='file').length+' 份 · '+(p.recursive?'当前文件夹及子文件夹':'当前文件夹');
 }
 const check=root.querySelector('[data-change="picker-page"]');
 if(check){
  const label=document.createElement('label');label.className='range-page-label';check.replaceWith(label);label.append(check,document.createTextNode('本页'));
  check.checked=pageAll;check.toggleAttribute('checked',pageAll);check.disabled=!c.page.length;check.setAttribute('aria-label','选择本页可选文件，不含文件夹');check.title='只选择或取消当前页，不影响其他页面和目录的已选文件';
  check.setAttribute('aria-checked',c.pageChosen.length&&!pageAll?'mixed':String(pageAll));
 }
 const bar=root.querySelector('.picker-center>.selectionbar');
 if(bar){bar.className='selectionbar range-selection-bar picker-range-selection range-table-top directory-file-toolbar';bar.innerHTML=rangeScopeMarkup(!!p.recursive,'picker')+'<span class="range-selected-description" role="status">'+(!all&&c.chosen.length?(pageAll?'已选本页 <strong>'+c.page.length+'</strong> 份':'当前范围已选 <strong>'+c.chosen.length+'</strong> / '+c.all.length+' 份'):'')+'</span><div class="range-selection-actions">'+A(all?'已选全部页（'+c.all.length+' 份）':'选择全部页（'+c.all.length+' 份）','picker-all','title="选择当前目录、搜索和子文件夹范围下全部页的可选文件" '+(!c.all.length||all?'disabled':''))+(all&&c.all.length>c.page.length?A('仅保留本页','picker-range-keep-page','title="其他范围的已选资料保留"'):'')+(c.chosen.length?A('取消本范围选择','picker-range-clear','title="其他范围的已选资料保留"'):'')+'</div>';}

 const footer=root.querySelector('.modalfoot>.grow');if(footer)footer.textContent=p.main?'确认后更新关联附件。':'确认后更新本次资料；取消保留原选择。';
 requestAnimationFrame(()=>{if(modal!=='picker'||modalData!==p)return;const el=$('[data-change="picker-page"]');if(el)el.indeterminate=c.pageChosen.length>0&&c.pageChosen.length<c.page.length;});
 return root.innerHTML;
};
paintModal=function(focus=false){
 const previous=modal==='picker'?$('.picker-center'):null,scope=previous?.dataset.rangeScope,page=previous?.dataset.rangePage;
 const positions=previous&&!focus?['.modalbody','.picker-left','.picker-center','.picker-center>.mixed-table','.picker-right'].map(selector=>{const node=$(selector);return{selector,top:node?.scrollTop||0,left:node?.scrollLeft||0};}):[];
 pickerRangeBase.paintModal(focus);
 if(modal!=='picker')return;const next=$('.picker-center');
 for(const pos of positions){const node=$(pos.selector);if(!node)continue;node.scrollTop=pos.selector==='.picker-center>.mixed-table'&&(scope!==next?.dataset.rangeScope||page!==next?.dataset.rangePage)?0:pos.top;node.scrollLeft=pos.left;}
};
handleAction=function(action,el){
 if(modal==='picker'&&pickerExtractScope()&&action==='confirm-picker'){
  const invalid=(modalData.selected||[]).filter(id=>!pickerRangeEligible(file(id)));
  if(invalid.length){modalData.selected=modalData.selected.filter(id=>pickerRangeEligible(file(id)));paintModal();toast('有 '+invalid.length+' 份资料未解析完成或权限已变化，已取消选择，请核对后重新确认。');return;}
 }
 if(modal==='picker'&&['picker-all','picker-range-keep-page','picker-range-clear'].includes(action)){
  if(modalData.table)return;
  const c=pickerRangeContext(),scope=new Set(c.all),keep=action==='picker-range-keep-page'?new Set(c.page):new Set();
  modalData.selected=action==='picker-all'?[...new Set([...modalData.selected,...c.all])]:modalData.selected.filter(id=>!scope.has(id)||keep.has(id));
  paintModal();return;
 }
 return pickerRangeBase.handleAction(action,el);
};
window.addEventListener('change',event=>{
 const el=event.target;if(modal==='picker'&&el.dataset.change==='picker-check'&&el.checked&&pickerExtractScope()&&!pickerRangeEligible(file(el.dataset.id))){event.stopImmediatePropagation();el.checked=false;toast('仅可选择解析完成且有提取权限的资料。');return;}if(modal!=='picker'||el.dataset.change!=='picker-page')return;
 event.stopImmediatePropagation();if(modalData.table)return;
 const ids=pickerRangeContext().page,scope=new Set(ids);
 modalData.selected=el.checked?[...new Set([...modalData.selected,...ids])]:modalData.selected.filter(id=>!scope.has(id));paintModal();
},true);
