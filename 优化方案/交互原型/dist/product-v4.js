'use strict';
// Presentation preferences are independent from analysis configuration and task snapshots.
const productBase={sidebar,topbar,render,modalContent,handleAction,loadSample,preparation,configPanel,mappingEditor,commitEditor,prepaidResults,makeResult,doExport,uploadModal};
let navCollapsed=localStorage.getItem('audit-nav-collapsed')==='true';
const legacyNames=[['示例建设单位','园区建设中心'],['示例设备公司','华辰设备有限公司'],['示例监理公司','明达工程监理有限公司'],['示例青禾公司','青禾设备有限公司'],['示例远川公司','远川设备有限公司'],['示例机构','市审计局'],['（示例）',''],['虚构示例',''],['系统演示模板','系统模板'],['演示任务','任务'],['虚构',''],['原型',''],['演示',''],['示例','']];
function migrateCopy(value){if(typeof value==='string')return legacyNames.reduce((s,[a,b])=>s.replaceAll(a,b),value);if(Array.isArray(value))return value.map(migrateCopy);if(value&&typeof value==='object'){Object.keys(value).forEach(k=>value[k]=migrateCopy(value[k]));}return value;}
if(!localStorage.getItem('audit-product-copy-v4')){migrateCopy(state);try{localStorage.setItem('audit-product-copy-v4','1');}catch{}}
sidebar=function(){const el=document.createElement('div');el.innerHTML=productBase.sidebar();const side=el.firstElementChild;side.id='primary-sidebar';side.querySelector('.brand').insertAdjacentHTML('afterend','<button class="sidebar-toggle" data-action="toggle-sidebar" aria-controls="primary-sidebar" aria-expanded="'+!navCollapsed+'" title="'+(navCollapsed?'展开菜单':'折叠菜单')+'" aria-label="'+(navCollapsed?'展开左侧菜单':'折叠左侧菜单')+'">'+I(navCollapsed?'chevron':'back')+'<span class="nav-label">折叠菜单</span></button>');const user=side.querySelector('.user');if(user)user.innerHTML='<span class="avatar">审</span><div>审计工作空间<small class="muted" style="display:block;margin-top:4px">文档分析与核验</small></div>';return el.innerHTML;};
topbar=function(){return B(I('menu'),'mobile-nav','embedded-mobile-nav','aria-label="打开工作台导航" title="工作台导航"');};
render=function(){productBase.render();$('.shell')?.classList.toggle('nav-collapsed',navCollapsed);$('.shell')?.classList.toggle('nav-expanded',!navCollapsed);};
preparation=function(){const el=document.createElement('div');el.innerHTML=productBase.preparation();el.querySelectorAll('[data-action="sample"]').forEach(b=>{b.dataset.action='picker';b.textContent='选择资料';});return el.innerHTML;};
loadSample=function(){productBase.loadSample();toast('已添加资料，请确认分析要求。');};
modalContent=function(){if(modal==='help')return modalFrame('操作指引','11项工具 · 从资料到分析依据','<div class="column"><div class="review-card"><strong>1　添加资料</strong><p>在资料管理选择文件或目录后进入工具，也可以在工具中添加。目录可选仅本级或包含子文件夹。</p></div><div class="review-card"><strong>2　配置分析</strong><p>选择模板并核对字段、关注点、材料归属或比较规则。提示词可编辑并另存为个人模板，右上角执行分析。</p></div><div class="review-card"><strong>3　核验结果</strong><p>通过原文、依据和源行核验分析结果。筛选只影响展示，任务中心保留执行配置与历史结果。</p></div></div>',B('关闭','close-modal','primary'),'medium');let html=productBase.modalContent();if(modal==='export')html=html.replace('<option value="csv">','<option value="xlsx">Excel · 表格明细</option><option value="markdown">Markdown · 可编辑表格</option><option value="csv">');return html;};
mappingEditor=function(two){let html=productBase.mappingEditor(two);if(two&&!isLocked())html=html.replace(B(I('plus')+'新增比较字段','v2-add-mapping','sm'),'<div class="row">'+B('恢复模板字段','v4-reset-mapping','sm')+B(I('plus')+'新增比较字段','v2-add-mapping','sm')+'</div>');return html;};
handleAction=function(action,el){if(action==='toggle-sidebar'){navCollapsed=!navCollapsed;localStorage.setItem('audit-nav-collapsed',String(navCollapsed));render();$('.sidebar-toggle')?.focus();return;}if(action==='v4-reset-mapping'){const t=state.templates.find(t=>t.name===currentConfig().template&&t.toolId===state.toolId);editorDraft.rows=structuredClone(t?.config?.association?.rows||newMappingRows(true));editorDraft.hardRules=structuredClone(t?.config?.association?.hardRules||[]);paintModal();toast('已恢复模板字段；保存前可取消。');return;}return productBase.handleAction(action,el);};
// Choosing a prompt template must also restore its tool-specific configuration.
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.v2Change==='stage-template'&&el.value&&el.value!=='default'){const t=state.templates.find(t=>t.id===el.value);if(t?.config){modalData.stageConfigChanges??={};modalData.stageConfigChanges[modalData.stage]=structuredClone(t.config);}}});
commitEditor=function(){const mode=modal,changes=modalData.stageConfigChanges;productBase.commitEditor();if(!modal&&mode==='v2-stage'&&changes){const c=ws().config;Object.entries(changes).forEach(([stage,cfg])=>{if(state.toolId==='risk'){c.riskNodes=structuredClone(cfg.riskNodes);c.checks=structuredClone(cfg.checks);}if(state.toolId==='contract'&&stage==='compliance'){c.contractRules=structuredClone(cfg.contractRules);c.checks=structuredClone(cfg.checks);}if(state.toolId==='engineering')c.engineering[stage]=structuredClone(cfg.engineering[stage]);if(state.toolId==='association')c.association=structuredClone(cfg.association);});render();}};
doExport=function(){const t=currentTask(),format=$('#export-format').value,scope=$('#export-scope').value;if(format==='xlsx'){const rows=exportRows(t,scope),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'分析明细');XLSX.writeFile(wb,tool(t.toolId).name+'-分析结果.xlsx');closeModal();return;}if(format==='markdown'){const rows=exportRows(t,scope),cell=v=>String(typeof v==='object'?JSON.stringify(v):v??'').replaceAll('|','\\|').replaceAll('\n','<br>');download(tool(t.toolId).name+'-分析结果.md',[rows[0],rows[0].map(()=>'---'),...rows.slice(1)].map(row=>'| '+row.map(cell).join(' | ')+' |').join('\n'),'text/markdown;charset=utf-8');closeModal();return;}productBase.doExport();};
// Each fee type has its own negotiated contract clause. These are not tariff standards.
const feeClauses=[{id:'d9',type:EXPENSE_TYPES[0],rate:.015,name:'园区监理服务合同'},{id:'fee-design',type:EXPENSE_TYPES[1],rate:.018,name:'园区工程设计服务合同'},{id:'fee-management',type:EXPENSE_TYPES[2],rate:.008,name:'园区代建管理合同'},{id:'fee-cost',type:EXPENSE_TYPES[3],fixed:120000,name:'园区造价咨询服务合同'},{id:'fee-survey',type:EXPENSE_TYPES[4],fixed:85000,name:'园区勘察测绘合同'},{id:'fee-bidding',type:EXPENSE_TYPES[5],fixed:48000,name:'园区招标代理合同'}];
feeClauses.forEach(f=>{const clause=f.rate?'费用按双方确认的计费基数的'+(f.rate*100).toFixed(1)+'%计取。':'费用采用固定总价人民币'+f.fixed+'元，不随计费基数调整。';if(!file(f.id))state.docs.push({id:f.id,name:f.name+'.pdf',title:f.name,type:'PDF',space:'项目空间',folder:'合同资料/服务费用',date:'2026-01-25',size:'1.2 MB',unit:'园区建设中心',topic:f.type,amount:'按合同约定计算',text:'园区建设中心与受托服务单位签订'+f.name+'。\n合同约定：'+clause+'\n计费基数与结算资料应经双方确认，最终支付须核对合同履约及审批记录。'});file(f.id).billing={...f,clause};});
const feeSampleBase=loadSample;
loadSample=function(){if(state.toolId==='prepaid'){const w=ws(),f=feeClauses.find(f=>f.type===w.config.feeType);w.ids=[f.id];w.preview=f.id;w.taskId=null;w.tab='preview';render();toast('已添加合同，请确认计费约定。');return;}feeSampleBase();};
makeResult=function(task){const rows=productBase.makeResult(task);if(task.toolId==='prepaid'){const d=selectedDocs(task.successIds)[0];task.billing=structuredClone(d?.billing||null);return rows.map(r=>({...r,excerpt:file(r.doc)?.billing?.clause||r.excerpt}));}return rows;};
prepaidResults=function(task){const b=task.billing;let html=productBase.prepaidResults(task).replace('工程监理服务费',E(task.config.feeType));if(b){html=html.replace('工程计费基数','计费基数');const expression=b.rate?Number(task.base||0).toLocaleString()+' 元 × '+(b.rate*100).toFixed(1)+'% = '+Number(task.fee||0).toLocaleString()+' 元':'合同固定总价：'+Number(b.fixed).toLocaleString()+' 元';if(task.fee!=null)html=html.replace(/<p class="hint">[^<]* 元 × 1\.5% = [^<]*<\/p>/,'<p class="hint">'+expression+'</p>');}return html;};
const feeActionBase=handleAction;
handleAction=function(action,el){if(action==='calculate-fee'){const task=currentTask(),num=+task.base;if(!Number.isFinite(num)||num<=0||num>1e13){toast('请填写有效计费基数，单位元。');return;}if(!task.billing){toast('未提取到完整计费约定，请核对合同。');return;}if(task.billing.type!==task.config.feeType){toast('所选费用类型与合同计费约定不一致，请核对资料。');return;}if(task.calculating)return;task.calculating=true;render();setTimeout(()=>{task.fee=Math.round((task.billing.rate?num*task.billing.rate:task.billing.fixed)*100)/100;task.calculating=false;task.status='completed';task.phase='费用计算报告已生成';persist();render();toast('费用计算完成，已保留合同约定与基数。');},650);return;}return feeActionBase(action,el);};
render();
// Supported uploads retain the selected folder, parse content, and become selectable when ready.
const uploadSources=new Map();
let pdfLibraryPromise;
async function parseSelectedFile(f){const ext=f.name.split('.').at(-1).toLowerCase();if(f.size>100*1024*1024)throw Error('文件不能超过100MB');
 if(['xlsx','xls','csv'].includes(ext)){const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true}),sheet=wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});if(!matrix.length)throw Error('表格为空');return{columns:matrix[0].map(String),rows:matrix.slice(1).filter(r=>r.some(x=>x!=='')),text:matrix.map(r=>r.join('　')).join('\n')};}
 if(ext==='docx'){const zip=XLSX.CFB.read(new Uint8Array(await f.arrayBuffer()),{type:'array'}),entry=zip.FileIndex.find(x=>x.name==='document.xml');if(!entry)throw Error('无法读取文档正文');const xml=new DOMParser().parseFromString(new TextDecoder().decode(entry.content),'application/xml'),parts=[...xml.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(x=>x.textContent).join(''));return{text:parts.join('\n')};}
 if(ext==='pdf'){pdfLibraryPromise??=import('./vendor/pdfjs/pdf.min.mjs');const pdfjs=await pdfLibraryPromise;pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',document.baseURI).href;const pdf=await pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise;try{if(pdf.numPages>300)throw Error('单次支持不超过300页');const pages=[];for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''));}const text=pages.join('\n\n');if(!text.trim())throw Error('未识别到文字，请先完成OCR识别');return{text,pages:pdf.numPages};}finally{await pdf.destroy();}}
 if(['txt','md','json'].includes(ext))return{text:await f.text()};throw Error('不支持此格式，请使用PDF、Word、Excel或文本文件');
}
function uploadRefresh(){persist();if(['upload','upload-records'].includes(modal))paintModal();else render();}
async function parseUploadRecord(record,doc,source){record.status='正在解析';record.progress=65;uploadRefresh();try{const parsed=await parseSelectedFile(source);if(!parsed.text?.trim())throw Error('文件中没有可识别的内容');Object.assign(doc,parsed,{local:false,parseError:null});record.status='可分析';record.progress=100;record.error=null;}catch(err){record.status='解析失败';record.error=err.message;doc.parseError=err.message;}uploadRefresh();}
uploadFiles=function(files){const arr=[...files];if(!arr.length)return;const space=state.space,parent=folderPath(state.folder);modalData.items??=[];arr.forEach((f,i)=>{const id='u'+Date.now()+'-'+i,relative=(f.relativePath||f.webkitRelativePath||f.name).split('/'),sub=relative.slice(0,-1).join('/'),path=typeof auditUploadTargetFolder==='function'?auditUploadTargetFolder(f,space,parent):[parent,sub].filter(Boolean).join('/'),record={id,name:f.name,relativePath:f.relativePath||f.webkitRelativePath||f.name,target:space+' / '+(path||'根目录'),time:new Date().toLocaleString('zh-CN'),status:'正在上传',progress:20},doc={id,name:f.name,type:f.name.split('.').at(-1).toUpperCase(),space,folder:path||'根目录',size:(f.size/1024).toFixed(1)+' KB',date:new Date().toISOString().slice(0,10),title:f.name.replace(/\.[^.]+$/,''),unit:'未提取到',amount:'未提取到',topic:'资料整理',local:true};state.uploads.unshift(record);state.docs.push(doc);modalData.items.push(record);uploadSources.set(id,f);setTimeout(()=>parseUploadRecord(record,doc,f),250);});uploadRefresh();};
uploadModal=function(){return modalFrame('上传资料','目标：'+E(state.space+' / '+(folderPath(state.folder)||'根目录')),'<label class="upload-zone" id="upload-drop">'+I('upload')+'<h3>拖入文件，或点击选择</h3><p>PDF、Word、Excel、CSV、文本 · 单文件不超过100MB</p><input type="file" multiple id="upload-input" accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json"></label><div class="row mt">'+B(I('folder')+'选择文件夹','upload-folder','sm')+'<input type="file" webkitdirectory multiple id="folder-input" hidden></div><div class="mt">'+(modalData.items||[]).map(u=>'<div class="upload-row"><div class="row between"><span>'+E(u.name)+'</span>'+tag(u.status,u.status==='解析失败'?'red':u.status==='可分析'?'green':'blue')+'</div><div class="bar"><i style="width:'+u.progress+'%"></i></div>'+(u.error?'<p class="hint">'+E(u.error)+'</p>':'')+(u.status==='解析失败'?A('重试解析','retry-upload','data-id="'+u.id+'"'):'')+'</div>').join('')+'</div>',B('关闭并保留记录','close-modal')+B('上传记录','upload-records','primary'),'medium');};
const productUploadAction=handleAction;
handleAction=function(action,el){if(action==='retry-upload'){const record=state.uploads.find(u=>u.id===el.dataset.id),source=uploadSources.get(el.dataset.id);if(record&&source)parseUploadRecord(record,file(record.id),source);else toast('请重新选择原文件后解析。');return;}return productUploadAction(action,el);};
const productDocPreview=documentPreview;
documentPreview=function(id,highlight=false){const d=file(id);if(d?.importedOnly)return '<div class="cardbody"><h3>'+E(d.name)+'</h3><p class="hint mt">此资料来自导入结果，尚未关联原始文件。请补充原文后核验。</p></div>';return productDocPreview(id,highlight);};
// Spreadsheet and native meeting payload imports share validation and explicit source handling.
function normalizeMeetingImport(raw){if(raw?.results&&raw?.config)return raw;if(!Array.isArray(raw?.meetings))throw Error('缺少会议与议题数据');const sources=[],results=[];
 raw.meetings.forEach((m,i)=>{let doc=file(String(m.source_document_id||''))||state.docs.find(d=>d.name===m.source_file_name);if(!doc){doc={id:'import-source-'+Date.now()+'-'+i,name:m.source_file_name||String(m.meeting_name||'会议')+'.docx',title:m.meeting_name||'会议',type:'DOCX',folder:'导入会议结果',space:state.space,size:'—',date:String(m.meeting_date||''),unit:'未提取到',amount:'未提取到',topic:'会议事项',importedOnly:true};sources.push(doc);}const people=Array.isArray(m.attendees)?m.attendees.join('|'):String(m.attendees||'未提取到');(m.topics||[]).forEach((t,j)=>results.push({doc:doc.id,title:String(m.meeting_name||doc.title),date:String(m.meeting_date||''),topic:String(t.topic_name||'未归类议题'),excerpt:String(t.topic_content||''),amount:String(t.topic_money??'未提取到'),participants:people,agenda:j+1}));});
 return{task:'会议结果导入',config:structuredClone(ws().config),results,newSources:sources};
}
document.addEventListener('change',async e=>{if(e.target.id!=='meeting-import-file')return;e.stopImmediatePropagation();const f=e.target.files[0],context=modalData;if(!f)return;try{if(f.size>10*1024*1024)throw Error('文件不能超过10MB');let data;
 if(/\.xlsx$/i.test(f.name)){const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});const records=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:false});if(records[0]?.doc){data={task:f.name.replace(/\.xlsx$/i,''),config:structuredClone(ws().config),results:records.map(r=>({...r,agenda:+r.agenda}))};}else{const groups=new Map();records.forEach(r=>{const title=r['会议名称']||r.meeting_name,key=String(title||'');if(!key)throw Error('工作表缺少“会议名称”列');if(!groups.has(key))groups.set(key,{meeting_name:key,meeting_date:r['会议日期']||r.meeting_date,attendees:r['参会人员']||r.attendees,source_file_name:r['来源文件']||r.source_file_name,topics:[]});groups.get(key).topics.push({topic_name:r['议题名称']||r.topic_name,topic_content:r['议题内容']||r.topic_content,topic_money:r['涉及金额']||r.topic_money});});data=normalizeMeetingImport({meetings:[...groups.values()]});}}
 else{const text=await f.text();if(/"(__proto__|constructor|prototype)"\s*:/.test(text))throw Error('文件包含无效属性');data=normalizeMeetingImport(JSON.parse(text));}
 if(!data.results?.length||data.results.length>10000)throw Error('议题数量需为1至10000条');validateImportedConfig('meeting',data.config);const ids=new Set([...state.docs,...(data.newSources||[])].map(d=>d.id));if(data.results.some(r=>!ids.has(r.doc)||['title','date','topic','excerpt','amount','participants'].some(k=>typeof r[k]!=='string')||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isInteger(r.agenda)))throw Error('议题字段、日期或来源不完整，请检查文件');if(modal!=='v3-meeting-import'||modalData!==context)return;modalData.parsed=data;paintModal();$('#meeting-import-preview').textContent=data.results.length+' 条议题 · 校验通过'+(data.newSources?.length?' · '+data.newSources.length+' 份资料待关联原文':'');
 }catch(err){if(modal!=='v3-meeting-import'||modalData!==context)return;modalData.parsed=null;paintModal();$('#meeting-import-error').textContent=err.message;}},true);

