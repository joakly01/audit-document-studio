'use strict';
// Layered interaction revision: configuration editors use the same modal/save conventions.
const baseV1={ws,currentConfig,configPanel,associationPreparation,modalContent,handleAction,validate,run,makeResult,resultDetailModal,meetingResults,saveTemplate,templatesPage,getTemplate,doExport,workbench,sourceLink,loadSample};
ws=function(id=state.toolId){const w=baseV1.ws(id);seedConfig(id,w.config);return w;};
currentConfig=function(){const c=baseV1.currentConfig();return seedConfig(state.toolId,c);};
Object.entries(state.work).forEach(([id,w])=>{if(tool(id))seedConfig(id,w.config);});
state.tasks.forEach(t=>seedConfig(t.toolId,t.config));
let editorDraft=null;
function selectedStages(id=state.toolId){
 const stages=PROMPT_STAGES[id]||[];
 return stages.filter(([key])=>id!=='bidding'||(currentTask()?.modes||ws().modes).includes(key));
}
function stageList(id,c,locked){return selectedStages(id).map(([key,label,type,name])=>'<div class="stage-line"><div class="row between"><h4>'+label+'</h4>'+A(locked?'查看':'编辑','v2-stage','data-stage="'+key+'"')+'</div><div class="hint">'+E(c.stages[key].template)+' · '+(c.stages[key].origin==='personal'?'个人版本':c.stages[key].customized?'本次已调整':'系统模板')+'</div></div>').join('');}
function cfgField(label,key,values,c,locked){return '<div class="field"><label>'+label+'</label><select data-config="'+key+'" '+(locked?'disabled':'')+'>'+options(values,c[key])+'</select></div>';}
configPanel=function(){
 const id=state.toolId,t=tool(id),w=ws(),c=currentConfig(),locked=isLocked();
 if(id==='meeting'&&w.subtab==='qa')return baseV1.configPanel();
 let html='<aside class="config"><div class="row between"><h3>'+ (locked?'本次配置':'分析设置')+'</h3>'+tag(locked?'执行快照':'可配置',locked?'':'blue')+'</div>';
 html+='<div class="config-section"><div class="row between"><span class="field-label no-margin">分析方案</span>'+A('管理模板','nav-templates')+'</div><select class="w100 mt" style="margin-top:8px" data-config="template" '+(locked?'disabled':'')+'>'+options([...new Set([t.template,...state.templates.filter(p=>p.toolId===id).map(p=>p.name),c.template])],c.template)+'</select><div class="config-toolbar">'+B(locked?'查看要求':'编辑提示词','prompt','sm')+B('另存我的模板','save-template','sm')+B('导出配置','v2-export-config','sm')+'</div></div>';
 if(id==='contract')html+=cfgField('合同类别','contractType',['自动','施工类合同','非施工类合同'],c,locked);
 if(id==='prepaid')html+=cfgField('费用类型','feeType',EXPENSE_TYPES,c,locked);
 if(id==='bidding')html+='<div class="config-section"><label class="field-label">分析内容</label>'+[['tender','招标文件分析'],['bid','投标文件分析'],['joint','联合分析']].map(([key,label])=>'<label class="row-radio rule-row"><input type="checkbox" data-change="bid-mode" value="'+key+'" '+((currentTask()?.modes||w.modes).includes(key)?'checked':'')+' '+(locked?'disabled':'')+'>'+label+'</label>').join('')+'</div>';
 if(id!=='word')html+='<div class="config-section">'+stageList(id,c,locked)+'</div>';
 if(id==='extract')html+='<div class="config-section"><div class="row between"><h4>提取字段 · '+c.fieldDefs.length+'</h4>'+A(locked?'查看':'编辑字段','edit-fields')+'</div>'+c.fieldDefs.slice(0,5).map((f,i)=>'<div class="rule-row"><span class="number-label">'+(i+1)+'</span><span title="'+E(f.description)+'">'+E(f.name)+'</span></div>').join('')+(c.fieldDefs.length>5?'<p class="hint">另有 '+(c.fieldDefs.length-5)+' 个字段，打开编辑查看。</p>':'')+'</div>';
 if(id==='risk'||id==='contract'){
 const choices=id==='risk'?c.riskNodes.map(r=>r.name):c.contractRules.map(r=>r.title);
 html+='<div class="config-section"><div class="row between"><h4>'+ (id==='risk'?'本次关注点':'检查规则')+' · '+c.checks.length+'</h4>'+A(locked?'查看':'管理','v2-rules')+'</div>'+choices.map(name=>'<label class="row-radio rule-row"><input type="checkbox" data-change="risk-check" value="'+E(name)+'" '+(c.checks.includes(name)?'checked':'')+' '+(locked?'disabled':'')+'>'+E(name)+'</label>').join('')+'</div>';
 if(id==='risk')html+=cfgField('检查顺序','mode',['逐文件检查全部关注点','逐关注点检查各文件'],c,locked)+'<p class="hint">两种方式均逐文件检查，结果按文件与关注点展示。</p>';
 }
 if(id==='engineering')html+='<div class="config-section"><h4>字段与评分</h4>'+[['duplicate','重复项目'],['parent','主子项目']].map(([key,label])=>'<div class="stage-line"><div class="row between"><span class="small">'+label+' · '+c.engineering[key].rows.length+' 个字段</span>'+A(locked?'查看':'配置','v2-engineering','data-kind="'+key+'"')+'</div><p class="hint">判定阈值 '+c.engineering[key].threshold+' / 5 分</p></div>').join('')+'</div>';
 if(id==='word')html+='<div class="field"><label>展示词数</label><input type="number" min="10" max="500" data-config="top" value="'+c.top+'" '+(locked?'disabled':'')+'></div><div class="config-toolbar">'+B('我的词库','lexicon','sm')+B('本次用词选择','v2-word-selection','sm')+'</div><p class="hint">词库可导入、编辑；本次选择保存到任务快照。词频不代表风险程度。</p>';
 if(['extract','contract'].includes(id))html+='<div class="field"><label class="row-radio"><input type="checkbox" data-config="merge" '+(c.merge?'checked':'')+' '+(locked?'disabled':'')+'>合并关联附件分析</label>'+A('管理附件','attachments')+'</div>';
 html+='<details><summary>任务名称与审计关注</summary><div class="field"><label>任务名称</label><input data-config="taskName" placeholder="默认按工具与时间命名" value="'+E(c.taskName)+'" '+(locked?'readonly':'')+'></div><div class="field"><label>本次审计关注（可选）</label><textarea data-config="auditObjective" placeholder="例如：核对设备采购预算调整与决策过程" '+(locked?'readonly':'')+'>'+E(c.auditObjective)+'</textarea><p class="hint">记录到任务备注。需要影响分析时，请同时调整相应提示词。</p></div><div class="field"><label>任务备注</label><textarea data-config="taskNotes" '+(locked?'readonly':'')+'>'+E(c.taskNotes)+'</textarea></div></details>';
 html+='<details><summary>高级设置</summary>';
 if(id==='meeting')html+='<div class="field"><label>议题相似度阈值（%）</label><input type="number" min="0" max="100" data-config="similarityThreshold" value="'+c.similarityThreshold+'" '+(locked?'disabled':'')+'></div><div class="field"><label>最小聚类数</label><input type="number" min="1" max="20" data-config="minClusterSize" value="'+c.minClusterSize+'" '+(locked?'disabled':'')+'></div><p class="hint">用于归并相近议题，不是准确率。</p>';
 if(id==='extract')html+='<div class="field"><label>切片字数</label><input type="number" min="100" data-config="chunk" value="'+c.chunk+'" '+(locked?'disabled':'')+'></div><div class="field"><label>冗余字数</label><input type="number" min="0" data-config="overlap" value="'+c.overlap+'" '+(locked?'disabled':'')+'></div>';
 html+=B('查看完整配置','v2-config-json','sm mt')+'</details>';
 return html+'</aside>';
};
associationPreparation=function(){
 const w=ws(),c=currentConfig(),g=c.association;
 return '<div class="card"><div class="cardhead"><div><h3>字段对应与比较规则</h3><p class="hint">先对应列名，再按需要调整预筛、评分及硬规则。</p></div>'+B('编辑完整配置','v2-association','sm soft')+'</div><div class="cardbody"><div class="row between"><div><label class="field-label">分析方案</label>'+selectConfig('template',[tool('association').template,...state.templates.filter(t=>t.toolId==='association').map(t=>t.name)])+'</div><div class="row">'+B('编辑提示词','prompt','sm')+B('另存模板','save-template','sm')+'</div></div><div class="mt">'+simpleTable(['比较内容',E(w.tableAName),E(w.tableBName),'预筛方式 / 权重'],g.rows.map(r=>[E(r.name),E(r.a),E(r.b),E(COMPARE_TYPES.find(x=>x[0]===r.type)?.[1])+' / '+r.weight]),true)+'</div><div class="summary-strip mt">模式：'+(g.mode==='batch'?'批量 · 每行最多 '+g.perRow+' 对 / 全局 '+g.total+' 对':'标准')+'　部分一致 ≥ '+g.partial+' 分　完全一致 > '+g.full+' 分<br>最少匹配 '+g.minFields+' 个字段 · 硬规则 '+g.hardRules.length+' 项</div><div class="editor-note">“编辑完整配置”支持新增比较列、评分规则、单字段/组合硬规则以及四项独立锁定设置。参数沿用原有配置结构。</div><div class="row between mt">'+B('字段与评分配置','v2-association')+B('导出配置','v2-export-config','sm')+'</div><details><summary>任务名称与备注</summary><div class="field"><label>任务名称</label><input class="w100" data-config="taskName" value="'+E(c.taskName)+'"></div><div class="field"><label>审计关注 / 备注</label><textarea class="w100" data-config="taskNotes">'+E(c.taskNotes)+'</textarea></div></details></div></div>';
};
function editInput(path,value,opts={}){return '<input data-edit="'+path+'" value="'+E(value)+'" type="'+(opts.type||'text')+'" '+(opts.min!==undefined?'min="'+opts.min+'" ':'')+(opts.max!==undefined?'max="'+opts.max+'" ':'')+(opts.step?'step="'+opts.step+'" ':'')+(opts.readonly?'disabled':'')+' aria-label="'+E(opts.label||path)+'">';}
function editText(path,value,readonly=false){return '<textarea data-edit="'+path+'" '+(readonly?'readonly':'')+' aria-label="'+E(path)+'">'+E(value)+'</textarea>';}
function editSelect(path,value,values,readonly=false){return '<select data-edit="'+path+'" '+(readonly?'disabled':'')+' aria-label="'+E(path)+'">'+values.map(v=>{const [key,name]=Array.isArray(v)?v:[v,v];return '<option value="'+E(key)+'" '+(String(key)===String(value)?'selected':'')+'>'+E(name)+'</option>';}).join('')+'</select>';}
function editorFooter(){return '<span class="grow editor-note">仅应用本次配置；原任务及系统模板保持不变。</span>'+B('取消','close-modal')+(isLocked()?B('关闭','close-modal','primary'):B('保存并应用','v2-save-editor','primary'));}
function stageEditor(){
 const id=state.toolId,locked=isLocked(),key=modalData.stage,defs=selectedStages(),s=editorDraft[key],def=defs.find(x=>x[0]===key);
 const opts=[{id:'default',name:def[3]},...state.templates.filter(t=>t.toolId===id&&(!t.stage||t.stage===key))];
 return modalFrame('提示词设置','系统模板作为起点；编辑仅对本次生效，可另存为个人模板。','<div class="stage-tabs">'+defs.map(([k,n])=>'<button class="'+(k===key?'active':'')+'" data-action="v2-stage-tab" data-stage="'+k+'">'+n+'</button>').join('')+'</div><div class="row between mb"><label class="field-label no-margin">选择模板</label>'+tag(s.customized?'本次已调整':'模板内容','blue')+'</div><select class="w100" data-v2-change="stage-template" '+(locked?'disabled':'')+'><option value="">'+E(s.template)+'</option>'+opts.map(t=>'<option value="'+E(t.id)+'">'+E(t.name)+'</option>').join('')+'</select><div class="field"><label>本次分析要求</label><textarea id="prompt-editor" class="w100" data-edit="'+key+'.content" style="min-height:230px" '+(locked?'readonly':'')+'>'+E(s.content)+'</textarea></div><div class="row between mt"><span class="editor-note">系统原件不会因本次修改而更新。</span>'+(!locked?A('恢复此阶段默认','v2-stage-reset'):'')+'</div><div id="editor-error" class="error"></div>',(locked?B('关闭','close-modal'):B('取消','close-modal')+B('另存个人模板','v2-save-stage-template')+B('应用到本次分析','v2-save-editor','primary')),'medium');
}
function fieldsEditor(){const locked=isLocked();return modalFrame('提取字段','名称说明“提取什么”，描述说明口径、单位和未取得时的处理。','<div class="editor-toolbar"><span class="small muted">'+editorDraft.length+' 个字段</span>'+(!locked?B(I('plus')+'新增字段','v2-add-field','sm'):'')+'</div><div class="edit-rows">'+editorDraft.map((f,i)=>'<div class="edit-row"><div class="row between"><span class="number-label">'+(i+1)+'</span><span class="grow"></span>'+(!locked?A('删除','v2-delete-field','data-index="'+i+'"'):'')+'</div><div class="editor-grid"><div><label>字段名称</label>'+editInput(i+'.name',f.name,{readonly:locked})+'</div><div><label>提取说明</label>'+editText(i+'.description',f.description,locked)+'</div></div></div>').join('')+'</div><div id="editor-error" class="error"></div>',editorFooter(),'medium');}
function rulesEditor(){const locked=isLocked(),risk=state.toolId==='risk';return modalFrame(risk?'关注点配置':'合同检查规则',risk?'关注点由模板配置，可增删、调整层级路径与说明。':'保留原有规则名称、描述、法规依据、判断标准与提取格式。','<div class="editor-toolbar"><span class="small muted">'+editorDraft.length+' 项</span>'+(!locked?B(I('plus')+'新增'+(risk?'关注点':'规则'),'v2-add-rule','sm'):'')+'</div><div class="edit-rows">'+editorDraft.map((r,i)=>'<div class="edit-row"><div class="row between"><b class="small">第 '+(i+1)+' 项</b>'+(!locked?A('删除','v2-delete-rule','data-index="'+i+'"'):'')+'</div><div class="editor-grid">'+(risk?'<div><label>关注点名称</label>'+editInput(i+'.name',r.name,{readonly:locked})+'</div><div><label>层级路径</label>'+editInput(i+'.path',r.path,{readonly:locked})+'</div><div class="editor-full"><label>检查说明</label>'+editText(i+'.description',r.description,locked)+'</div>':'<div><label>规则名称</label>'+editInput(i+'.title',r.title,{readonly:locked})+'</div><div><label>规则描述</label>'+editText(i+'.description',r.description,locked)+'</div><div><label>法规 / 制度依据</label>'+editText(i+'.laws',r.laws,locked)+'</div><div><label>判断标准</label>'+editText(i+'.judgment',r.judgment,locked)+'</div><div><label>提取格式</label>'+editSelect(i+'.format',r.format,[['compliance','合规性 · 文本'],['completeness','完备性 · 键值对象']],locked)+'</div><div><label>提取内容 / 字段定义</label>'+editText(i+'.expected',r.expected,locked)+'<p class="hint">完备性模式使用 JSON 对象。</p></div>')+'</div></div>').join('')+'</div><div id="editor-error" class="error"></div>',editorFooter(),'','');}
function mappingEditor(two){
 const locked=isLocked(),g=editorDraft,kind=modalData.kind,w=ws(),a=file(two?w.tableA:(currentTask()?.ids||w.ids)[0]),b=file(w.tableB);
 const optionsA=['请选择',...(a?.columns||[])],optionsB=['请选择',...(b?.columns||[])];
 const max=two?5:1;
 let body='<div class="editor-toolbar"><span class="small muted">字段 '+g.rows.length+' 项 · 权重合计 '+g.rows.reduce((n,r)=>n+(+r.weight||0),0).toFixed(2)+'</span>'+(!locked?B(I('plus')+'新增比较字段','v2-add-mapping','sm'):'')+'</div><div class="edit-rows">'+g.rows.map((r,i)=>'<div class="edit-row"><div class="row between"><b class="small">'+E(r.key)+' · '+E(r.name)+'</b>'+(!locked?A('删除','v2-delete-mapping','data-index="'+i+'"'):'')+'</div><div class="editor-grid three"><div><label>比较内容</label>'+editInput('rows.'+i+'.name',r.name,{readonly:locked})+'</div><div><label>'+(two?E(w.tableAName):'Excel列')+'</label>'+editSelect('rows.'+i+'.a',r.a,optionsA,locked)+'</div>'+(two?'<div><label>'+E(w.tableBName)+'</label>'+editSelect('rows.'+i+'.b',r.b,optionsB,locked)+'</div>':'')+'</div><div class="editor-grid three"><div><label>预筛类型</label>'+editSelect('rows.'+i+'.type',r.type,COMPARE_TYPES.filter(x=>x[0]!=='investment_gt'||kind==='parent'),locked)+'</div><div><label>预筛阈值（0–'+max+'）</label>'+editInput('rows.'+i+'.threshold',r.threshold,{type:'number',min:0,max,step:'.01',readonly:locked})+'</div><div><label>权重（0–1）</label>'+editInput('rows.'+i+'.weight',r.weight,{type:'number',min:0,max:1,step:'.05',readonly:locked})+'</div></div><div class="field"><label>评分规则</label>'+editText('rows.'+i+'.rule',r.rule,locked)+'</div></div>').join('')+'</div>';
 if(two)body+='<details open><summary>判定与性能参数</summary><div class="editor-grid three"><div><label>完全一致阈值（严格大于）</label>'+editInput('full',g.full,{type:'number',min:0,max:5,step:'.1',readonly:locked})+'</div><div><label>部分一致阈值（大于等于）</label>'+editInput('partial',g.partial,{type:'number',min:0,max:5,step:'.1',readonly:locked})+'</div><div><label>最少匹配字段</label>'+editInput('minFields',g.minFields,{type:'number',min:1,max:g.rows.length,readonly:locked})+'</div><div><label>分析模式</label>'+editSelect('mode',g.mode,[['standard','标准模式'],['batch','批量模式']],locked)+'</div><div><label>每行最大对比数（1–20）</label>'+editInput('perRow',g.perRow,{type:'number',min:1,max:20,readonly:locked})+'</div><div><label>全局最大对比数</label>'+editInput('total',g.total,{type:'number',min:1000,max:50000,step:1000,readonly:locked})+'</div></div><p class="hint">对比数上限只在批量模式生效；预筛阈值与模型0–5分判定阈值分别配置。</p><div class="editor-grid">'+[['full','完全一致时锁定'],['partial','不完全一致锁定'],['table1','表一完全一致锁定'],['table2','表二完全一致锁定']].map(([k,n])=>'<label class="row-radio"><input type="checkbox" data-edit="locks.'+k+'" '+(g.locks[k]?'checked':'')+' '+(locked?'disabled':'')+'>'+n+'</label>').join('')+'</div></details>'+hardRulesEditor(g,locked);
 else body+='<div class="editor-grid"><div><label>判定阈值（0–5分）</label>'+editInput('threshold',g.threshold,{type:'number',min:0,max:5,step:'.05',readonly:locked})+'</div><div><label>最少匹配字段</label>'+editInput('minFields',g.minFields,{type:'number',min:1,max:g.rows.length,readonly:locked})+'</div></div>';
 body+='<div class="field"><label>补充提示词</label>'+editText('additional',g.additional,locked)+'</div><div id="editor-error" class="error"></div>';
 return modalFrame(two?'两表比较配置':(kind==='parent'?'主子项目':'重复项目')+'配置','配置比较字段、预筛、权重与评分规则。',body,editorFooter());
}
function hardRulesEditor(g,locked){return '<details><summary>硬规则 · '+g.hardRules.length+' 项</summary><div class="config-toolbar">'+(!locked?B('恢复模板规则','v2-hard-reset','sm')+B('添加单字段规则','v2-hard-add','sm','data-kind="single"')+B('添加组合规则 AND','v2-hard-add','sm','data-kind="and"'):'')+'</div><div class="edit-rows mt">'+g.hardRules.map((r,i)=>'<div class="edit-row"><div class="row between"><h4>'+(r.logic==='and'?'组合规则 AND':'单字段规则')+'</h4>'+(!locked?A('删除','v2-hard-delete','data-index="'+i+'"'):'')+'</div>'+(r.logic==='and'?r.rules:[r]).map((sub,j)=>'<div class="editor-grid"><div><label>字段</label>'+editSelect('hardRules.'+i+(r.logic==='and'?'.rules.'+j:'')+'.field',sub.field,g.rows.map(x=>[x.key,x.key+' · '+x.name]),locked)+'</div><div><label>条件</label>'+editSelect('hardRules.'+i+(r.logic==='and'?'.rules.'+j:'')+'.condition',sub.condition,HARD_CONDITIONS,locked)+(r.logic==='and'&&!locked?A('移除条件','v2-hard-sub-delete','data-index="'+i+'" data-sub="'+j+'"'):'')+'</div></div>').join('')+(r.logic==='and'&&!locked?A('＋ 添加子条件','v2-hard-sub','data-index="'+i+'"'):'')+'<div class="editor-grid"><div><label>判定结果</label>'+editSelect('hardRules.'+i+'.result',r.result,HARD_RESULTS,locked)+'</div><div><label>优先级（0–999）</label>'+editInput('hardRules.'+i+'.priority',r.priority,{type:'number',min:0,max:999,readonly:locked})+'</div><div class="editor-full"><label>触发说明</label>'+editText('hardRules.'+i+'.message',r.message,locked)+'</div></div></div>').join('')+'</div></details>';}
function meetingFilterModal(){const f=editorDraft;return modalFrame('筛选会议与议题','仅筛选本次结果，不改变分析配置，也不重新执行。','<div class="filter-grid"><div class="field no-margin"><label>参会人员（多个以 | 分隔）</label>'+editInput('participants',f.participants||'')+'</div><div class="field no-margin"><label>议题关键词</label>'+editInput('keywords',f.keywords||'')+'</div><div class="field no-margin"><label>开始日期</label>'+editInput('from',f.from||'',{type:'date'})+'</div><div class="field no-margin"><label>结束日期</label>'+editInput('to',f.to||'',{type:'date'})+'</div><div class="field no-margin"><label>最小金额（万元）</label>'+editInput('min',f.min??'',{type:'number',min:0})+'</div><div class="field no-margin"><label>最大金额（万元）</label>'+editInput('max',f.max??'',{type:'number',min:0})+'</div></div><label class="row-radio mt"><input type="checkbox" data-edit="regex" '+(f.regex?'checked':'')+'>关键词使用正则表达式（有限语法）</label><p class="hint">金额未提取到的记录不参与金额范围匹配。正则允许文字、.、.*、^、$ 和 |，不支持分组及重复嵌套。</p><div id="editor-error" class="error"></div>',B('重置','v2-reset-meeting-filter')+B('取消','close-modal')+B('应用筛选','v2-save-editor','primary'),'medium');}
function lexiconModal(){
 const g=editorDraft,query=modalData.query||'',all=[...g.stop.map((word,i)=>({word,kind:'stop',i})),...g.user.map((word,i)=>({word,kind:'user',i}))].filter(x=>x.word.includes(query));
 return modalFrame('我的词库','修改影响后续任务；历史任务保留当时词库与本次选择。','<div class="editor-toolbar"><input id="lexicon-search" placeholder="筛选词条" data-v2-input="lexicon-search" value="'+E(query)+'"><div class="row">'+B('添加词条','v2-lex-add','sm')+B('导入词表','v2-lex-import','sm')+B('导出词表','v2-lex-export','sm')+'</div></div><div class="lexicon-table">'+simpleTable(['类型','词语','操作'],all.map(r=>['<select aria-label="词条类型" data-v2-lex-kind="'+r.kind+'" data-index="'+r.i+'"><option value="stop" '+(r.kind==='stop'?'selected':'')+'>停用词</option><option value="user" '+(r.kind==='user'?'selected':'')+'>专有词</option></select>','<input aria-label="词条 '+E(r.word)+'" data-edit="'+r.kind+'.'+r.i+'" value="'+E(r.word)+'">',A('删除','v2-lex-delete','data-kind="'+r.kind+'" data-index="'+r.i+'"')]),true)+'</div><div id="editor-error" class="error"></div>',B('取消','close-modal')+B('保存词库','v2-save-editor','primary'),'medium');}
