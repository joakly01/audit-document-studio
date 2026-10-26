'use strict';
// Review returned findings alongside their real source documents. No task data
// is rewritten; moving between findings follows the result's existing filters.
const ieBase={modalContent,handleAction,closeModal,previewAlive};
let ieSession=null;
const IE_SCROLLS=['.cw-result-table-scroll','.cw-results','.bua-table-scroll','.bua-findings','.bua-report'];
function ieTask(){return ieSession&&state.view==='tool'&&currentTask()?.id===ieSession.taskId?currentTask():null;}
function ieRow(task,index){
 if(!task)return null;
 if(task.toolId==='contract'){const row=cwNormalize(task).find(r=>r.index===index);return row&&cwReadable(row)?row:null;}
 if(task.toolId==='bidding'){const raw=task.result?.[index];return raw&&buaReadable(task,raw)?buaRow(task,raw,index):null;}
 return null;
}
function ieSources(task,row){return task.toolId==='contract'?row.refs:buaSources(task,row.raw);}
function ieCurrent(){const task=ieTask(),row=ieRow(task,ieSession?.index);return row?{task,row,sources:ieSources(task,row)}:null;}
function ieSaveScroll(){return IE_SCROLLS.map(selector=>({selector,top:$(selector)?.scrollTop||0,left:$(selector)?.scrollLeft||0}));}
function ieRestoreScroll(saved){requestAnimationFrame(()=>saved.forEach(({selector,top,left})=>{const el=$(selector);if(el){el.scrollTop=top;el.scrollLeft=left;}}));}
function ieOpen(index,focusEvidence=false){
 const task=currentTask();if(!task||!['contract','bidding'].includes(task.toolId))return;
 const row=ieRow(task,index);if(!row)return toast('关联资料或权限已变化，当前无法查看此条结果。');
 const rows=task.toolId==='contract'?cwFiltered(task):buaFiltered(task),indices=rows.map(r=>r.index);
 // Report links can point outside the active table filter. In that case review
 // only this finding, rather than silently changing the user's table filters.
 ieSession={taskId:task.id,toolId:task.toolId,index,filtered:indices.includes(index),indices:indices.includes(index)?indices:[index],
  sourceId:null,tab:'finding',mobile:'finding',focusEvidence,
  scroll:ieSaveScroll()};
 ieShow();
}
function ieShow(preferredSource){
 const readingScroll=preferredSource?$('#ie-result-body')?.scrollTop||0:0;
 const current=ieCurrent();if(!current){previewRelease();return openModal('source',{ieReview:true,id:null});}
 const {task,row,sources}=current,previewable=sources.filter(id=>auditFileAccess(file(id)).preview);
 ieSession.sourceId=previewable.includes(preferredSource)?preferredSource:previewable.includes(ieSession.sourceId)?ieSession.sourceId:previewable[0]||null;
 previewRelease();openModal('source',{id:ieSession.sourceId,ieReview:true,ieTaskId:task.id,rawPage:1,rawZoom:'fit'});
 if(preferredSource)requestAnimationFrame(()=>{const body=$('#ie-result-body');if(body)body.scrollTop=readingScroll;});
 else if(ieSession.focusEvidence)requestAnimationFrame(()=>$('#ie-all-evidence')?.scrollIntoView({block:'start'}));
}
function ieOriginalBody(type,index){
 const previousModal=modal,previousData=modalData;
 try{modal=type;modalData={index};const root=document.createElement('div');root.innerHTML=ieBase.modalContent();
  const body=root.querySelector('.modalbody');if(!body)return '';
  // Source selection is consolidated into the review toolbar; all analytical
  // content, evidence cards, explanations and metadata stay intact.
  body.querySelectorAll('.cw-evidence-section,.bua-detail-section').forEach(section=>{
   const title=section.querySelector('h3')?.textContent.trim();if(['核验来源','打开来源文件'].includes(title))section.remove();
  });
  return body.innerHTML;
 }finally{modal=previousModal;modalData=previousData;}
}
function ieFindingBody(task,row){
 const detail=ieOriginalBody(task.toolId==='contract'?'cw-result-detail':'bua-detail',row.index);
 if(task.toolId==='contract')return detail;
 return detail+'<details id="ie-all-evidence" class="ie-all-evidence" '+(ieSession.focusEvidence?'open':'')+'><summary>全部证据与补充信息</summary>'+ieOriginalBody('bua-evidence',row.index)+'</details>';
}
function ieToolbar(task,row,sources){
 const previewable=sources.filter(id=>auditFileAccess(file(id)).preview),missing=sources.length-previewable.length;
 return '<div class="ie-source-toolbar"><label><span>来源文件</span><select data-ie-change="source" aria-label="切换核验来源" '+(!previewable.length?'disabled':'')+'>'+(previewable.length?previewable.map(id=>'<option value="'+E(id)+'" '+(id===ieSession.sourceId?'selected':'')+'>'+E(file(id)?.name||'来源文件')+'</option>').join(''):'<option>暂无可预览来源</option>')+'</select></label><span class="ie-source-count">'+sources.length+' 份来源'+(missing?' · '+missing+' 份无预览权限':'')+'</span></div>';
}
function ieReviewModal(){
 const current=ieCurrent();if(!current)return modalFrame('关联资料不可查看','','<div class="ie-unavailable"><h3>无法继续显示本条结果</h3><p>关联资料或权限已变化，请返回结果列表重新选择。</p></div>',B('返回结果','close-modal','primary'),'medium');
 const {task,row,sources}=current,d=file(ieSession.sourceId),allowed=d&&sources.includes(d.id)&&auditFileAccess(d).preview;
 let root=document.createElement('div');
 if(allowed){root.innerHTML=ieBase.modalContent();}
 else root.innerHTML=modalFrame('原文核验','','<div class="file-preview-split"><section class="file-preview-pane" aria-label="原始文件"><div class="file-preview-pane-head"><h3>原始文件</h3></div><div id="preview-raw-content" class="file-preview-pane-content">'+previewMessage('暂无可预览的原文件','可核对右侧实际返回的分析内容。')+'</div></section><section class="file-preview-pane"></section></div>','','file-preview-dialog',true);
 const dialog=root.querySelector('.modal');dialog.classList.add('ie-review-dialog');dialog.dataset.ieMobile=ieSession.mobile;
 const heading=dialog.querySelector('.modalhead>div');heading.innerHTML='<h2 id="dialog-title">核对依据 · '+E(row.title)+'</h2><p>'+E(task.toolId==='bidding'?row.project+' · '+BUA_MODES[row.mode]:file(row.doc)?.name||'合同检查结果')+'</p>';
 const body=dialog.querySelector('.modalbody');body.insertAdjacentHTML('afterbegin',ieToolbar(task,row,sources)+'<nav class="ie-mobile-tabs" aria-label="核验内容">'+[['finding','检查结果'],['original','原始文件']].map(([key,label])=>B(label,'ie-mobile',ieSession.mobile===key?'active':'','data-tab="'+key+'"')).join('')+'</nav>');
 const panes=dialog.querySelectorAll('.file-preview-pane'),left=panes[0],right=panes[1];left.classList.add('ie-original-pane');right.classList.add('ie-finding-pane');
 left.setAttribute('aria-label','来源原文');right.setAttribute('aria-label','检查结果与依据');
 right.innerHTML='<div class="file-preview-pane-head"><h3>检查结果与依据</h3><div class="ie-content-tabs">'+[['finding','检查结果'],['parsed','解析正文']].map(([key,label])=>'<button class="'+(ieSession.tab===key?'active':'')+'" data-action="ie-content" data-tab="'+key+'">'+label+'</button>').join('')+'</div></div><div class="file-preview-pane-content ie-result-body" id="ie-result-body" '+(ieSession.tab!=='finding'?'hidden':'')+'>'+ieFindingBody(task,row)+'</div><div class="file-preview-pane-content" id="preview-parsed-content" '+(ieSession.tab!=='parsed'?'hidden':'')+'>'+(allowed?previewParsedMarkup(d):previewMessage('暂无解析正文','请在来源文件中选择可查看的文件。'))+'</div>';
 const indices=ieSession.indices.filter(index=>ieRow(task,index)),position=indices.indexOf(ieSession.index);
 const foot='<span class="ie-position">'+(ieSession.filtered?'当前筛选内':'本条结果')+' <strong>'+(position+1)+'</strong> / '+indices.length+' 条</span><div class="row">'+B('上一条','ie-prev','sm',position<=0?'disabled':'')+B('下一条','ie-next','sm',position<0||position>=indices.length-1?'disabled':'')+(allowed?B('下载原文件','preview-download-original','sm','disabled'):'')+B('返回结果','close-modal','primary sm')+'</div>';
 let footer=dialog.querySelector('.modalfoot');if(!footer){footer=document.createElement('footer');footer.className='modalfoot';dialog.append(footer);}footer.classList.add('ie-review-footer');footer.innerHTML=foot;
 return root.innerHTML;
}
modalContent=function(){return modal==='source'&&modalData.ieReview?ieReviewModal():ieBase.modalContent();};
previewAlive=function(session){return (!session.data.ieReview||!!ieCurrent())&&ieBase.previewAlive(session);};
handleAction=function(action,el){
 const d=el?.dataset||{},task=currentTask();
 if(task?.toolId==='contract'&&['cw-result-detail','result-detail'].includes(action))return ieOpen(Number(d.index));
 if(task?.toolId==='bidding'&&['bua-detail','bua-evidence'].includes(action))return ieOpen(Number(d.index),action==='bua-evidence');
 if(modal==='source'&&modalData.ieReview){
  if(action.startsWith('preview-')&&!ieCurrent())return ieShow();
  if(action==='ie-prev'||action==='ie-next'){
   const current=ieCurrent();if(!current)return ieShow();
   const indices=ieSession.indices.filter(index=>ieRow(current.task,index)),position=indices.indexOf(ieSession.index),index=indices[position+(action==='ie-next'?1:-1)];
   if(index===undefined)return;ieSession.index=index;ieSession.sourceId=null;ieSession.tab='finding';return ieShow();
  }
  if(action==='ie-mobile'){ieSession.mobile=d.tab==='original'?'original':'finding';const dialog=$('.ie-review-dialog');if(dialog){dialog.dataset.ieMobile=ieSession.mobile;dialog.querySelectorAll('[data-action="ie-mobile"]').forEach(n=>n.classList.toggle('active',n.dataset.tab===ieSession.mobile));}return;}
  if(action==='ie-content'){
   if(!ieCurrent())return ieShow();ieSession.tab=d.tab==='parsed'?'parsed':'finding';const finding=$('#ie-result-body'),parsed=$('#preview-parsed-content');if(finding)finding.hidden=ieSession.tab!=='finding';if(parsed)parsed.hidden=ieSession.tab!=='parsed';$$('[data-action="ie-content"]').forEach(n=>n.classList.toggle('active',n.dataset.tab===ieSession.tab));return;
  }
  if(action==='preview-refresh-parsed'){if(!ieCurrent())return ieShow();}
 }
 return ieBase.handleAction(action,el);
};
closeModal=function(){const saved=modal==='source'&&modalData.ieReview?ieSession?.scroll:null,value=ieBase.closeModal();if(saved){ieSession=null;ieRestoreScroll(saved);}return value;};
window.addEventListener('change',e=>{if(modal!=='source'||!modalData.ieReview||e.target.dataset.ieChange!=='source')return;e.stopImmediatePropagation();const current=ieCurrent();if(!current)return ieShow();const id=e.target.value;if(!current.sources.includes(id)||!auditFileAccess(file(id)).preview)return ieShow();ieShow(id);},true);
window.addEventListener('toggle',e=>{if(ieSession&&modal==='source'&&modalData.ieReview&&e.target.id==='ie-all-evidence')ieSession.focusEvidence=e.target.open;},true);
render();