const importActionBase=handleAction;
handleAction=function(action,el){if(action==='v3-meeting-import-save'&&modalData.parsed?.newSources){state.docs.push(...modalData.parsed.newSources);}return importActionBase(action,el);};
const reportBase=reportText;
reportText=function(task,title){if(task.toolId==='prepaid'&&task.billing)return title+'\n任务：'+task.name+'\n费用类型：'+task.config.feeType+'\n计费约定：'+task.billing.clause+'\n计费基数：'+task.base+' 元\n计算结果：'+task.fee+' 元\n来源：'+task.successIds.map(id=>file(id)?.name).join('、');return reportBase(task,title);};
render();

function ensureTaskStructure(t){if(!t)return;t.projects??=[];t.modes??=[];t.tableA??=null;t.tableB??=null;t.tableAName??='待查项目表';t.tableBName??='对照项目表';t.chats??=[];t.attachments??={};}
state.tasks.forEach(ensureTaskStructure);
const productNewAnalysis=newAnalysis,productOpenTask=openTask;
newAnalysis=function(){ensureTaskStructure(currentTask());productNewAnalysis();};
openTask=function(id){ensureTaskStructure(state.tasks.find(t=>t.id===id));productOpenTask(id);};
const importStructBase=handleAction;
handleAction=function(action,el){const r=importStructBase(action,el);if(action==='v3-meeting-import-save'){ensureTaskStructure(currentTask());persist();}return r;};
// Empty states always lead to choosing materials, including the two-table and bidding workspaces.
const presentationRender=render;
render=function(){presentationRender();$$('[data-action="sample"]').forEach(b=>{if(state.toolId==='association'){b.remove();}else{b.dataset.action='picker';b.textContent='添加资料';}});};
render();
const feeNavigationRender=render;
render=function(){feeNavigationRender();const task=currentTask();if(state.view==='tool'&&task?.status==='awaiting'&&!$('.command-actions [data-action="new-analysis"]'))$('.command-actions [data-action="focus-base"]')?.insertAdjacentHTML('beforebegin',B(I('plus')+'新建分析','new-analysis','sm'));};
render();
document.addEventListener('change',e=>{if(e.target.dataset.config!=='feeType'||isLocked())return;const c=ws().config;[['agreement','提取计费约定'],['calculation','费用计算']].forEach(([key,label])=>{const s=c.stages[key];if(s&&!s.customized&&s.origin!=='personal'){s.template=c.feeType+' · '+label;s.content=key==='agreement'?'从合同原文提取'+c.feeType+'的计费依据、基数、费率或固定总价、调整条件与来源；未提取到的内容如实标注。':'依据已提取的'+c.feeType+'合同约定和用户确认的基数计算费用，列出公式、单位、结果及来源，不套用合同之外的收费标准。';}});c.prompt=c.stages.agreement.content;render();});
const templateResetAction=handleAction;
handleAction=function(action,el){if(action==='v2-stage-reset'&&modalData.stageConfigChanges)delete modalData.stageConfigChanges[modalData.stage];return templateResetAction(action,el);};
render();
const selectionConfigPanel=configPanel;
configPanel=function(){const html=selectionConfigPanel();if(!['risk','contract'].includes(state.toolId)||isLocked())return html;const node=document.createElement('div');node.innerHTML=html;const section=[...node.querySelectorAll('.config-section')].find(s=>s.querySelector('[data-change="risk-check"]'));section?.querySelector('.row.between')?.insertAdjacentHTML('afterend','<div class="row mt" style="margin-top:5px">'+A('全选','v4-check-all')+A('清空','v4-check-none')+'</div>');return node.innerHTML;};
const selectionAction=handleAction;
handleAction=function(action,el){if(action==='v4-check-all'||action==='v4-check-none'){const c=ws().config;const all=action==='v4-check-all';c.checks=all?(state.toolId==='risk'?c.riskNodes.map(r=>r.name):c.contractRules.map(r=>r.title)):[];if(state.toolId==='contract')c.contractRules.forEach(r=>r.enabled=all);render();return;}return selectionAction(action,el);};
const recordsModal=modalContent;
modalContent=function(){if(modal!=='upload-records')return recordsModal();return modalFrame('上传记录','查看上传与解析进度',state.uploads.length?state.uploads.map(u=>'<div class="upload-row"><div class="row between"><span class="filename">'+E(u.name)+'</span>'+tag(u.status,u.status==='解析失败'?'red':u.status==='可分析'?'green':'blue')+'</div><p class="hint">'+E(u.target)+' · '+E(u.time)+'</p>'+(u.error?'<p class="error">'+E(u.error)+'</p>':'')+(u.status==='解析失败'?A('重试解析','retry-upload','data-id="'+u.id+'"'):'')+'</div>').join(''):'<div class="compact-empty">还没有上传记录。</div>',B('关闭','close-modal')+B('上传资料','upload','primary'),'medium');};
render();

