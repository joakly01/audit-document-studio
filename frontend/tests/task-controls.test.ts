import {describe,it,expect,vi} from 'vitest'
import {createApiService} from '../src/services/api'

describe('non-destructive task cancellation',()=>{
 it('does not expose cancellation until a cancellation-only endpoint is configured',async()=>{
  const request=vi.fn(),api=createApiService({request})
  expect(api.capabilities.taskStop).toBe(false)
  await expect(api.stopTask('t')).rejects.toThrow('接口尚未配置')
  expect(request).not.toHaveBeenCalled()
 })
 it('never uses the legacy combined delete-or-stop endpoint',async()=>{
  const request=vi.fn(),api=createApiService({request,endpoints:{taskStop:'/api/v1/task/DeleteTaskSchedules/{id}'}})
  expect(api.capabilities.taskStop).toBe(false)
  await expect(api.stopTask('t')).rejects.toThrow('接口尚未配置')
  expect(request).not.toHaveBeenCalled()
 })
 it('checks the latest state and calls only the configured cancellation endpoint',async()=>{
  const request=vi.fn().mockResolvedValueOnce({task_uuid:'t',tool_name:'信息提取',processing_status:1}).mockResolvedValueOnce(undefined)
  const api=createApiService({request,endpoints:{taskStop:'/verified/tasks/{id}/cancel'}})
  expect(api.capabilities.taskStop).toBe(true);await api.stopTask('t')
  expect(request.mock.calls[1]).toEqual(['/verified/tasks/t/cancel',{method:'POST',body:{task_uuid:'t'}}])
 })
 it('does not submit cancellation after a task has finished',async()=>{
  const request=vi.fn().mockResolvedValue({task_uuid:'t',tool_name:'信息提取',processing_status:2})
  await expect(createApiService({request,endpoints:{taskStop:'/verified/tasks/{id}/cancel'}}).stopTask('t')).rejects.toThrow('任务已结束')
  expect(request).toHaveBeenCalledTimes(1)
 })
})
