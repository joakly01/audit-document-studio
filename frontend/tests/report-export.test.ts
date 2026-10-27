import {describe,it,expect,vi} from 'vitest'
import {read,utils} from 'xlsx'
import {createApiService} from '../src/services/api'
import {createDemoService} from '../src/services/demo'
describe('contract reports and result export',()=>{
 it('reads report status separately from analysis state and downloads through the authenticated endpoint',async()=>{
  const request=vi.fn().mockResolvedValueOnce({status:'success',report_file:{filename:'合同报告.docx'}}).mockResolvedValueOnce(new Blob(['docx bytes']))
  const api=createApiService({request});expect(await api.getContractReport('t')).toEqual({status:'success',filename:'合同报告.docx',error:undefined})
  await api.downloadContractReport('t');expect(request.mock.calls[1][0]).toBe('/api/v1/task/ContractReportDownload/t');expect(request.mock.calls[1][1].blob).toBe(true)
 })
 it('revalidates the analysis task before generating a bound report',async()=>{
  const request=vi.fn().mockResolvedValue({task_uuid:'t',tool_name:'合同分析',processing_status:1,has_results:true})
  await expect(createApiService({request}).generateContractReport('t')).rejects.toThrow('等待合同分析结束');expect(request).toHaveBeenCalledTimes(1)
 })
 it('submits report generation without creating a new analysis task',async()=>{
  const request=vi.fn().mockResolvedValueOnce({task_uuid:'t',tool_name:'合同分析',processing_status:2,has_results:true}).mockResolvedValueOnce({status:'running'})
  await createApiService({request}).generateContractReport('t');expect(request.mock.calls[1]).toEqual(['/api/v1/task/ContractReportGenerate/t',{method:'POST'}])
 })
 it('creates a valid demonstration workbook and labels the report format truthfully',async()=>{
  const demo=createDemoService(),task=await demo.getTask('demo-task-extract')
  const blob=await demo.exportTask(task,'excel'),wb=read(await blob.arrayBuffer(),{type:'array'})
  expect(wb.SheetNames).toContain('rows');expect(utils.sheet_to_json(wb.Sheets.说明,{header:1})[0]).toEqual(['声明','虚构演示数据，仅用于界面验证'])
  await demo.generateContractReport('demo-task-contract');expect((await demo.getContractReport('demo-task-contract')).filename).toMatch(/\.txt$/)
  expect(await(await demo.downloadContractReport('demo-task-contract')).text()).toContain('虚构演示报告')
 })
})