function wordSelectionModal(){const c=currentConfig(),locked=isLocked(),t=currentTask();return modalFrame('本次用词选择','从个人词库选择本次生效内容。修改个人词库不会改写历史任务。','<div class="editor-grid">'+[['stop','停用词',t?.stopwords||state.stopwords],['user','专有词',t?.newwords||state.newwords]].map(([k,n,arr])=>'<div><div class="row between"><h4>'+n+'</h4>'+(!locked?A('全选','v2-word-all','data-kind="'+k+'"')+A('清空','v2-word-none','data-kind="'+k+'"'):'')+'</div><div class="mt">'+arr.map(x=>'<label class="row-radio rule-row"><input type="checkbox" data-word-choice="'+k+'" value="'+E(x)+'" '+(editorDraft[k].includes(x)?'checked':'')+' '+(locked?'disabled':'')+'>'+E(x)+'</label>').join('')+'</div></div>').join('')+'</div>',B('取消','close-modal')+(locked?'':B('应用本次选择','v2-save-editor','primary')),'medium');}
modalContent=function(){
 switch(modal){
 case 'v2-stage':return stageEditor();
 case 'v2-fields':return fieldsEditor();
 case 'v2-rules':return rulesEditor();
 case 'v2-engineering':return mappingEditor(false);
 case 'v2-association':return mappingEditor(true);
 case 'v2-meeting-filter':return meetingFilterModal();
 case 'v2-lexicon':return lexiconModal();
 case 'v2-word-selection':return wordSelectionModal();
 case 'v2-config-json':return modalFrame('配置结构预览','查看本次分析的完整配置内容，可下载保存。','<pre class="config-json">'+E(JSON.stringify(configurationFragment(state.toolId,currentConfig()),null,2))+'</pre>',B('关闭','close-modal')+B('下载完整配置','v2-export-config','primary'),'medium');
 case 'v2-lex-import':return modalFrame('导入词表','每行一个词；先预览重复项，再决定处理方式。','<div class="editor-grid"><div><label class="field-label">导入类型</label><select id="lex-import-kind">'+options(['停用词','专有词'],modalData.kind)+'</select></div><div><label class="field-label">选择文本文件（可选）</label><input type="file" id="lex-file" accept=".txt,.csv,.json"></div></div><div class="field"><label>词表内容</label><textarea id="lex-import-text" class="w100" placeholder="一行一个词，或以逗号分隔" style="min-height:180px"></textarea></div>',B('取消','v2-return-lexicon')+B('预览导入','v2-lex-preview','primary'),'medium');
 case 'v2-lex-review':return modalFrame('词表导入预览','重复项可忽略或覆盖类型；取消不改动词库。','<div class="summary-strip">待导入 '+modalData.words.length+' 项；重复 '+modalData.duplicates.length+' 项</div><div class="field"><label>重复项处理</label><select id="lex-conflict"><option value="ignore">忽略重复项（保留原类型）</option><option value="overwrite">覆盖重复项（采用导入类型）</option></select></div><div class="mt">'+simpleTable(['词语','状态'],modalData.words.map(x=>[E(x),tag(modalData.duplicates.includes(x)?'重复':'新增',modalData.duplicates.includes(x)?'amber':'green')]),true)+'</div>',B('取消','v2-return-lexicon')+B('确认导入暂存清单','v2-lex-commit','primary'),'medium');
 case 'v2-template-import':return modalFrame('导入个人模板','导入本导出的 JSON；先验证工具类型、版本和配置，不覆盖已有模板。','<label class="field-label">选择配置文件</label><input type="file" id="template-import-file" accept=".json"><div class="field"><label>模板 JSON</label><textarea id="template-import-json" class="w100" style="min-height:230px"></textarea></div><div id="editor-error" class="error"></div>',B('取消','close-modal')+B('验证并导入为个人模板','v2-template-import-save','primary'),'medium');
 default:return baseV1.modalContent();
 }
};
function draftOpen(kind,draft,data={}){editorDraft=structuredClone(draft);openModal(kind,data);}
function checkDraft(){
 const c=structuredClone(currentConfig()),id=state.toolId;
 if(modal==='v2-fields'){
  if(!editorDraft.length||editorDraft.some(f=>!f.name.trim()||!f.description.trim()))return['字段名称与提取说明均需填写'];
  if(new Set(editorDraft.map(f=>f.name.trim())).size!==editorDraft.length)return['字段名称不能重复'];
 }
 if(modal==='v2-rules'){
  if(!editorDraft.length)return['至少保留一项'];
  if(id==='risk'){if(editorDraft.some(r=>!r.name.trim()||!r.path.trim()||!r.description.trim()))return['关注点名称、路径和说明需填写'];if(new Set(editorDraft.map(r=>r.name)).size!==editorDraft.length)return['关注点名称不能重复'];}
  else{if(editorDraft.some(r=>[r.title,r.description,r.laws,r.judgment].some(v=>!v.trim())))return['请填写规则名称、描述、依据和判断标准'];if(new Set(editorDraft.map(r=>r.title)).size!==editorDraft.length)return['规则名称不能重复'];try{editorDraft.filter(r=>r.format==='completeness').forEach(r=>{const val=JSON.parse(r.expected);if(!val||typeof val!=='object'||Array.isArray(val))throw Error();});}catch{return['完备性提取内容应为合法 JSON 对象'];}}
 }
 if(modal==='v2-stage'&&Object.values(editorDraft).some(s=>!s.content.trim()))return['提示词内容不能为空'];
 if(modal==='v2-engineering'||modal==='v2-association'){
  if(modal==='v2-engineering')c.engineering[modalData.kind]=editorDraft;else c.association=editorDraft;
  return configurationIssues(id,c,ws()).filter(x=>!x.includes('未对应的列')); // Full file-header validation also runs on Execute.
 }
 return[];
}
function commitEditor(){
 const errors=checkDraft();if(errors.length){$('#editor-error').textContent=errors.join('；');return;}
 const w=ws(),c=w.config;
 if(modal==='v2-stage'){c.stages=structuredClone(editorDraft);Object.values(c.stages).forEach(s=>s.customized=true);c.prompt=c.stages[selectedStages()[0][0]].content;}
 if(modal==='v2-fields'){c.fieldDefs=editorDraft.map(f=>({name:f.name.trim(),description:f.description.trim()}));c.fields=c.fieldDefs.map(f=>f.name);}
 if(modal==='v2-rules'){if(state.toolId==='risk'){c.riskNodes=structuredClone(editorDraft);c.checks=c.riskNodes.map(r=>r.name);}else{c.contractRules=structuredClone(editorDraft);c.checks=c.contractRules.filter(r=>r.enabled).map(r=>r.title);}}
 if(modal==='v2-engineering')c.engineering[modalData.kind]=structuredClone(editorDraft);
 if(modal==='v2-association')c.association=structuredClone(editorDraft);
 if(modal==='v2-word-selection')c.lexiconSelection=structuredClone(editorDraft);
 if(modal==='v2-lexicon'){
  const stop=editorDraft.stop.map(x=>x.trim()).filter(Boolean),user=editorDraft.user.map(x=>x.trim()).filter(Boolean);
  if(stop.some(x=>user.includes(x))){$('#editor-error').textContent='同一个词不能同时属于停用词与专有词，请删除冲突项。';return;}
  state.stopwords=[...new Set(stop)];state.newwords=[...new Set(user)];
 }
 if(modal==='v2-meeting-filter'){
  const f=editorDraft;
  if(f.from&&f.to&&f.from>f.to){$('#editor-error').textContent='开始日期不能晚于结束日期';return;}
  if(f.min!==''&&f.max!==''&&+f.min>+f.max){$('#editor-error').textContent='最小金额不能大于最大金额';return;}
  if(f.regex&&f.keywords){try{safePattern(f.keywords);}catch(e){$('#editor-error').textContent=e.message;return;}}
  currentTask().meetingFilters=structuredClone(f);
 }
 closeModal();render();toast('已保存并应用。');
}
function safePattern(s){if(s.length>120||/[()[\]{}+?\\]/.test(s)||/\*{2,}|[^.]\*/.test(s))throw Error('支持文字、.、.*、^、$ 和 |，最多120字符。');return new RegExp(s,'i');}
const lexBuffer={data:null};
handleAction=function(action,el){
 const w=ws(),c=currentConfig(),id=el?.dataset.id,index=+el?.dataset.index;
 switch(action){
 case 'prompt':case 'v2-stage':{
  const key=el?.dataset.stage||selectedStages()[0]?.[0];if(!key)return;
  draftOpen('v2-stage',c.stages,{stage:key});return;
 }
 case 'v2-stage-tab':modalData.stage=el.dataset.stage;paintModal();return;
 case 'v2-stage-reset':{const key=modalData.stage,def=PROMPT_STAGES[state.toolId].find(x=>x[0]===key);editorDraft[key]={template:def[3],content:'请依据所选资料完成'+def[1]+'，保留原文来源，明确未提取到和需进一步核验的内容。',functionType:def[2],origin:'system',customized:false};paintModal();return;}
 case 'v2-save-stage-template':{
  const key=modalData.stage,st=editorDraft[key],name=st.template+' · 我的版本 '+(state.templates.length+1);
  state.templates.push({id:'personal-'+Date.now(),toolId:state.toolId,name,prompt:st.content,stage:key,config:{...structuredClone(w.config),stages:structuredClone(editorDraft)},version:1});persist();toast('已保存为个人模板：'+name);return;
 }
 case 'edit-fields':draftOpen('v2-fields',c.fieldDefs);return;
 case 'v2-add-field':editorDraft.push({name:'',description:''});paintModal();return;
 case 'v2-delete-field':editorDraft.splice(index,1);paintModal();return;
 case 'v2-rules':draftOpen('v2-rules',state.toolId==='risk'?c.riskNodes:c.contractRules);return;
 case 'v2-add-rule':editorDraft.push(state.toolId==='risk'?{id:'r'+Date.now(),name:'',path:'自定义关注点',description:''}:{title:'',description:'',laws:'',judgment:'',format:'compliance',expected:'',enabled:true});paintModal();return;
 case 'v2-delete-rule':editorDraft.splice(index,1);paintModal();return;
 case 'v2-engineering':draftOpen('v2-engineering',c.engineering[el.dataset.kind],{kind:el.dataset.kind});return;
 case 'v2-association':draftOpen('v2-association',c.association);return;
 case 'v2-add-mapping':{const n=Math.max(0,...editorDraft.rows.map(r=>+(r.key.slice(1))||0))+1;editorDraft.rows.push({key:'F'+n,name:'',a:'请选择',b:'请选择',type:'similarity',threshold:.8,weight:0,rule:''});paintModal();return;}
 case 'v2-delete-mapping':{const key=editorDraft.rows[index].key;editorDraft.rows.splice(index,1);if(editorDraft.hardRules)editorDraft.hardRules=editorDraft.hardRules.filter(r=>!(r.logic==='and'?r.rules:[r]).some(q=>q.field===key));paintModal();toast('已移除字段；引用该字段的硬规则同步移除。保存前可取消。');return;}
 case 'v2-hard-reset':{const t=state.templates.find(t=>t.name===c.template&&t.toolId===state.toolId);const defaults=t?.config?.association?.hardRules;if(!defaults?.length){toast('当前方案未配置硬规则，无法恢复。');return;}editorDraft.hardRules=structuredClone(defaults);paintModal();toast('已恢复所选方案的规则；保存前可取消。');return;}
 case 'v2-hard-add':{const q={field:editorDraft.rows[0]?.key||'',condition:'match'};editorDraft.hardRules.push({...(el.dataset.kind==='and'?{logic:'and',rules:[{...q},{...q}]}:q),result:'full_match',priority:0,message:''});paintModal();return;}
 case 'v2-hard-delete':editorDraft.hardRules.splice(index,1);paintModal();return;
 case 'v2-hard-sub':editorDraft.hardRules[index].rules.push({field:editorDraft.rows[0]?.key||'',condition:'match'});paintModal();return;
 case 'v2-hard-sub-delete':if(editorDraft.hardRules[index].rules.length>1)editorDraft.hardRules[index].rules.splice(+el.dataset.sub,1);paintModal();return;
 case 'v2-save-editor':if(!isLocked()||['v2-lexicon','v2-meeting-filter'].includes(modal))commitEditor();return;
 case 'meeting-filter':draftOpen('v2-meeting-filter',currentTask().meetingFilters||{participants:'',keywords:'',from:'',to:'',min:'',max:'',regex:false});return;
 case 'v2-reset-meeting-filter':currentTask().meetingFilters=null;closeModal();render();return;
 case 'clear-result':if(currentTask())currentTask().meetingFilters=null;break;
 case 'lexicon':draftOpen('v2-lexicon',{stop:[...state.stopwords],user:[...state.newwords]},{query:''});return;
 case 'v2-lex-add':editorDraft.user.push('');paintModal();return;
 case 'v2-lex-delete':editorDraft[el.dataset.kind].splice(index,1);paintModal();return;
 case 'v2-lex-export':download('我的词库.json',JSON.stringify(editorDraft,null,2),'application/json;charset=utf-8');return;
 case 'v2-lex-import':lexBuffer.data=structuredClone(editorDraft);openModal('v2-lex-import',{kind:'停用词'});return;
 case 'v2-return-lexicon':draftOpen('v2-lexicon',lexBuffer.data,{query:''});return;
 case 'v2-lex-preview':{const kind=$('#lex-import-kind').value==='停用词'?'stop':'user',words=[...new Set($('#lex-import-text').value.split(/[\n,，\r]+/).map(x=>x.trim()).filter(Boolean))];if(!words.length){toast('请先输入或选择词表。');return;}if(words.length>10000){toast('一次最多预览10000条词。');return;}const duplicates=words.filter(x=>lexBuffer.data.stop.includes(x)||lexBuffer.data.user.includes(x));openModal('v2-lex-review',{kind,words,duplicates});return;}
 case 'v2-lex-commit':{const {kind,words,duplicates}=modalData,overwrite=$('#lex-conflict').value==='overwrite';words.forEach(x=>{if(duplicates.includes(x)&&!overwrite)return;if(overwrite){lexBuffer.data.stop=lexBuffer.data.stop.filter(y=>y!==x);lexBuffer.data.user=lexBuffer.data.user.filter(y=>y!==x);}lexBuffer.data[kind].push(x);});draftOpen('v2-lexicon',lexBuffer.data,{query:''});toast('已加入暂存清单，保存词库后生效。');return;}
 case 'v2-word-selection':draftOpen('v2-word-selection',{stop:[...(currentTask()?.stopwords||c.lexiconSelection.stop||state.stopwords)],user:[...(currentTask()?.newwords||c.lexiconSelection.user||state.newwords)]});return;
 case 'v2-word-all':editorDraft[el.dataset.kind]=[...(el.dataset.kind==='stop'?state.stopwords:state.newwords)];paintModal();return;
 case 'v2-word-none':editorDraft[el.dataset.kind]=[];paintModal();return;
 case 'v2-config-json':openModal('v2-config-json');return;
 case 'v2-export-config':download(tool(state.toolId).name+'-模板配置.json',JSON.stringify({schemaVersion:2,toolId:state.toolId,name:c.template,prompt:c.prompt,config:c,notice:'分析模板配置'},null,2),'application/json;charset=utf-8');return;
 case 'v2-template-import':openModal('v2-template-import');return;
 case 'v2-template-import-save':importTemplate();return;
 case 'use-template':{const t=getTemplate(id);if(t&&!t.system){const target=ws(t.toolId);if(t.config)target.config=structuredClone(t.config);seedConfig(t.toolId,target.config);target.config.template=t.name;target.config.prompt=t.prompt;target.taskId=null;target.tab='preview';closeModal();nav('tool',t.toolId);return;}break;}
 case 'calculate-fee':if(currentTask().config.feeType!==EXPENSE_TYPES[0]){toast('请先确认所选费用类型的合同计费约定。');return;}break;
 }
 return baseV1.handleAction(action,el);
};
function setPath(obj,path,value){const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return;let node=obj;for(const k of keys.slice(0,-1)){if(node[k]===undefined)return;node=node[k];}node[keys.at(-1)]=value;}
document.addEventListener('input',e=>{
 const el=e.target;if(el.dataset.edit&&editorDraft){setPath(editorDraft,el.dataset.edit,el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?'':+el.value):el.value);}
 if(el.dataset.v2Input==='lexicon-search'){modalData.query=el.value;paintModal();}
});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.dataset.v2LexKind){const old=el.dataset.v2LexKind,i=+el.dataset.index;if(old!==el.value){editorDraft[el.value].push(editorDraft[old][i]);editorDraft[old].splice(i,1);paintModal();}return;}
 if(el.dataset.edit&&editorDraft){setPath(editorDraft,el.dataset.edit,el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?'':+el.value):el.value);}
 if(el.dataset.wordChoice){const k=el.dataset.wordChoice;editorDraft[k]=el.checked?[...new Set([...editorDraft[k],el.value])]:editorDraft[k].filter(x=>x!==el.value);}
 if(el.dataset.v2Change==='stage-template'&&el.value){const key=modalData.stage;if(el.value==='default'){handleAction('v2-stage-reset',el);}else{const t=state.templates.find(t=>t.id===el.value);editorDraft[key]={...editorDraft[key],content:t.config?.stages?.[key]?.content||t.prompt,template:t.name,origin:'personal'};paintModal();}}
 if(el.id==='lex-file'&&el.files[0]){if(el.files[0].size>2*1024*1024){toast('词表导入上限2MB。');return;}const raw=await el.files[0].text();if(el.files[0].name.endsWith('.json')){try{const x=JSON.parse(raw);if(!Array.isArray(x.stop)||!Array.isArray(x.user)||[...x.stop,...x.user].some(v=>typeof v!=='string'))throw Error();draftOpen('v2-lexicon',{stop:[...new Set([...lexBuffer.data.stop,...x.stop])],user:[...new Set([...lexBuffer.data.user,...x.user])]},{query:''});toast('JSON词库已合并到暂存清单，保存前请核对冲突。');}catch{toast('词库JSON格式不正确。');}}else $('#lex-import-text').value=raw;}
 if(el.id==='template-import-file'&&el.files[0]){if(el.files[0].size>2*1024*1024){toast('模板导入上限2MB。');return;}$('#template-import-json').value=await el.files[0].text();}
});
function importTemplate(){
 try{
  const raw=$('#template-import-json').value,doc=JSON.parse(raw);
  if(/"(__proto__|constructor|prototype)"\s*:/.test(raw))throw Error('配置包含不允许的属性');
  if(doc.schemaVersion!==2||!tool(doc.toolId)||!doc.config||typeof doc.config!=='object'||!doc.name)throw Error('需要版本2、有效工具与完整配置');
  const cfg=validateImportedConfig(doc.toolId,doc.config);if(!cfg.stages||!cfg.fieldDefs||!cfg.engineering||!cfg.association||!Array.isArray(cfg.checks))throw Error('配置结构不完整，请使用导出的文件');
  const name=doc.name+' · 导入 '+(state.templates.length+1);
  state.templates.push({id:'personal-'+Date.now(),toolId:doc.toolId,name,prompt:doc.prompt||'',config:structuredClone(cfg),version:1});
  persist();closeModal();render();toast('已导入个人模板，不覆盖已有内容。');
 }catch(e){$('#editor-error').textContent='导入失败：'+e.message;}
}
templatesPage=function(){let html=baseV1.templatesPage();html=html.replace(B(I('plus')+'新建个人模板','new-template','primary'),'<div class="row">'+B('导入配置','v2-template-import')+B(I('plus')+'新建个人模板','new-template','primary')+'</div>');state.templates.forEach(t=>{html=html.replace(A('删除','delete-template','data-id="'+t.id+'"'),'<div class="row">'+B('使用','use-template','sm','data-id="'+t.id+'"')+A('删除','delete-template','data-id="'+t.id+'"')+'</div>');});return html;};
validate=function(show=true){
 const c=ws().config,w=ws(),id=state.toolId;
 let errors=baseV1.validate(false);
 if(['engineering','association'].includes(id))errors=errors.filter(e=>!e.includes('字段对应')&&!e.includes('候选上限')&&!e.includes('各字段权重')&&!e.includes('完全关联阈值')&&!e.includes('名称权重'));
 errors=[...new Set([...errors,...configurationIssues(id,c,w)])];
 if(show&&errors.length)openModal('validation',{errors});
 return errors;
};
run=function(retry){
 if(!retry&&validate().length)return;
 const w=ws(),c=w.config;
 c.contractRules?.forEach(r=>r.enabled=c.checks.includes(r.title));
 if(state.toolId==='association'){c.threshold=c.association.partial;c.perfectThreshold=c.association.full;c.cap=c.association.perRow;c.matchMode=c.association.mode;}
 baseV1.run(retry);
 const task=currentTask();if(task){if(!retry){if(c.taskName.trim())task.name=c.taskName.trim();task.notes=[c.taskNotes,c.auditObjective?'审计关注：'+c.auditObjective:''].filter(Boolean).join('\n');task.stopwords=[...(c.lexiconSelection.stop||state.stopwords)];task.newwords=[...(c.lexiconSelection.user||state.newwords)];}task.configFragment=configurationFragment(task.toolId,task.config);persist();render();}
};
makeResult=function(task){
 const result=baseV1.makeResult(task.toolId==='engineering'?{...task,config:{...task.config,threshold:0}}:task);
 if(task.toolId==='engineering')return result.filter(r=>r.score>=task.config.engineering[r.kind==='parent'?'parent':'duplicate'].threshold);
 if(task.toolId==='contract')return result.map(r=>{const rule=task.config.contractRules.find(q=>q.title===r.check);return {...r,criteria:rule?.laws||'本次模板未提供依据',judgmentRule:rule?.judgment||'未提供',analysis:r.detail};});
 return result;
};
meetingResults=function(task){
 const f=task.meetingFilters;let filtered=task.result;
 if(f)filtered=filtered.filter(r=>{
  if(f.participants&&!f.participants.split('|').filter(Boolean).some(p=>(r.participants||'').includes(p.trim())))return false;
  if(f.from&&r.date<f.from||f.to&&r.date>f.to)return false;
  const n=parseFloat(r.amount);if((f.min!==''||f.max!=='')&&!Number.isFinite(n))return false;
  if(f.min!==''&&n<+f.min||f.max!==''&&n>+f.max)return false;
  const txt=r.topic+' '+r.excerpt;
  return !f.keywords||(f.regex?safePattern(f.keywords).test(txt):txt.includes(f.keywords));
 });
 if(ws().subtab!=='regular')return baseV1.meetingResults(task);
 const banner=f?'<div class="selectionbar mb"><span>会议筛选已应用 · '+filtered.length+' 条议题</span><div class="row">'+A('调整筛选','meeting-filter')+A('清除','v2-reset-meeting-filter')+'</div></div>':'';
 if(!filtered.length&&f)return banner+'<div class="card">'+noResult()+'</div>';
 return banner+baseV1.meetingResults({...task,result:filtered}).replace(/data-action="meeting-detail" data-index="(\d+)"/g,(_,i)=>'data-action="meeting-detail" data-index="'+task.result.indexOf(filtered[+i])+'"');
};
resultDetailModal=function(index){
 const t=currentTask(),r=t.result[index];let html=baseV1.resultDetailModal(index);
 const context='<div class="review-context">'+tag('核验上下文','blue')+'<span>'+E(t.config.auditObjective||'本次审计关注未填写')+'</span></div>';
 html=html.replace('<div class="modalbody">','<div class="modalbody">'+context);
 if(t.toolId==='contract'){html=html.replace('<h4>分析说明 / 判断依据</h4>','<h4>分析说明</h4>');html=html.replace('<h4 class="mt">核验来源</h4>','<div class="quote-card"><h4>本次规则依据</h4><p>'+E(r.criteria||'未提供')+'</p><h4 class="mt">判断标准</h4><p>'+E(r.judgmentRule||'未提供')+'</p></div><h4 class="mt">核验来源</h4>');}
 return html;
};
// Retain expanded advanced sections and scroll position while adding/removing rows.
const originalPaintModal=paintModal;
paintModal=function(focus=false){
 const opened=$$('.modal details').map(d=>d.open),top=$('.modalbody')?.scrollTop||0;
 originalPaintModal(focus);
 if(!focus){$$('.modal details').forEach((d,i)=>{if(i<opened.length)d.open=opened[i];});const body=$('.modalbody');if(body)body.scrollTop=top;}
};
saveTemplate=function(){
 const editing=modalData.template, name=$('#template-name').value.trim(),prompt=$('#template-prompt').value.trim(),tid=$('#template-tool').value;
 baseV1.saveTemplate();
 if(modal)return;
 const saved=state.templates.find(t=>t.id===editing?.id)||state.templates.find(t=>t.name===name&&t.toolId===tid);
 if(saved){if(!saved.config)saved.config=structuredClone(ws(tid).config);seedConfig(tid,saved.config);saved.config.prompt=prompt;const key=saved.stage||PROMPT_STAGES[tid]?.[0]?.[0];if(key&&saved.config.stages[key])saved.config.stages[key]={...saved.config.stages[key],content:prompt,template:name,origin:'personal',customized:true};persist();}
};
const baseSource=sourceLink;
sourceLink=function(id,label){return baseSource(id,label);};
// Preserve original headings and routes, collapse repeated explanatory chrome.
const baseRender=render;
render=function(){baseRender();document.body.classList.toggle('work-view',state.view==='tool');};
render();

