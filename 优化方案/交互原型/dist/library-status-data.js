'use strict';
// User-requested initial status cases, kept stable for inspection. No remote upload/OCR work is started.
const libraryStatusDataReady=(async function seedLibraryStatuses(){
 const marker='audit-library-status-data-v1';if(localStorage.getItem(marker))return;
 const stages=['uploading','pending','processing','done','failed','stuck'],names={uploading:'建设项目资料移交清单.txt',pending:'专项资金支付核对记录.txt',processing:'采购合同履约情况说明.txt',done:'项目验收与付款记录.csv',failed:'合同付款审批情况说明.txt',stuck:'工程变更事项核对记录.txt'},newDocs=[],newRecords=[],sources=[];
 const groups=[['project','项目空间','合同资料/资料接收','园区建设中心','LOCAL'],['personal','个人空间','我的资料/资料接收','当前用户','LOCAL'],['public','公共空间','山东省审计厅/资料接收','山东省审计厅','LOCAL'],['oss','公共空间','山东省审计厅/归档同步/2026/资料接收','山东省审计厅','OSS']];
 function addPath(space,path){const known=new Set(state.directoryNodes.filter(n=>n.space===space).map(n=>n.path)),parts=path.split('/');for(let i=1;i<=parts.length;i++){const p=parts.slice(0,i).join('/');if(!known.has(p)){state.directoryNodes.push({space,path:p});known.add(p);}}}
 function addCase(group,status,suffix='',name=names[status],sourceText=null,missing=false){
  const [code,space,path,unit,source]=group,id='status-data-v1-'+code+'-'+status+suffix;if(state.docs.some(d=>d.id===id))return;addPath(space,path);
  const csv=name.endsWith('.csv'),body=sourceText??(csv?'项目名称,合同金额（万元）,累计支付（万元）,验收日期\n园区设备采购,128,115.2,2026-09-18\n办公区节能改造,60,48,2026-09-26':'事项：'+name.replace(/\.[^.]+$/,'')+'\n资料提供单位：'+unit+'。2026年9月18日，承办部门核对项目合同、验收记录与付款申请。\n合同约定应在验收合格、审批手续齐全后付款。项目合同金额128万元，累计支付115.2万元。\n待核事项：核对支付日期、发票、审批记录与验收结论；资料未列明的情况继续调取原件核实。'),fileBlob=missing?null:new File([body],name,{type:csv?'text/csv':'text/plain'}),completed=status==='done',error=missing?'原文件暂不可用，请补充原文件后重新识别。':suffix==='-empty'?'文件正文为空，未提取到可检索文字。':status==='failed'?'上次全文识别中断，可重新开始识别。':status==='stuck'?'全文识别等待超时，可重新加入识别队列。':'',minute=String(59-stages.indexOf(status)-(suffix?10:0)).padStart(2,'0'),time='2026-10-18T09:'+minute+':00+08:00';
  const doc={id,name,type:csv?'CSV':'TXT',space,folder:path,size:((fileBlob?.size||240)/1024).toFixed(1)+' KB',...(fileBlob?{byteSize:fileBlob.size}:{}),date:'2026-10-18',uploadedAt:time,title:name.replace(/\.[^.]+$/,''),unit,topic:'项目资料核对',amount:'128 万元',owner:space==='公共空间'?unit:'当前用户',uploader_id:space==='公共空间'?'public-owner':'current-user',local:!completed,text:completed?body:'',source,content_status:status,statusCatalog:true};
  if(status==='failed')doc.parseError=error;if(csv&&completed){doc.columns=['项目名称','合同金额（万元）','累计支付（万元）','验收日期'];doc.rows=[['园区设备采购',128,115.2,'2026-09-18'],['办公区节能改造',60,48,'2026-09-26']];}
  const record={id,name,target:space+' / '+path,source,status,contentStatus:status,upload_percent:status==='uploading'?46:100,progress:status==='uploading'?46:completed?100:status==='processing'?68:20,updatedAt:time,time,file_id:id,bucket:source==='OSS'?'audit-archive':'audit-materials',error,statusCatalog:true};
  newDocs.push(doc);newRecords.push(record);if(fileBlob)sources.push({id,blob:fileBlob});
 }
 for(const group of groups)for(const status of stages)addCase(group,status);
 addCase(groups[1],'failed','-empty','专项资料正文.txt','');
 addCase(groups[1],'failed','-missing','付款审批补充材料.txt',null,true);
 addPath('项目空间','审计工作资料/待补充材料');
 const ossKey=directoryKey('公共空间','山东省审计厅/归档同步');folderMeta[ossKey]??={};folderMeta[ossKey].source='OSS';folderMeta[ossKey].is_oss_folder=true;
 state.docs.push(...newDocs);state.uploads.unshift(...newRecords);
 for(const {id,blob} of sources){uploadSources.set(id,blob);await libStoreFile(id,blob);}
 persist();try{localStorage.setItem(marker,'1');}catch{}render();
})();
