import type { Evidence, JsonObject } from '@/domain/types'

export function object(value: unknown): JsonObject {
  if (typeof value === 'string') { try { return object(JSON.parse(value)) } catch { return {} } }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}
export function rows(value: unknown): JsonObject[] {
  if (typeof value === 'string') { try { return rows(JSON.parse(value)) } catch { return [] } }
  return Array.isArray(value) ? value.map((row) => typeof row === 'object' && row !== null ? row as JsonObject : { value: row }) : []
}
export function text(value: unknown): string {
  if (value === undefined || value === null || value === '') return '未返回'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
export function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}
export function evidenceOf(row: JsonObject): Evidence[] {
  const raw = Array.isArray(row.evidence) ? row.evidence : Array.isArray(row.sources) ? row.sources : []
  const refs = raw.map((item: any) => {
    const r = object(item)
    const fileId = r.fileId ?? r.file_id ?? r.document_id
    if (fileId == null || fileId === '') return null
    const page = numeric(r.page ?? r.page_number)
    return {fileId: String(fileId),fileName:r.fileName ?? r.file_name,page:page && page > 0 ? page : undefined,quote:r.quote ?? r.text,sheet:r.sheet,row:numeric(r.row)} as Evidence
  }).filter((r: Evidence | null): r is Evidence => r !== null)
  // A reliable ID permits opening a file; never invent a page or reuse the first task file.
  if (!refs.length && (row.fileId || row.file_id || row.sourceDocumentId)) refs.push({fileId:String(row.fileId ?? row.file_id ?? row.sourceDocumentId),fileName:row.fileName ?? row.file_name ?? row.sourceFile})
  return refs
}
export function extractionColumns(data: JsonObject): string[] {
  const configured = Array.isArray(data.fields) ? data.fields.map((f: any) => typeof f === 'string' ? f : f.name).filter(Boolean) : []
  const values = rows(data.rows ?? data.extractions).flatMap(row => Object.keys(object(row.values ?? row.fields ?? row.data)))
  return [...new Set([...configured,...values])]
}
export const displayLabels: Record<string,string> = {
 extracted_value:'提取内容',laws_and_regulations:'判断依据',judgment_rule:'判定标准',analysis:'分析理由',fieldDetails:'逐字段提取详情',risk_path:'风险点路径',match_type:'匹配类型',table1_item:'表 A 记录',table2_item:'表 B 记录', id:'编号',name:'名称',title:'事项',description:'说明',summary:'内容摘要',fileName:'资料名称',file_name:'资料名称',fileId:'资料编号',file_id:'资料编号',date:'日期',amount:'金额',amountA:'表 A 金额',amountB:'表 B 金额',difference:'金额差异',score:'评分',reason:'判断依据',status:'分析状态',level:'风险等级',riskLevel:'风险等级',risk_point:'风险点',riskPoint:'风险点',rule:'检查规则',ruleName:'检查规则',rule_name:'检查规则',conclusion:'检查结果',suggestion:'核验建议',project:'项目',projectName:'项目名称',company:'投标单位',category:'类别',parent:'主项目',child:'子项目',tableA:'表 A 项目',tableB:'表 B 项目',a:'表 A 项目',b:'表 B 项目',sourceRow:'来源行',row:'来源行',sheet:'工作表',feeType:'费用类型',rate:'费率',base:'计费基数',result:'结果',value:'内容',content:'内容',meetingName:'会议名称',meetingDate:'会议日期',topicName:'议题名称',topicContent:'议题内容',money:'金额（万元）',attendees:'参会人员',observers:'列席人员',participants:'参会人员',clusterName:'议题聚类',decision:'会议决策',explanation:'说明',sourceFile:'来源文件',prompt:'提示词',findings:'审计线索',checkResult:'核查结果',risk_level:'风险等级',unit:'单位',basis:'计费依据',formula:'计算公式',calculatedAmount:'费用金额'
}
export function visibleColumns(data: JsonObject[]): string[] {
  const keys = [...new Set(data.flatMap(row => Object.keys(row)))]
  const ignored = new Set(['id','evidence','sources','raw','fileId','file_id','values','topics','topicIds','clusterId'])
  return keys.filter(key => !ignored.has(key)).slice(0,24)
}
export interface MeetingTopic extends JsonObject {
  key:string;meetingId:string;meetingName:string;meetingDate:string;topicName:string;topicContent:string;participants:string[];clusterId:string;clusterName:string;amount?:number;unit:string;evidence:Evidence[]
}
function names(value:unknown):string[] {return Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.split(/[,，|、;]/).map(s=>s.trim()).filter(Boolean) : []}
export function meetingTopics(data:JsonObject):MeetingTopic[] {
  const clusters = rows(data.clusters)
  return rows(data.meetings).flatMap((meeting,index) => {
    const meetingId=String(meeting.id ?? meeting.meeting_id ?? index)
    return rows(meeting.fullTopics ?? meeting.topics).map((topic,tIndex) => {
      const cluster=clusters.find(c=>c.id === topic.clusterId || c.name === topic.clusterName || (Array.isArray(c.topicIds) && c.topicIds.includes(topic.id)))
      const topicId=String(topic.id ?? `${meetingId}-${tIndex}`)
      const topicEvidence=evidenceOf(topic)
      return {...topic,key:topicId,meetingId,meetingName:String(meeting.name ?? meeting.meetingName ?? '会议名称未返回'),meetingDate:String(meeting.date ?? meeting.meetingDate ?? ''),topicName:String(topic.title ?? topic.topicName ?? topic.name ?? '议题名称未返回'),topicContent:String(topic.summary ?? topic.topicContent ?? topic.content ?? ''),participants:names(topic.participants ?? topic.attendees ?? meeting.participants ?? meeting.attendees),clusterId:String(topic.clusterId ?? cluster?.id ?? topic.clusterName ?? ''),clusterName:String(topic.clusterName ?? cluster?.name ?? '未归类'),amount:numeric(topic.amount ?? topic.money),unit:topic.unit ?? (topic.money !== undefined ? '万元' : data.amountUnit ?? ''),evidence:topicEvidence.length ? topicEvidence : evidenceOf(meeting)}
    })
  })
}
export interface MeetingFilters {keyword:string;regex:boolean;participants:string;start:string;end:string;min:string;max:string;cluster:string}
export function emptyMeetingFilters():MeetingFilters {return {keyword:'',regex:false,participants:'',start:'',end:'',min:'',max:'',cluster:''}}
/** Finite regex subset: no repetitions, assertions, or backreferences.
 * A bounded finite pattern cannot trigger exponential backtracking on long documents.
 */