// Material entry remains available when revisiting a result or using the wide result view.
const materialEntryRender=render,materialEntryAction=handleAction,materialEntryModal=modalContent;
render=function(){materialEntryRender();if(state.view==='tool'&&!currentTask()&&!$('.command-actions [data-action="add-tool-materials"]'))$('.command-actions')?.insertAdjacentHTML('afterbegin',B(I('plus')+'添加资料','add-tool-materials','sm soft','aria-label="向当前工具添加资料"'));};
handleAction=function(action,el){
 if(action==='add-tool-materials'){
  if(state.toolId==='association'){openModal('add-compare-materials');return;}
  return handleAction('picker',el);
 }
 if((action==='picker'||action==='pick-table')&&currentTask()){
  const w=ws(),extra={sourceTaskId:currentTask().id,newAnalysisOnConfirm:true};
  if(action==='pick-table')Object.assign(extra,{table:true,slot:el.dataset.slot,selected:w['table'+el.dataset.slot]?[w['table'+el.dataset.slot]]:[]});
  startPicker(extra);return;
 }
 if(action==='confirm-picker'&&modalData.newAnalysisOnConfirm){
  // Copy only on confirmation: cancel leaves the viewed task and its snapshots untouched.
  newAnalysis();fullResult=false;
  const result=materialEntryAction(action,el);toast('已添加到新分析，原任务资料与结果已保留。');return result;
 }
 return materialEntryAction(action,el);
};
modalContent=function(){
 if(modal==='add-compare-materials')return modalFrame('添加比较资料','分别选择两张台账，保留表一与表二的业务含义。','<div class="column">'+B('选择或更换表一','pick-table','soft','data-slot="A"')+B('选择或更换表二','pick-table','soft','data-slot="B"')+'</div>',B('取消','close-modal'),'small');
 let html=materialEntryModal();if(modal==='picker'&&modalData.newAnalysisOnConfirm)html=html.replace('已选文件去重 · 预览不改变选择','确认后新建分析；原任务资料与结果保留。');return html;
};
render();
