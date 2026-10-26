'use strict';
// Keep daily analysis in one tool: confirm the actual scope, run existing stages,
// and review its own business output. This layer only describes existing inputs.
const bfBase={workbench,modalContent};
const BF_META={
 extract:{materials:'添加资料',settings:'设置提取字段',out:'字段汇总表与原文依据',flow:['读取主文件与所选附件','按本次字段提取','汇总字段与来源']},
 word:{materials:'添加资料',settings:'设置统计规则',intro:'设置停用词、新词和展示词数。',out:'词云、词频表与词语来源',flow:['分词与过滤','统计词频','生成词云与词频表']},
 theme:{materials:'添加资料',settings:'设置主题归纳提示词',intro:'分别选择资料要点和主题归纳提示词。',out:'基础信息与主题归纳',flow:['提取基础信息','归纳共同主题','汇总主题与来源']},
 timeline:{materials:'添加资料',settings:'设置事项提取提示词',intro:'选择事项提取提示词，明确提取哪些日期和事项。',out:'事项时间线与原文来源',flow:['提取日期与事项','整理时间线','保留原文来源']},
 risk:{materials:'添加资料',settings:'设置风险分析内容',intro:'选择要检查的风险点，提取线索和原文依据。',out:'风险核查结果与原文依据',flow:['按所选风险点检查','整理核查线索','关联原文依据']},
 meeting:{materials:'添加资料',settings:'设置会议分析提示词',intro:'选择会议分析提示词，按需调整议题聚类。',out:'会议时间轴、议题聚类与议题明细',flow:['提取会议与议题','归并相近议题','生成时间轴与议题明细']},
 contract:{materials:'添加合同',settings:'设置检查规则',intro:'选择合同类别，再设置检查规则。',out:'合同信息、条款检查结果与依据',flow:['读取合同及所选附件','提取要素并检查条款','汇总检查结果与依据']},
 bidding:{materials:'添加项目资料',settings:'设置检查内容',intro:'选择检查环节，按需调整提示词和规则。',out:'项目检查结果、提取信息与审计核查清单',flow:['按项目读取招投标资料','执行所选环节检查','汇总项目结果与证据']},
 prepaid:{materials:'添加合同',settings:'设置计费要求',intro:'选择费用类型，提取计费约定后填写基数计算费用。',out:'合同计费约定；填写基数后生成费用报告',flow:['读取计费合同','提取计费约定','核对约定与来源']},
 engineering:{materials:'添加台账',settings:'设置比较规则',intro:'设置比较字段与规则，同时查找各台账内的重复、主子项目。',out:'重复项目、主子项目候选与来源行',flow:['逐台账读取比较字段','识别重复与主子关系','汇总候选与来源行']},
 association:{materials:'选择对照表',settings:'设置关联规则',intro:'先对应两表字段，再设置关联规则。',out:'两表关联结果、各自独有项目与源行',flow:['对应两表字段','按所选规则比较','汇总关联结果与源行']}
};
const BF_MODE_NAMES={tender:'招标文件分析',bid:'投标文件分析',joint:'招投标联合分析'};
function bfText(value){return value===undefined||value===null?'':String(value);}
function bfUnique(values){return [...new Set(values.filter(Boolean))];}
function bfNames(values){return values.filter(Boolean).join('、')||'未配置';}
function bfAttachmentIds(w,c){if(!c.merge)return [];return bfUnique((w.ids||[]).flatMap(id=>{const d=file(id);return d?raAttachmentIds(d,null):[];}));}
function bfCurrentSummary(id=state.toolId){
 const w=ws(id),c=w.config,ids=bfUnique(w.ids||[]),details=[],counts=[['分析资料',ids.length+' 份']],add=(label,value)=>details.push({label,text:bfText(value)}),stage=key=>c.stages?.[key];
 const sourceLines=ids.map(id=>{const d=file(id);return d?(d.name+' · '+ewPath(d)):'资料已移除';});
 if(id==='association'){counts[0]=['对照资料',[w.tableA,w.tableB].filter(Boolean).length+' 张台账'];add('表一',bfText(w.tableAName)+'：'+(file(w.tableA)?.name||'未选择'));add('表二',bfText(w.tableBName)+'：'+(file(w.tableB)?.name||'未选择'));}
 else add('本次资料',sourceLines.join('\n'));
 const attachments=bfAttachmentIds(w,c);if(!['bidding','engineering','association','word'].includes(id)){counts.push(['附件',c.merge?'合并 '+attachments.length+' 份':'不合并']);if(attachments.length)add('关联附件',attachments.map(id=>file(id)?.name||'资料已移除').join('\n'));}
 let content='';
 if(id==='extract'){const defs=c.fieldDefs||[];content=defs.length+' 个提取字段';add('提取字段',defs.map(f=>f.name+'：'+(f.description||'按字段名称提取')).join('\n'));add('使用模板',c.template||'本次自定义字段');}
 if(id==='word'){content='展示前 '+c.top+' 个词语';add('统计设置','词数上限：'+c.top+'\n停用词：'+bfNames(c.lexiconSelection?.stop||state.stopwords||[])+'\n用户新词：'+bfNames(c.lexiconSelection?.user||state.newwords||[]));}
 if(id==='theme'){content='基础信息提取、主题归纳两阶段';add('提取提示词',stage('extract')?.template||'本次自定义要求');add('归纳提示词',stage('summarize')?.template||'本次自定义要求');}
 if(id==='timeline'){content='日期与事项提取';add('分析提示词',stage('timeline')?.template||'本次自定义要求');}
 if(id==='risk'){const selected=(c.riskNodes||[]).filter(r=>(c.checks||[]).includes(r.name));content=selected.length+' 个风险检查点';add('检查范围',selected.map(r=>(r.path||r.name)+(r.description?'：'+r.description:'')).join('\n'));add('检查顺序',c.mode||'按本次设置');add('分析提示词',stage('risk')?.template||'本次自定义要求');}
 if(id==='meeting'){content='会议与议题提取、议题聚类';add('本次分析',stage('regular')?.template||'本次自定义要求');add('议题聚类','相似度阈值 '+c.similarityThreshold+'%；最小聚类数 '+c.minClusterSize);add('后续操作','常规结果生成后，可在本工具继续会议风险分析和问答。');}
 if(id==='contract'){const automatic=c.contractType==='自动',rules=typeof cwSelected==='function'?cwSelected(c):(c.contractRules||[]).filter(r=>(c.checks||[]).includes(r.title));content=automatic?'自动识别合同类别并分析':c.contractType+' · '+rules.length+' 条检查规则';add('合同类别',c.contractType);add('补充查找线索',c.autoAnalysis?'已开启，在规则检查之外补充分析':'未开启');add('检查内容',automatic?'自动识别合同类别，按本次自动分析要求处理。':rules.map(r=>r.title+'：'+r.description+'\n判定标准：'+r.judgment).join('\n\n'));add('分析提示词',stage('compliance')?.template||'本次自定义要求');add('信息提取提示词',stage('information')?.template||'本次自定义要求');}
 if(id==='bidding'){
  const active=(w.modes||[]).filter(m=>Object.hasOwn(BF_MODE_NAMES,m)),projects=w.projects||[];
  const tender=bfUnique(projects.flatMap(p=>p.tender||[])),bid=bfUnique(projects.flatMap(p=>(p.bidders||[]).flatMap(b=>b.files||[])));
  counts.splice(0,counts.length,['项目',projects.length+' 个'],['招标文件',tender.length+' 份'],['投标文件',bid.length+' 份']);
  content=active.map(m=>BF_MODE_NAMES[m]).join('、');
  add('项目与文件角色',projects.map(p=>(p.name||'未命名项目')+'\n招标文件：'+bfNames((p.tender||[]).map(id=>file(id)?.name))+'\n'+(p.bidders||[]).map(b=>'投标单位 '+(b.name||'未命名单位')+'：'+bfNames((b.files||[]).map(id=>file(id)?.name))).join('\n')).join('\n\n'));
  active.forEach(key=>{const rules=typeof baRules==='function'?baRules(c,key):c.biddingRules?.[key]||[];add(BF_MODE_NAMES[key],(stage(key)?.template||'本次自定义要求')+'\n'+rules.map(r=>typeof r==='string'?r:r.name||r.title||r.rule_name||JSON.stringify(r)).join('\n'));});
 }
 if(id==='prepaid'){content=c.feeType+' · 提取计费约定';add('本次提取',stage('agreement')?.template||'本次自定义要求');add('后续计算','提取完成后，在结果页核对计费约定、填写基数并继续计算。');add('计算提示词',stage('calculation')?.template||'本次自定义要求');}
 if(id==='engineering'){content='重复项目、主子项目两类分析';for(const [key,label] of [['duplicate','重复项目'],['parent','主子项目']]){const g=c.engineering?.[key];add(label,(stage(key)?.template||'本次自定义要求')+'\n比较字段：'+bfNames((g?.rows||[]).map(r=>r.name+'（'+r.a+'）'))+'\n候选判定分数：'+bfText(g?.threshold)+' / 5');}}
 if(id==='association'){const g=c.association;content=(g?.rows?.length||0)+' 个对应字段';add('字段对应',(g?.rows||[]).map(r=>r.name+'：'+r.a+' ↔ '+r.b+'；'+(Object.fromEntries(COMPARE_TYPES)[r.type]||r.type)+'；权重 '+r.weight).join('\n'));add('比较规则','完全一致 > '+g.full+' 分；部分一致 ≥ '+g.partial+' 分\n'+(g.mode==='batch'?'批量模式：每行最多 '+g.perRow+' 对，全局最多 '+g.total+' 对':'标准模式')+'\n优先判定规则 '+g.hardRules.length+' 项');}
 return {id,counts,content,out:BF_META[id].out,details};
}
function bfSubmitSummary(){const s=bfCurrentSummary();return '<section class="bf-submit-summary" aria-label="本次分析范围与内容"><dl>'+s.counts.map(([label,value])=>'<div><dt>'+E(label)+'</dt><dd>'+E(value)+'</dd></div>').join('')+'<div class="bf-summary-wide"><dt>分析内容</dt><dd>'+E(s.content)+'</dd></div><div class="bf-summary-wide"><dt>分析成果</dt><dd>'+E(s.out)+'</dd></div></dl><details class="bf-confirm-details"><summary>核对资料与检查内容</summary><div>'+s.details.map(item=>'<section><h3>'+E(item.label)+'</h3><pre>'+E(item.text||'未配置')+'</pre></section>').join('')+'</div></details></section>';}
modalContent=function(){const html=bfBase.modalContent();if(state.view!=='tool'||currentTask()||!['ew-submit','aw-submit','tw-submit'].includes(modal))return html;const root=document.createElement('div');root.innerHTML=html;const body=root.querySelector('.modalbody');if(!body)return html;root.querySelector('.ew-submit-summary')?.remove();body.insertAdjacentHTML('afterbegin',bfSubmitSummary());const intro=root.querySelector('.modalhead p');if(intro)intro.textContent='确认资料范围与分析内容，提交后在本工具查看进度和成果。';root.querySelectorAll('#ew-task-notes,#aw-task-notes,#tw-task-notes').forEach(n=>n.rows=2);return root.innerHTML;};
workbench=function(){const html=bfBase.workbench();if(state.view!=='tool'||!BF_META[state.toolId]||trMode())return html;const root=document.createElement('div');root.innerHTML=html;const task=currentTask(),meta=BF_META[state.toolId];if(!task&&state.toolId!=='extract'){
 const materials=root.querySelector('aside.ew-materials,aside.asw-materials'),settings=root.querySelector('aside.ew-config,aside.config');
 for(const [panel,text,number] of [[materials,meta.materials,1],[settings,meta.settings,root.querySelector('.tl-workspace')?3:2]]){const heading=panel?.querySelector('h2');if(heading)heading.innerHTML='<span class="tw-step">Step '+number+'</span> '+E(text);if(panel)panel.setAttribute('aria-label','Step '+number+' '+text);}
 if(materials){
  const add=materials.querySelector('.tw-panel-head>[data-action="add-tool-materials"]');
  if(add){add.textContent='添加';if(!add.hasAttribute('aria-label'))add.setAttribute('aria-label',meta.materials);}
  const empty=materials.querySelector('.tw-empty-small');if(empty?.textContent==='点击上方“添加资料”，选择本次需要分析的文件。')empty.textContent='点击上方“添加”，选择本次需要分析的文件。';
  const intro=materials.querySelector('.tw-intro');
  if(intro&&state.toolId!=='engineering')intro.textContent=state.toolId==='contract'||state.toolId==='prepaid'?'点击“添加”选择合同，下方为已选合同。可按需关联补充资料。':'点击“添加”选择文件，下方为已选资料。';
 }
 if(settings){
  // Replace only general introductions; category guidance and stage-specific instructions stay intact.
  const intros=[...settings.querySelectorAll(':scope>.bf-preparation-intro,:scope>.eg-intro,:scope>.asw-intro,:scope>.ew-config-body>.tw-intro,:scope>.ew-config-body>.th-config-intro,:scope>.ew-config-body>.aa-config-intro')];
  const intro=intros[0];
  if(intro){intro.textContent=meta.intro;intros.slice(1).forEach(n=>n.remove());}
  else{const heading=settings.querySelector('h2')?.parentElement;heading?.insertAdjacentHTML('afterend','<p class="bf-preparation-intro">'+E(meta.intro)+'</p>');}
  const wordHint=settings.querySelector('.wc-intro>span');if(wordHint?.textContent==='按需要调整以下统计规则。')wordHint.remove();
 }
 }
 if(task?.status==='running'){
  const progress=root.querySelector('.ew-progress,.aw-progress,.progress-shell');if(progress){const flow='<div class="bf-running-flow"><span>本次处理内容</span><p>'+meta.flow.map(E).join('<i aria-hidden="true"> → </i>')+'</p>'+(state.toolId==='prepaid'?'<small>计费约定提取完成后，在本页填写基数继续计算。</small>':'')+'</div>';const old=progress.querySelector('.log');if(old)old.outerHTML=flow;else{const track=progress.querySelector('.progress-track');track?.insertAdjacentHTML('afterend',flow);}progress.querySelectorAll('.ew-progress-meta>span,.aw-progress-info>span').forEach(n=>n.textContent='完成后在本页查看，也可从分析记录返回。');}
 }
 return root.innerHTML;
};
render();
