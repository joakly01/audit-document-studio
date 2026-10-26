'use strict';
// Results belong to the tool that produced them. Execution mode and navigation
// are independent; task_switch values keep their original server meaning.
const ufBase={workbench,modalContent,handleAction,nav,toast,tcConfig};
const ufView={tool:null,query:'',status:'all',page:1,size:10};
let ufSubmitStay=false;
let ufRecordsTimer=null;
const UF_SUBMITS={'ew-submit':['ew-execution','ew-submit-confirm'],'aw-submit':['aw-execution','aw-submit-confirm'],'tw-submit':['tw-execution','tw-submit-confirm']};
function ufRecords(id=state.toolId){return state.tasks.filter(t=>!tcMerge(t)&&tcResolve(t)===id).map((t,index)=>({t,index})).sort((a,b)=>(Date.parse(b.t.created)||0)-(Date.parse(a.t.created)||0)||a.index-b.index).map(x=>x.t);}
function ufStatus(t){if(t.calculating)return ['费用计算中','blue'];if(t.summaryGenerating)return ['主题归纳中','blue'];return tcLabel(t);}
function ufAction(t){if(t.status==='queued'||t.status==='running'||t.summaryGenerating)return '查看进度';if(t.status==='awaiting')return t.calculating?'查看计算进度':'继续计算';if(t.status==='failed')return '查看失败原因';if(t.status==='stopped')return '查看已停止任务';if(t.status==='partial')return '查看已完成结果';return '查看结果';}
function ufFailure(t){for(const error of [t.error,t.errorMessage,t.failureMessage]){const message=typeof error==='string'?error:error?.message;if(typeof message==='string'&&message.trim())return message.trim();}return '服务未返回具体原因，可重试失败文件。';}
function ufFiltered(){const q=ufView.query.trim().toLowerCase();return ufRecords(ufView.tool).filter(t=>(ufView.status==='all'||t.status===ufView.status)&&[t.name,t.notes].join(' ').toLowerCase().includes(q));}
function ufRecordList(){const rows=ufFiltered(),pages=Math.max(1,Math.ceil(rows.length/ufView.size));ufView.page=Math.max(1,Math.min(ufView.page,pages));return '<div class="uf-records-scroll"><table class="uf-records-table"><thead><tr><th>分析名称</th><th>状态</th><th>分析成果</th><th>操作</th></tr></thead><tbody>'+rows.slice((ufView.page-1)*ufView.size,ufView.page*ufView.size).map(t=>'<tr data-uf-row="'+E(t.id)+'"><td><strong>'+E(t.name||tool(ufView.tool).name)+'</strong><small>'+E(tcDate(t.created))+'</small>'+(t.notes?'<small class="uf-two-lines">'+E(t.notes)+'</small>':'')+'</td><td>'+tag(...ufStatus(t))+'</td><td><span>'+E(tcOutput(t).text)+'</span><small class="uf-two-lines">'+E(t.status==='failed'?ufFailure(t):tcOutput(t).hint||'')+'</small></td><td>'+B(ufAction(t),'uf-open','soft sm','data-id="'+E(t.id)+'"')+'</td></tr>').join('')+'</tbody></table>'+(!rows.length?'<div class="uf-records-empty">'+(ufView.query||ufView.status!=='all'?'没有匹配的分析记录，请调整查找条件。':'本工具尚无分析记录。添加资料并开始分析后，可直接在当前页查看结果。')+'</div>':'')+'</div><div class="uf-records-pager"><span>共 <strong>'+rows.length+'</strong> 条</span><label>每页 <select data-uf-change="size" aria-label="每页分析记录数">'+[10,20,50].map(n=>'<option value="'+n+'" '+(n===ufView.size?'selected':'')+'>'+n+'</option>').join('')+'</select> 条</label><div>'+B('上一页','uf-page','sm','data-step="-1" '+(ufView.page===1?'disabled':''))+'<span>第 '+ufView.page+' / '+pages+' 页</span>'+B('下一页','uf-page','sm','data-step="1" '+(ufView.page===pages?'disabled':''))+'</div></div>';}
function ufRecordModal(){return modalFrame(E(tool(ufView.tool).name)+' · 分析记录','查看本工具的结果、运行进度，或继续尚未完成的操作。','<div class="uf-records-toolbar"><div class="search">'+I('search','icon-sm')+'<input id="uf-records-query" data-uf-input="query" aria-label="查找本工具分析记录" placeholder="查找分析名称或备注" value="'+E(ufView.query)+'"></div><select data-uf-change="status" aria-label="筛选分析状态">'+[['all','全部状态'],['queued','等待执行'],['running','执行中'],['awaiting','待填计费基数'],['completed','已完成'],['partial','部分完成'],['failed','失败'],['stopped','已停止']].map(([key,n])=>'<option value="'+key+'" '+(ufView.status===key?'selected':'')+'>'+n+'</option>').join('')+'</select>'+B('刷新','uf-refresh','sm')+'</div><div id="uf-records-list" class="uf-records-list">'+ufRecordList()+'</div>',B('关闭','close-modal'),'uf-records-dialog');}
function ufPaintRecords(preserve=false){const node=$('#uf-records-list');if(!node)return;const html=ufRecordList();if(preserve&&node.ufMarkup===html)return;const scroll=preserve?node.querySelector('.uf-records-scroll')?.scrollTop||0:0,active=document.activeElement,row=active?.closest('[data-uf-row]')?.dataset.ufRow,action=active?.dataset.action,step=active?.dataset.step;node.innerHTML=html;node.ufMarkup=html;const next=node.querySelector('.uf-records-scroll');if(next)next.scrollTop=scroll;if(preserve&&node.contains(active)===false&&action){const target=[...node.querySelectorAll('[data-action]')].find(n=>n.dataset.action===action&&(row?n.closest('[data-uf-row]')?.dataset.ufRow===row:n.dataset.step===step));target?.focus({preventScroll:true});}}
function ufWatchRecords(){clearInterval(ufRecordsTimer);ufRecordsTimer=setInterval(()=>{if(modal!=='uf-records'){clearInterval(ufRecordsTimer);ufRecordsTimer=null;return;}ufPaintRecords(true);},1000);}
tcConfig=function(t){const html=ufBase.tcConfig(t),root=document.createElement('div');root.innerHTML=html;const mode=Number(t.executionMode??t.config?.executionMode??t.task_switch??t.taskSwitch);root.querySelectorAll('.tc-config dt').forEach(n=>{if(n.textContent==='执行方式'&&n.nextElementSibling)n.nextElementSibling.textContent=mode===1?'立即执行':mode===2?'排队执行':'未记录';});return root.innerHTML;};
function ufQueued(t){const id=tcResolve(t),meta=tool(id);return '<div class="ew-workspace uf-queued"><header class="aw-commandbar work-commandbar"><div class="aw-heading"><span class="tool-symbol" style="--tool-color:'+toolColor[id]+'">'+I(meta.icon)+'</span><h1>'+E(meta.name)+'</h1></div><div class="aw-command-actions">'+B('分析记录','uf-records','sm')+B('终止任务','tc-stop','sm','data-id="'+E(t.id)+'"')+'</div></header><section class="uf-queue-body"><article class="uf-queue-card">'+tag('等待执行','blue')+'<h2>任务已提交，等待开始分析</h2><p>'+E(t.name)+'</p><p>开始后会在本页更新进度，完成后直接展示分析结果。</p><dl><dt>提交时间</dt><dd>'+E(tcDate(t.created))+'</dd><dt>分析资料</dt><dd>'+E(t.ids?.length||0)+' 份</dd>'+((t.queuePosition!==null&&t.queuePosition!==undefined)?'<dt>当前排队位置</dt><dd>'+E(t.queuePosition)+'</dd>':'')+'</dl><p class="uf-queue-note">可继续使用其他工具，稍后从本工具的“分析记录”返回。</p></article></section></div>';}
workbench=function(){
 if(state.view!=='tool')return ufBase.workbench();const task=currentTask();if(task?.status==='queued'&&!trMode())return ufQueued(task);
 const html=ufBase.workbench();if(trMode())return html;const root=document.createElement('div');root.innerHTML=html;
 const bar=root.querySelector('header.ew-commandbar,header.work-commandbar,header.aw-commandbar');if(!bar)return html;
 const records=bar.querySelector('[data-action="nav-tasks"]');if(records){records.dataset.action='uf-records';records.textContent='分析记录';records.title='查看本工具的结果和进度';}
 if(task){records?.remove();root.firstElementChild?.classList.add('uf-has-context');bar.insertAdjacentHTML('afterend','<div class="uf-result-context"><span title="'+E(task.name||'')+'">本次分析 <strong>'+E(task.name||tool(state.toolId).name)+'</strong></span>'+B('分析记录','uf-records','ghost sm')+'</div>');}
 root.querySelectorAll('.progress-shell [data-action="nav-tasks"]').forEach(n=>n.remove());
 root.querySelectorAll('.progress-shell .log div').forEach(n=>{if(n.textContent.includes('任务中心'))n.textContent='离开后可从本工具的“分析记录”继续查看。';});
 if(task?.status==='failed'){const area=root.querySelector('.ew-failed,.workbench .empty');if(area){const reason=document.createElement('p');reason.className='uf-failure-reason';reason.textContent='失败原因：'+ufFailure(task);area.querySelector('p')?.after(reason);}}
 if(task?.status==='stopped'){root.querySelectorAll('[data-action="retry-task"]').forEach(n=>{n.dataset.action='new-analysis';n.textContent='再次分析';});root.querySelectorAll('.empty p').forEach(n=>{if(n.textContent.includes('计时器')||n.textContent.includes('停止'))n.textContent='资料、设置与已返回的结果保留，可调整后重新分析。';});}
 return root.innerHTML;
};
modalContent=function(){
 if(modal==='uf-records')return ufRecordModal();const html=ufBase.modalContent(),def=UF_SUBMITS[modal];if(!def||state.view!=='tool')return html;
 const root=document.createElement('div');root.innerHTML=html;const select=root.querySelector('#'+def[0]);if(!select)return html;
 const selected=Number(modalData.execution??ws().config.executionMode??select.value)||1,field=select.closest('label');
 select.innerHTML='<option value="1">立即执行</option><option value="2">排队执行</option>';select.value=String(selected);
 const detail=document.createElement('details');detail.className='uf-submit-options';detail.innerHTML='<summary>执行设置</summary><label class="field"><span>执行方式</span></label><p>排队执行也可在当前页等待结果。</p><label class="uf-jump-option"><input id="uf-go-task-center" type="checkbox" '+(modalData.ufGoCenter?'checked':'')+'>提交后前往任务中心</label>';
 detail.querySelector('label.field').append(select);field.replaceWith(detail);
 const sub=root.querySelector('.modalhead p');if(sub)sub.textContent='提交后在当前工具查看进度和结果，离开后也可从“分析记录”返回。';
 return root.innerHTML;
};
nav=function(view,id){if(ufSubmitStay&&view==='tasks')return;return ufBase.nav(view,id);};
handleAction=function(action,el){
 const d=el?.dataset||{};
 if(action==='uf-records'){const id=TOOLS.some(t=>t.id===d.tool)?d.tool:state.toolId;Object.assign(ufView,{tool:id,query:'',status:'all',page:1});const value=openModal('uf-records');ufWatchRecords();return value;}
 if(action==='uf-open'){const task=ufRecords(ufView.tool).find(t=>t.id===d.id);if(!task)return toast('记录已移除，请刷新后重试。');return openTask(task.id);}
 if(action==='uf-refresh'){ufPaintRecords();return;}
 if(action==='uf-page'){ufView.page+=Number(d.step);ufPaintRecords();return;}
 if(action==='tr-back'&&state.view==='tool'&&currentTask())return openTask(currentTask().id);
 const def=UF_SUBMITS[modal];if(def&&action===def[1]){
  const go=!!$('#uf-go-task-center')?.checked,before=new Set(state.tasks.map(t=>t.id));let value;ufSubmitStay=!go;
  try{value=ufBase.handleAction(action,el);}finally{ufSubmitStay=false;}
  const submitted=state.tasks.find(t=>!before.has(t.id));if(submitted){submitted.executionMode=Number(submitted.config?.executionMode)||1;persist();if(go&&state.view!=='tasks')nav('tasks');}return value;
 }
 return ufBase.handleAction(action,el);
};
toast=function(message,...args){if(message==='分析完成，结果已保存到任务中心'){const latest=[...state.tasks].filter(t=>t.status==='completed').sort((a,b)=>(Date.parse(b.completed||b.lastProgressAt)||0)-(Date.parse(a.completed||a.lastProgressAt)||0))[0];message=state.view==='tool'&&currentTask()?.id===latest?.id?'分析完成，结果已在本页展示。':'分析完成，可从对应工具的“分析记录”查看结果。';}return ufBase.toast(message,...args);};
window.addEventListener('input',e=>{if(modal==='uf-records'&&e.target.dataset.ufInput==='query'){e.stopImmediatePropagation();ufView.query=e.target.value;ufView.page=1;ufPaintRecords();}},true);
window.addEventListener('change',e=>{const el=e.target;if(el.id==='uf-go-task-center'&&UF_SUBMITS[modal]){e.stopImmediatePropagation();modalData.ufGoCenter=el.checked;return;}if(modal!=='uf-records'||!el.dataset.ufChange)return;e.stopImmediatePropagation();ufView[el.dataset.ufChange]=el.dataset.ufChange==='size'?Number(el.value):el.value;ufView.page=1;ufPaintRecords();},true);
render();
