'use strict';
// Add isolated, versioned examples without replacing user tasks or preparation drafts.
const TASK_DEMO_VERSION=1;
const TASK_DEMO_NAMES={
 extract:['园区采购合同关键信息提取','项目批复与合同信息汇总'],
 word:['园区建设资料高频词统计','合同与会议材料重点用词'],
 theme:['园区项目审计事项归纳','资金与采购事项分类整理'],
 timeline:['园区项目决策与实施时间轴','合同签订与付款事项梳理'],
 risk:['园区资金与采购风险检查','合同履约及验收线索核验'],
 meeting:['项目会议议题与决策梳理','采购与付款会议事项汇总'],
 contract:['设备采购合同条款检查','采购合同验收与付款约定核对'],
 bidding:['设备采购招投标响应检查','青禾与远川投标文件对照'],
 prepaid:['监理合同计费约定提取','监理服务费测算'],
 engineering:['园区项目台账重复事项检查','园区配套项目主子关系识别'],
 association:['项目台账与资金安排关联','建设项目与年度资金交叉核对']
};
function tdTask(meta,round,index){
 const id=meta.id,c={template:meta.template,prompt:'依据所选资料'+meta.desc+'，保留原文依据，未取得的信息如实标注。',fields:[...(meta.fields||[])],checks:[...(meta.checks||[])],merge:false,top:30,mode:'file',failure:'none',stageFailure:'none',threshold:4,matchMode:'standard',cap:20,chunk:2000,overlap:200};
 if(round){c.top=20;if(id==='extract')c.fields=['涉及单位','金额与单位'];if(['risk','contract'].includes(id))c.checks=c.checks.slice(0,2);}
 seedConfig(id,c);
 const ids=meta.sample.filter(docId=>file(docId)&&!file(docId).deleted);
 const created=new Date(Date.now()-(index+1)*45*60000).toISOString();
 const t={id:'demo-task-v1-'+id+'-'+round,demo:true,name:TASK_DEMO_NAMES[id][round],notes:'园区建设项目审计 · '+(round?'补充核对':'首次分析'),toolId:id,ids,config:c,status:id==='prepaid'?'awaiting':'completed',progress:100,phase:id==='prepaid'?'待填写计费基数':'分析完成',created,startedAt:new Date(+new Date(created)+60000).toISOString(),completed:new Date(+new Date(created)+8*60000).toISOString(),lastProgressAt:new Date(+new Date(created)+8*60000).toISOString(),successIds:[...ids],failedIds:[],attachments:{},stopwords:['的','以及'],newwords:[],chats:[],projects:[],modes:['joint']};
 if(id==='bidding')t.projects=[{id:'demo-project',name:'设备采购项目',tender:ids.filter(i=>i==='d6'),bidders:[{name:'青禾设备有限公司',files:ids.filter(i=>i==='d7')},{name:'远川设备有限公司',files:ids.filter(i=>i==='d8')}]}];
 if(id==='association')Object.assign(t,{tableA:'d10',tableB:'d11',tableAName:file('d10')?.name,tableBName:file('d11')?.name});
 ensureTaskStructure(t);t.result=makeResult(t);
 return t;
}
const taskDemoReady=(async()=>{
 await libraryStatusDataReady;
 if(state.taskDemoVersion===TASK_DEMO_VERSION)return;
 const examples=[];
 for(let round=0;round<2;round++)for(const meta of TOOLS)examples.push(tdTask(meta,round,examples.length));
 const scenarios=[
 ['extract','partial','合同字段补充提取','部分资料读取超时，已保留成功结果。'],
 ['theme','partial','审计事项主题归纳复核','基础信息已提取，归纳阶段未完成。'],
 ['meeting','failed','会议议题分析重试检查','读取资料超时，本次未生成可用结果。'],
 ['risk','failed','采购风险点检查','分析服务连接中断，请确认服务状态后重试。'],
 ['timeline','stopped','项目时间轴补充分析','审计人员已终止本次分析。'],
 ['extract','running','合同资料分批提取',''],
 ['contract','queued','合同条款检查排队任务',''],
 ['word','queued','项目资料词频统计排队任务','']
 ];
 scenarios.forEach(([id,status,name,error],index)=>{
  const t=tdTask(tool(id),0,examples.length);t.id='demo-task-v1-scenario-'+index;t.name=name;t.status=status;t.error=error;
  if(status==='partial'){
   if(id==='theme'){t.config.stageFailure='fail';t.summaryFailed=true;t.phase='基础信息已提取，主题归纳失败';}
   else{t.successIds=t.ids.slice(0,-1);t.failedIds=t.ids.slice(-1);t.result=makeResult(t);t.phase='部分资料分析失败';}
  }else{
   t.result=[];t.successIds=[];t.failedIds=status==='failed'?[...t.ids]:[];t.progress=status==='running'?36:0;
   t.phase=({failed:'分析失败',stopped:'用户终止任务',running:'正在提取合同字段',queued:'等待开始'})[status];
   if(['queued','running'].includes(status)){
    t.demoSnapshot=true;t.created=new Date(Date.now()-4*60000).toISOString();delete t.completed;
    t.lastProgressAt=new Date().toISOString();t.startedAt=status==='running'?new Date(Date.now()-2*60000).toISOString():null;
    if(status==='queued'){t.queuePosition=index-5;t.estimatedWaitSeconds=(index-5)*180;}
   }
  }
  examples.push(t);
 });
 const existing=new Set(state.tasks.map(t=>t.id));state.tasks.push(...examples.filter(t=>!existing.has(t.id)));
 state.taskDemoVersion=TASK_DEMO_VERSION;persist();if(state.view==='tasks')render();
})();
// Once explicitly re-executed, an example follows the normal task lifecycle.
const tdRunBase=run;
run=function(retry){if(retry)delete retry.demoSnapshot;return tdRunBase(retry);};
const tdTasksPageBase=tasksPage;
tasksPage=function(){const root=document.createElement('div');root.innerHTML=tdTasksPageBase();root.querySelectorAll('[data-tc-row]').forEach(row=>{const t=state.tasks.find(t=>t.id===row.dataset.tcRow);if(t?.demo){let info=row.querySelector('.tc-tool')?.parentElement.querySelector('small');if(!info&&row.querySelector('.tc-tool')){info=document.createElement('small');row.querySelector('.tc-tool').after(info);}info?.insertAdjacentHTML('afterbegin','<span class="td-badge" title="演示资料与结果，用于体验功能">演示</span>');if(t.demoSnapshot)row.querySelector('.tc-phase')?.insertAdjacentHTML('afterend','<small class="td-snapshot">演示状态，不实际执行</small>');}});return root.innerHTML;};