export function safeMeetingRegex(pattern:string):RegExp {
  if(pattern.length>120) throw new Error('正则最多 120 个字符')
  let inClass=false
  for(let i=0;i<pattern.length;i++) {
    const char=pattern[i]
    if(char==='\\') {
      const next=pattern[++i]
      if(!next || /[0-9kpbB]/.test(next)) throw new Error('正则不支持反向引用或边界断言')
      continue
    }
    if(char==='[' && !inClass) {inClass=true;continue}
    if(char===']' && inClass) {inClass=false;continue}
    if(!inClass && /[+*?{}()]/.test(char!)) throw new Error('安全正则仅支持字面文本、字符类、或及首尾锚点；不支持量词、分组或环视')
  }
  return new RegExp(pattern,'i')
}
export function filterMeetingTopics(input:MeetingTopic[], filter:MeetingFilters):{items:MeetingTopic[];error:string} {
  if(filter.start && filter.end && filter.start > filter.end) return {items:[],error:'开始日期不能晚于结束日期'}
  const min=numeric(filter.min), max=numeric(filter.max)
  if(min !== undefined && max !== undefined && min>max) return {items:[],error:'最小金额不能大于最大金额'}
  let regex:RegExp|undefined
  if(filter.keyword && filter.regex) {
    try { regex=safeMeetingRegex(filter.keyword) } catch(error) { return {items:[],error:error instanceof Error ? error.message : '正则表达式无效'} }
  }
  const people=names(filter.participants)
  return {items:input.filter(item=>{
    const date=item.meetingDate.replaceAll('/','-').slice(0,10)
    if((filter.start && (!date || date<filter.start)) || (filter.end && (!date || date>filter.end))) return false
    if(filter.cluster && item.clusterId !== filter.cluster) return false
    if(people.length && !people.some(person=>item.participants.some(p=>p.includes(person)))) return false
    if(min !== undefined && (item.amount===undefined || item.amount<min)) return false
    if(max !== undefined && (item.amount===undefined || item.amount>max)) return false
    if(filter.keyword) { const value=`${item.topicName} ${item.topicContent}`; if(regex ? !regex.test(value.slice(0,10000)) : !value.toLocaleLowerCase().includes(filter.keyword.toLocaleLowerCase())) return false }
    return true
  }),error:''}
}

export function resultEmptyText(data:JsonObject,key:string,hasFilter=false):string {
  if(!Array.isArray(data[key])) return '服务尚未返回此部分的结构化结果，不能据此判断没有问题'
  return hasFilter ? '没有符合筛选条件的记录' : '本次已返回此部分结果，记录数为 0'
}
