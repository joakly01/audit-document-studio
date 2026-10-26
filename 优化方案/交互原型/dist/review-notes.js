'use strict';
// Human review is an optional annotation, separate from the immutable AI output.
const qrBase={modalContent,handleAction};
const QR_KEY='audit-studio-review-notes-v1';
let qrNotes={};
try{const saved=JSON.parse(localStorage.getItem(QR_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))qrNotes=saved;}catch{}
const qrDrafts=new Map();
let qrTargets=[];
function qrCanonical(value){if(Array.isArray(value))return '['+value.map(qrCanonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+qrCanonical(value[k])).join(',')+'}';return JSON.stringify(value)??'null';}
function qrDigest(text){let a=2166136261,b=2246822507,c=3266489909,d=668265263;for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b^n,3266489909);c=Math.imul(c^n,668265263);d=Math.imul(d^n,374761393);}return [a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');}
function qrReadableSource(id,ability='read'){const seen=new Set();let d=file(id);while(d){const access=auditFileAccess(d);if(seen.has(d.id)||!access.read||!access[ability])return false;seen.add(d.id);if(!d.refSourceId)return true;d=file(d.refSourceId);}return false;}
function qrTarget(task,raw,label,refs,selector,kind){
 const allowed=new Set([...(task.ids||[]),...Object.values(task.attachments||{}).flat()]);
 refs=[...new Set(refs.filter(Boolean))];
 if(!refs.length||refs.some(id=>!allowed.has(id)||!qrReadableSource(id)))return null;
 const fingerprint=qrDigest(qrCanonical({raw,refs:[...refs].sort(),kind}));
 const reviewerId=state.libraryIdentity?.id||'current-user',reviewerName=state.libraryIdentity?.name||'当前用户';
 return {key:task.id+':'+reviewerId+':'+kind+':'+fingerprint,taskId:task.id,fingerprint,tool:task.toolId,label,refs,selector,kind,reviewerId,reviewerName};
}
function qrCollect(){
 if(modal!=='source')return [];const p=modalData;
 if(p.ieReview&&typeof ieCurrent==='function'){
  const current=ieCurrent();if(!current)return [];
  const {task,row,sources}=current;
  return [qrTarget(task,row.raw||row,row.title,sources,'#ie-result-body','finding')].filter(Boolean);
 }
 if(p.extractionTaskId){
  const task=state.tasks.find(t=>t.id===p.extractionTaskId),row=task?.result?.find(r=>r.doc===p.id);
  if(!row||!auditFileAccess(file(p.id)).read)return [];
  // Use original provenance before ewItems redacts inaccessible field content.
  // A hidden source must never become a new main-file-only review target.
  return ewItems(task,row).map((field,index)=>{const raw=Array.isArray(row.items)?row.items[index]:field,refs=[p.id,raw.source_id||raw.source_file_id||p.id,...(raw.evidence_list||[]).flatMap(e=>e&&typeof e==='object'?[e.source_file_id,e.source_id,e.file_uuid,e.document_id].filter(Boolean):[])];return qrTarget(task,raw,field.name,refs,'#ew-review-field-'+index,'field');}).filter(Boolean);
 }
 if(p.analysisTaskId){
  const task=state.tasks.find(t=>t.id===p.analysisTaskId);if(!task)return [];
  const row=task.toolId==='word'?task.result?.find(r=>r.word===p.word):task.result?.[p.index]||task.result?.find(r=>r.doc===p.id);
  if(!row)return [];
  return [qrTarget(task,{row,source:p.id},row.check||row.topicName||row.word||row.title||'分析内容',task.toolId==='word'?[p.id]:[p.id,...(row.refs||[])],'#aw-review-content','analysis')].filter(Boolean);
 }
 return [];
}
function qrSaved(target){const entry=qrNotes[target.key];return entry?.fingerprint===target.fingerprint?entry:null;}
function qrMarkup(target){
 const saved=qrSaved(target),draft=qrDrafts.get(target.key)||saved||{status:'',note:''},name={checked:'已核对',question:'存疑'}[saved?.status];
 return '<details class="qr-note" data-qr-key="'+E(target.key)+'"><summary>核验意见 <span>'+E(name||'选填')+'</span></summary><div class="qr-note-body"><div class="qr-note-fields"><label>核验标记<select data-qr-input="status" aria-label="'+E(target.label)+'的核验标记"><option value="">未标记</option><option value="checked" '+(draft.status==='checked'?'selected':'')+'>已核对</option><option value="question" '+(draft.status==='question'?'selected':'')+'>存疑</option></select></label><label>说明<textarea data-qr-input="note" rows="2" maxlength="1000" aria-label="'+E(target.label)+'的核验说明" placeholder="记录核对情况或需要补充核查的问题">'+E(draft.note||'')+'</textarea></label></div><div class="qr-note-actions"><span class="qr-save-state" role="status">'+(saved?'保存于 '+E(new Date(saved.updatedAt).toLocaleString('zh-CN')):'不影响原始分析结果')+'</span>'+B('保存意见','qr-save','soft sm','data-key="'+E(target.key)+'"')+(saved?B('导出记录','qr-export','ghost sm','data-key="'+E(target.key)+'" '+(target.refs.every(id=>qrReadableSource(id,'download'))?'':'disabled')):'')+'</div></div></details>';
}
modalContent=function(){
 const html=qrBase.modalContent();qrTargets=qrCollect();if(!qrTargets.length)return html;
 const root=document.createElement('div');root.innerHTML=html;
 for(const target of qrTargets)root.querySelector(target.selector)?.insertAdjacentHTML('beforeend',qrMarkup(target));
 return root.innerHTML;
};
function qrLive(key){return qrCollect().find(target=>target.key===key);}
function qrUpdateCard(target){const old=[...document.querySelectorAll('.qr-note')].find(n=>n.dataset.qrKey===target.key);if(!old)return;const open=old.open,container=document.createElement('div');container.innerHTML=qrMarkup(target);container.firstElementChild.open=open;old.replaceWith(container.firstElementChild);}
function qrReadDraft(card){return {status:card.querySelector('[data-qr-input="status"]').value,note:card.querySelector('[data-qr-input="note"]').value};}
handleAction=function(action,el){
 if(action==='confirm-reset'){try{localStorage.removeItem(QR_KEY);}catch{}qrNotes={};qrDrafts.clear();}
 if(action!=='qr-save'&&action!=='qr-export')return qrBase.handleAction(action,el);
 const target=qrLive(el.dataset.key);if(!target)return toast('资料或分析结果已变化，请重新打开后核对。');
 if(action==='qr-save'){
  const card=el.closest('.qr-note');if(!card)return;const draft=qrReadDraft(card);
  if(draft.status&&!['checked','question'].includes(draft.status))return;
  if(!draft.status&&draft.note.trim())return toast('请先选择“已核对”或“存疑”。');
  const next={...qrNotes};if(!draft.status)delete next[target.key];else next[target.key]={taskId:target.taskId,tool:target.tool,label:target.label,fingerprint:target.fingerprint,reviewerId:target.reviewerId,reviewerName:target.reviewerName,status:draft.status,note:draft.note.trim().slice(0,1000),updatedAt:new Date().toISOString()};
  try{localStorage.setItem(QR_KEY,JSON.stringify(next));qrNotes=next;qrDrafts.delete(target.key);qrUpdateCard(target);toast(draft.status?'核验意见已保存。':'核验标记已清除。');}catch{toast('核验意见未能保存，请检查浏览器可用存储后重试。');}
  return;
 }
 const saved=qrSaved(target),task=state.tasks.find(t=>t.id===target.taskId);
 if(!saved||!task||target.refs.some(id=>!qrReadableSource(id,'download')))return toast('当前无法导出这条核验记录。');
 download((task.name||'分析')+'-核验记录.json',JSON.stringify({analysis_name:task.name,analysis_id:task.id,tool:tool(target.tool).name,item:target.label,review_status:saved.status==='checked'?'已核对':'存疑',review_note:saved.note,reviewer:saved.reviewerName,saved_at:saved.updatedAt,source_files:target.refs.map(id=>file(id)?.name)},null,2),'application/json;charset=utf-8');
};
window.addEventListener('input',e=>{const card=e.target.closest('.qr-note');if(!card||!e.target.dataset.qrInput)return;e.stopImmediatePropagation();qrDrafts.set(card.dataset.qrKey,qrReadDraft(card));const status=card.querySelector('.qr-save-state');if(status)status.textContent='尚未保存';},true);
window.addEventListener('change',e=>{const card=e.target.closest('.qr-note');if(!card||!e.target.dataset.qrInput)return;e.stopImmediatePropagation();qrDrafts.set(card.dataset.qrKey,qrReadDraft(card));const status=card.querySelector('.qr-save-state');if(status)status.textContent='尚未保存';},true);
render();
