'use strict';
// A historical result can seed an editable draft; submitting it creates a new task.
const raBase={workbench,newAnalysis,run,awReconcileWords};
function raResultBar(root,task){
 const bar=root.querySelector('.ew-commandbar,.work-commandbar');if(!bar)return;
 const actions=bar.querySelector('.ew-command-actions,.aw-command-actions,.command-actions');if(!actions)return;
 bar.classList.add('ra-result-commandbar');bar.querySelector('[data-action="mobile-nav"]')?.remove();bar.querySelector('.ew-steps,.aw-steps,.inline-steps')?.remove();
 const status=actions.querySelector('.tag,.ready-count');
 const exp=root.querySelector('[data-action="export"]');
 const exportHTML=exp?exp.outerHTML:trHasResult(task)?B('导出','export','primary sm',trCanDownload(task)?'':'disabled'):'';
 if(status&&status.classList.contains('ready-count')){status.className='tag '+(task.status==='completed'?'green':['partial','awaiting'].includes(task.status)?'amber':'blue');}
 actions.innerHTML=(status?.outerHTML||'')+(task.status==='running'?B(task.toolId==='extract'?'停止提取':'停止分析','stop-task','sm','data-id="'+E(task.id)+'"'):B('再次分析','new-analysis','sm ra-adjust','title="沿用这次资料和设置，修改后提交为新记录"')+exportHTML);
 const exportButton=actions.querySelector('[data-action="export"]');if(exportButton){exportButton.className='btn primary sm';exportButton.textContent='导出';if(!exportButton.title)exportButton.title='导出本次结果';}
 root.querySelectorAll('[data-action="aw-config"],[data-action="ew-config"],[data-action="toggle-config"],[data-action="full-result"]').forEach(n=>n.remove());
 root.querySelectorAll('[data-action="export"],[data-action="new-analysis"]').forEach(n=>{if(!actions.contains(n))n.remove();});
 root.querySelectorAll('.result-actions:empty').forEach(n=>n.remove());
 root.querySelectorAll('.ew-failed p').forEach(n=>{n.textContent=n.textContent.replace('可复制配置后重新提取。','可调整设置后重新提取。').replace('可复制配置重新开始。','可调整设置后重新开始。');});
}
workbench=function(){
 const task=currentTask(),result=state.view==='tool'&&task&&!trMode();
 if(result)configExpanded=false;
 const html=raBase.workbench();if(!result)return html;
 const root=document.createElement('div');root.innerHTML=html;raResultBar(root,task);return root.innerHTML;
};
newAnalysis=function(){
 const task=currentTask(),id=state.toolId,pending=id==='word'?[...(ws().pendingStopWords||[])]:[];
 const result=raBase.newAnalysis();if(!task)return result;
 const w=ws(),c=w.config;
 // Restore executed inputs, independently of later library changes.
 w.attachmentOverrides=structuredClone(Object.fromEntries((task.ids||[]).map(doc=>[doc,task.attachments?.[doc]||[]])));
 w.reanalysisSource={id:task.id,name:task.name};
 w.unassigned=id==='bidding'?w.ids.filter(doc=>!w.projects.some(p=>(p.tender||[]).includes(doc)||(p.bidders||[]).some(b=>(b.files||[]).includes(doc)))):[];
 w.preview=w.ids.includes(w.preview)?w.preview:w.ids[0]||null;
 c.stageFailure='none';
 c.taskName=((task.config.taskName||task.name||tool(id).name).replace(/ · 调整分析$/,'')+' · 调整分析').slice(0,100);
 if(id==='word'){
  const stop=[...new Set([...(task.stopwords||task.config.lexiconSelection?.stop||[]),...pending])];
  c.lexiconSelection={stop,user:[...(task.newwords||task.config.lexiconSelection?.user||[])].filter(word=>!stop.includes(word))};
  w.pendingStopWords=[];
 }
 if(id==='meeting')c.stages.risk=structuredClone(task.riskStageDraft||task.riskReportConfig||task.config.stages.risk);
 if(id==='prepaid')w.reanalysisFeeBase=task.base??'';
 if(id==='extract'){efView.panel='materials';efView.tab='original';efView.validationAttempted=false;efEntrySaveDraft();}
 else{tv().panel='materials';tv().query='';tv().tab='original';tv().closed=[];twSaveDraft();}
 persist();render();toast('已沿用资料和设置，调整后提交将生成新记录。原结果保留。');return result;
};
// Maintaining today's word library must not silently erase an inherited word snapshot.
awReconcileWords=function(c){if(state.work.word?.reanalysisSource&&c===state.work.word.config)return;return raBase.awReconcileWords(c);};
run=function(retry){
 const w=ws(),source=!retry&&!currentTask()?structuredClone(w.reanalysisSource||null):null;
 const base=w.reanalysisFeeBase,result=raBase.run(retry),task=currentTask();
 if(source&&task){task.sourceTaskId=source.id;if(task.toolId==='prepaid'&&base!=='')task.base=base;persist();render();}
 return result;
};
render();
