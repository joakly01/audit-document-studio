'use strict';
// Preparation and history are separate entry contexts; a prior result must not become the tool's default page.
const efEntryBase={nav,route,openTask,handleAction,run,newAnalysis};
let efEntryHistoryId=null;
function efEntrySaveDraft(){
 const w=state.work.extract;if(!w||w.taskId)return;
 const {preparationDraft,...draft}=w;
 w.preparationDraft=structuredClone(draft);
}
function efEntryEmptyDraft(){
 const previous=state.work.extract;let draft;
 try{delete state.work.extract;draft=structuredClone(ws('extract'));}finally{if(previous)state.work.extract=previous;else delete state.work.extract;}
 return draft;
}
function efEntryPreparation(){
 const w=ws('extract');
 if(w.taskId){
  const draft=structuredClone(w.preparationDraft||efEntryEmptyDraft());
  state.work.extract={...draft,taskId:null,tab:'preview',preparationDraft:structuredClone(draft)};
 }
 efView.panel='materials';efView.tab='original';efView.settings=false;efView.taskId=null;
}
nav=function(view,id){
 if(view==='tool'&&(id||state.toolId)==='extract'&&!efEntryHistoryId)efEntryPreparation();
 efEntryBase.nav(view,id);
 if(view==='tool'&&state.toolId==='extract'&&efEntryHistoryId){
  // Replace the single navigation entry: browser Back returns directly to the prior page.
  history.replaceState(history.state,'','#tool/extract/'+encodeURIComponent(efEntryHistoryId));
 }
};
openTask=function(id){
 const task=state.tasks.find(t=>t.id===id);
 if(!task||tcMerge(task)||tcResolve(task)!=='extract')return efEntryBase.openTask(id);
 efEntrySaveDraft();const previous=efEntryHistoryId;efEntryHistoryId=id;
 try{return efEntryBase.openTask(id);}finally{efEntryHistoryId=previous;}
};
run=function(retry){
 if(state.toolId!=='extract')return efEntryBase.run(retry);
 if(!retry)efEntrySaveDraft();
 const result=efEntryBase.run(retry),task=currentTask();
 if(task&&state.view==='tool')history.replaceState(history.state,'','#tool/extract/'+encodeURIComponent(task.id));
 return result;
};
newAnalysis=function(){
 const result=efEntryBase.newAnalysis();
 if(state.toolId==='extract'&&!currentTask()){
  history.replaceState(history.state,'','#tool/extract');efEntrySaveDraft();
 }
 return result;
};
handleAction=function(action,el){
 // Restore the draft before the library hands its current material selection to the tool.
 if(action==='open-tool'&&el.dataset.id==='extract')efEntryPreparation();
 return efEntryBase.handleAction(action,el);
};
window.removeEventListener('hashchange',efEntryBase.route);
route=function(){
 const [view,id,encodedTaskId,entryMode]=(location.hash.slice(1)||'library').split('/');
 if(view==='tool'&&id==='extract'){
  let taskId='';try{taskId=decodeURIComponent(encodedTaskId||'');}catch{}
  const task=state.tasks.find(t=>t.id===taskId&&!tcMerge(t)&&tcResolve(t)==='extract');
  if(task){if(ws('extract').taskId!==task.id){openTask(task.id);if(['config','download'].includes(entryMode)){history.replaceState(history.state,'','#tool/extract/'+encodeURIComponent(task.id)+'/'+entryMode);render();}return;}}
  else{efEntryPreparation();if(encodedTaskId)history.replaceState(history.state,'','#tool/extract');}
 }
 efEntryBase.route();
};
window.addEventListener('hashchange',route);
route();
