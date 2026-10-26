'use strict';
// Initial browser-local audit materials. Add once; never overwrite edits, deletes or folder moves.
(function seedLibraryCatalog(){
 const marker='audit-library-catalog-v1';if(localStorage.getItem(marker))return;
 const docs=[],dirs=[],baseId='catalog-20261018-',seen=new Set(state.docs.map(d=>d.id));let index=0;
 const addDir=(space,path)=>{const parts=path.split('/');for(let i=1;i<=parts.length;i++)dirs.push({space,path:parts.slice(0,i).join('/')});};
 const add=(space,path,name,topic,unit,stage='done')=>{
  index++;if(path)addDir(space,path);const id=baseId+String(index).padStart(3,'0'),type=name.split('.').at(-1).toUpperCase(),day=String(index%16+1).padStart(2,'0'),amount=80+index*7,paragraphs=[name.replace(/\.[^.]+$/,''),'资料归属：'+unit+'。审计事项：'+topic+'。','2026年'+(index%8+1)+'月'+(index%25+1)+'日，相关部门提交本事项资料，涉及资金'+amount+'万元。','资料记载了事项申请、审核、决策和执行过程。申请部门应提供预算依据，承办部门负责核对合同与实施范围，财务部门按审批手续办理资金支付。','核查记录：应将项目立项、采购结果、合同约定、验收结论和付款凭证逐项对应，核实时间、金额及责任单位是否一致。未见的材料应继续补充，不据此直接认定审计问题。','归档要求：原始文件、附件、版本及经办记录分别保管；同一事项后续材料应保持连续编号。'];
  const doc={id,name,type,space,folder:path||'根目录',title:name.replace(/\.[^.]+$/,''),topic,unit,amount:amount+' 万元',date:'2026-10-'+day,uploadedAt:'2026-10-'+day+'T08:30:00+08:00',size:(28+index%70)+' KB',owner:space==='公共空间'?unit:'当前用户',uploader_id:space==='公共空间'?'public-owner':'current-user',local:stage!=='done',text:stage==='done'?paragraphs.join('\n'):'',catalogSeed:true};
  if(stage==='failed')doc.parseError='正文提取未完成，请核对文件后重新识别。';
  if(type==='XLSX'||type==='CSV'){doc.columns=['项目编码','项目名称','责任单位','预算金额（万元）','支付金额（万元）','资料状态'];doc.rows=Array.from({length:6},(_,n)=>['SJ-'+String(index).padStart(3,'0')+'-'+(n+1),topic+'第'+(n+1)+'项',unit,amount+n*15,Math.round((amount+n*15)*.65),'待核验']);if(stage==='done')doc.text=doc.columns.join('，')+'\n'+doc.rows.map(r=>r.join('，')).join('\n');}
  docs.push(doc);
 };
 const domains=['农业农村','党政经责','国有企业','地方财政','地方金融','外资外贸','政府投资','教科文卫','社会保障','税收征管','资源环境','其他领域'];
 const institution='山东省审计厅';
 add('公共空间',institution,'2026年度报送资料目录.xlsx','年度报送资料',institution);
 add('公共空间',institution,'资料报送与归档要求.pdf','报送归档',institution);
 domains.forEach((domain,i)=>{const base=institution+'/'+domain+'报送资料';add('公共空间',base,'2026年'+domain+'资料清单.xlsx',domain+'资料收集',institution);add('公共空间',base+'/2026',domain+'专项资金使用情况报告.pdf',domain+'专项资金',institution);add('公共空间',base+'/2026/合同与凭证',domain+'项目付款审核记录.docx',domain+'合同履约',institution,i%5===0?'pending':'done');});
 for(const year of ['2025','2026'])for(const kind of ['地方金融机构','地方金融组织','金融管理部门','骨干金融企业']){const path=institution+'/地方金融报送资料/'+year+'/'+kind;add('公共空间',path,year+'年度财务收支报告.pdf',kind+'财务收支',institution);if(year==='2025')add('公共空间',path+'/财务报表','资产负债及收支明细.xlsx',kind+'财务核对',institution);}
 for(const city of ['济南市审计局','青岛市审计局','淄博市审计局','潍坊市审计局']){add('公共空间',city,'2026年度资料报送汇总.xlsx','年度资料报送',city);add('公共空间',city+'/政府投资/2026','建设项目资金使用报告.pdf','政府投资',city);add('公共空间',city+'/财政审计/2026','预算执行及资金结余表.xlsx','预算执行',city);}
 for(const name of ['审计资料命名与编号规则.pdf','电子资料接收登记表.xlsx','审计取证与材料核对要点.docx'])add('公共空间','制度资料',name,'资料规范','市审计局');
 const rootNames=['项目资料接收登记表.xlsx','审计实施方案.docx','被审计单位基本情况.pdf','2026年度资金支付汇总.xlsx','资料补充通知.docx','审计资料移交清单.pdf','项目决策过程说明.docx','资料提供承诺书.pdf'];
 rootNames.forEach(n=>add('项目空间','',n,'园区改造项目','园区建设中心'));
 const projectBranches=[['合同资料/施工合同','施工总承包合同.pdf','施工履约'],['合同资料/施工合同/补充协议','工程变更补充协议.docx','工程变更'],['合同资料/设备采购','采购合同付款与验收附件.pdf','设备采购'],['合同资料/设备采购/验收资料','设备到货及安装验收记录.pdf','采购验收'],['合同资料/监理咨询','监理月报与费用确认单.docx','工程监理'],['会议纪要/决策会议','第8次项目决策会议纪要.docx','项目决策'],['会议纪要/专题会议','第9次进度协调会议纪要.docx','工程进度'],['会议纪要/专题会议/落实情况','会议决定事项落实清单.xlsx','决策落实'],['项目台账/资金支付','合同支付与资金来源对照表.xlsx','资金支付'],['项目台账/工程变更','工程变更项目台账.xlsx','工程变更'],['招投标资料/招标资料','施工招标文件.pdf','施工招标'],['招投标资料/投标资料/华辰建设','技术与商务响应文件.pdf','投标响应'],['招投标资料/投标资料/青禾建设','投标报价明细.xlsx','投标报价'],['财务凭证/2026/一季度','一季度资金支付与凭证清单.xlsx','财务凭证'],['财务凭证/2026/二季度','二季度付款审批记录.pdf','付款审批'],['验收结算/工程验收','竣工验收报告.pdf','工程验收'],['验收结算/竣工结算','竣工结算送审资料清单.xlsx','结算审核'],['审计工作资料/问题核实','审计事项核实记录.docx','审计核实']];
 projectBranches.forEach(([path,name,topic],i)=>{add('项目空间',path,name,topic,'园区建设中心');if(i<10)add('项目空间',path,'相关资料核对记录.docx',topic+'资料核对','园区建设中心',i===3?'failed':i===5?'pending':'done');});
 for(const [path,name] of [['我的资料/待整理','现场资料接收清单.xlsx'],['我的资料/审阅记录','合同条款审阅记录.docx'],['我的资料/审阅记录/资金支付','资金支付核对笔记.md'],['我的资料/关注事项','需补充的审计资料清单.docx'],['工作笔记/2026','项目审计现场工作笔记.md'],['工作笔记/2026/法规摘录','采购与合同管理条款摘录.txt'],['常用资料/检查清单','工程审计资料检查清单.xlsx']])add('个人空间',path,name,'审计工作整理','当前用户');
 for(const doc of docs)if(!seen.has(doc.id)){state.docs.push(doc);seen.add(doc.id);}
 const existing=new Set(state.directoryNodes.map(n=>directoryKey(n.space,n.path)));for(const dir of dirs){const key=directoryKey(dir.space,dir.path);if(!existing.has(key)){state.directoryNodes.push(dir);existing.add(key);}}
 // Keep busy branches discoverable without expanding every year and attachment at once.
 for(const {space,path} of dirs)if(path.split('/').length>=3||space==='公共空间'&&['济南市审计局','青岛市审计局','淄博市审计局','潍坊市审计局'].includes(path))treeClosed.add('library::'+directoryKey(space,path));
 persist();try{localStorage.setItem(marker,'1');}catch{}render();
})();
