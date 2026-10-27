import type {ToolDraft,Material} from './types'
import {toolMap} from './tools'
export function participatingFiles(d:ToolDraft):Material[] {
 const files:Material[] = d.tool==='bidding' ? (d.config.projects||[]).flatMap((p:any)=>[...(p.biddingFiles||[]),...(p.companies||[]).flatMap((c:any)=>c.files||[])]) : d.tool==='association' ? [d.config.table1,d.config.table2].filter(Boolean) : d.files
 return [...new Map(files.map(f=>[f.id,f])).values()]
}
export function validateDraft(d:ToolDraft):string[] {
 const errors:string[]=[]; const c=d.config; const files=participatingFiles(d)
 if(!files.length) errors.push('请先添加参与分析的资料。')
 if(files.some(f=>f.parseStatus!=='parsed'||f.canAnalyze===false)) errors.push('仅解析完成且有分析权限的资料可以提交，请重新确认选择。')
 if(d.tool==='extract') {
  if(!c.fields?.length) errors.push('请选择提取模板，或添加至少一个提取字段。')
  if(c.fields?.some((f:any)=>!f.name.trim())) errors.push('请填写每个提取字段的名称。')
  if(new Set(c.fields?.map((f:any)=>f.name.trim())).size!==c.fields?.length) errors.push('提取字段名称不能重复。')
  if(c.overlap>=c.chunkSize||c.overlap<0||c.chunkSize<100) errors.push('文本切片长度至少 100 字，重叠长度须小于切片长度。')
 }
 let stages=toolMap[d.tool].promptStages
 if(d.tool==='bidding') stages=stages.filter(s=>c.analysisModes?.includes(s.key))
 if(d.tool==='meeting') stages=stages.filter(s=>s.key==='main')
 if(d.tool==='contract'&&c.contractCategory==='auto') stages=[]
 if(d.tool==='engineering') stages=stages.filter(s=>s.key==='duplicate'?c.duplicateEnabled:c.parentChildEnabled)
 for(const stage of stages) if(!d.prompts[stage.key]?.content?.trim()) errors.push(`请设置「${stage.label}」提示词。`)
 if(d.tool==='risk'&&!c.riskPoints?.length) errors.push('请选择至少一个风险点。')
 if(d.tool==='prepaid'&&!c.feeTypes?.length) errors.push('请选择需要计算的费用类型。')
 if(d.tool==='contract'&&c.contractCategory!=='auto'){if(!c.rules?.length&&!c.autoAnalysis&&c.button!==1)errors.push('请选择检查规则，或开启补充自动分析。');if(c.rules?.some((r:any)=>['title','description','laws_and_regulations','judgment_rule'].some(key=>!String((r.raw||r)[key]||'').trim())))errors.push('请补全合同规则的检查事项、检查说明、判断依据和判定标准。')}
 if(d.tool==='bidding') {
  if(!c.analysisModes?.length) errors.push('请至少选择一种检查方式。')
  if(!c.projects?.length) errors.push('请添加项目。')
  c.projects?.forEach((p:any,i:number)=>{
   if(!p.name?.trim())errors.push(`请填写项目 ${i+1} 的名称。`)
   if(c.analysisModes.some((m:string)=>m==='bidding_only'||m==='joint')&&!p.biddingFiles?.length) errors.push(`「${p.name||i+1}」需要添加招标文件。`)
   if(c.analysisModes.some((m:string)=>m==='tender_only'||m==='joint')) {
    if(!p.companies?.length)errors.push(`「${p.name||i+1}」需要添加投标单位。`)
    p.companies?.forEach((v:any)=>{if(!v.name?.trim()||!v.files?.length)errors.push(`「${p.name||i+1}」的投标单位需填写名称并添加投标文件。`)})
   }
  })
  c.analysisModes?.forEach((m:string)=>{if(!c.modeRules?.[m]?.length)errors.push(`请为${({bidding_only:'招标文件分析',tender_only:'投标文件分析',joint:'招投标联合分析'} as any)[m]}选择检查规则。`)})
 }
 if(d.tool==='association') {
  if(!c.table1||!c.table2)errors.push('请选择对照表 A 和对照表 B。')
  else if(c.table1.id===c.table2.id)errors.push('请使用两份不同的资料作为对照表。')
  if(!c.mappingRows?.length||c.mappingRows.some((r:any)=>!r.left||!r.right))errors.push('请完成两表字段的对应关系。')
  if(c.mappingRows?.length&&Math.abs(c.mappingRows.reduce((sum:number,r:any)=>sum+Number(r.weight??1),0)-1)>0.01)errors.push('请在字段评分中设置权重，合计应为 1。')
  if(Number(c.fullMatchThreshold)<Number(c.partialMatchThreshold))errors.push('完全匹配阈值不能低于部分匹配阈值。')
 }
 if(d.tool==='engineering') {
  if(!c.duplicateEnabled&&!c.parentChildEnabled) errors.push('请选择重复项目识别或主子项目识别。')
  for(const f of files){const dynamic=c.engineeringMappings?.[f.id];if(dynamic){for(const mode of [{key:'duplicate',enabled:c.duplicateEnabled,label:'重复项目'},{key:'parentChild',enabled:c.parentChildEnabled,label:'主子项目'}]){if(!mode.enabled)continue;const rows=dynamic[mode.key]||[];if(!rows.length||rows.some((r:any)=>!r.column||!r.rule?.trim()))errors.push(`请为「${f.name}」补全${mode.label}的比较字段与评分说明。`);if(rows.length&&Number(c.minMatchFields||1)>rows.length)errors.push(`「${f.name}」${mode.label}的比较字段少于候选筛选要求，请在高级设置中降低至少匹配字段数。`);if(rows.length&&Math.abs(rows.reduce((sum:number,r:any)=>sum+Number(r.weight||0),0)-1)>0.01)errors.push(`「${f.name}」${mode.label}的字段权重合计应为 1。`);if(new Set(rows.map((r:any)=>r.column)).size!==rows.length)errors.push(`「${f.name}」${mode.label}存在重复的比较字段。`)}}else if(!c.fieldMappings[f.id]?.name)errors.push(`请为「${f.name}」映射项目名称字段。`)}
 }
 return [...new Set(errors)]
}
export function cloneDraft<T>(value:T):T {return JSON.parse(JSON.stringify(value))}
export function safeFilename(name:string){return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')}