function requestTemplateSwitch(e){
 const el=e.target;if(el.dataset.config!=='template'||isLocked())return;
 e.stopImmediatePropagation();
 if(e.type==='input')return;
 const name=el.value;el.value=ws().config.template;
 if(name===ws().config.template)return;
 openModal('v2-switch-template',{name});
}
document.addEventListener('input',requestTemplateSwitch,true);
document.addEventListener('change',requestTemplateSwitch,true);
const modalBeforeSwitch=modalContent;
modalContent=function(){if(modal==='v2-switch-template')return modalFrame('应用分析方案','替换当前工作区配置；已执行任务不受影响。','<p>应用「'+E(modalData.name)+'」后，将替换提示词、字段和分析参数。当前配置可先取消并另存为个人模板。</p>',B('取消','close-modal')+B('应用方案','v2-confirm-template','primary'),'medium');return modalBeforeSwitch();};
const actionBeforeSwitch=handleAction;
handleAction=function(action,el){if(action==='v2-confirm-template'){
 const name=modalData.name,t=state.templates.find(t=>t.name===name&&t.toolId===state.toolId),w=ws();
 if(t){w.config=structuredClone(t.config||w.config);seedConfig(state.toolId,w.config);w.config.prompt=t.prompt;}else{const old=state.work[state.toolId];delete state.work[state.toolId];const defaults=structuredClone(ws().config);state.work[state.toolId]=old;w.config=defaults;}
 w.config.template=name;closeModal();render();toast('分析方案已应用。');return;
 }return actionBeforeSwitch(action,el);};
