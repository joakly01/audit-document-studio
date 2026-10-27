import {describe,it,expect,vi,afterEach} from 'vitest'
import {createTaskPoller} from '../src/composables/useTaskPolling'
import type {Task} from '../src/domain/types'
const task=(status:Task['status'])=>({id:'t',status} as Task)
afterEach(()=>vi.useRealTimers())
describe('sequential task polling',()=>{
 it('never overlaps pending requests and stops on terminal states',async()=>{
  vi.useFakeTimers()
  let resolve!:(value:Task)=>void
  const fetch=vi.fn(()=>new Promise<Task>(r=>{resolve=r})),onTask=vi.fn()
  const poller=createTaskPoller({interval:10,fetch,onTask,onError:vi.fn()})
  poller.start('t');await vi.advanceTimersByTimeAsync(100)
  expect(fetch).toHaveBeenCalledTimes(1)
  resolve(task('running'));await vi.advanceTimersByTimeAsync(10)
  expect(fetch).toHaveBeenCalledTimes(2)
  resolve(task('completed'));await vi.advanceTimersByTimeAsync(100)
  expect(fetch).toHaveBeenCalledTimes(2);expect(onTask).toHaveBeenLastCalledWith(task('completed'));poller.stop()
 })
 it('retains transport errors as errors and ignores stale responses after stop',async()=>{
  vi.useFakeTimers()
  const onTask=vi.fn(),onError=vi.fn(),fetch=vi.fn().mockRejectedValueOnce(new Error('网络错误')).mockResolvedValue(task('awaiting_input'))
  const poller=createTaskPoller({interval:10,fetch,onTask,onError})
  poller.start('t');await vi.advanceTimersByTimeAsync(0)
  expect(onError).toHaveBeenCalledTimes(1);expect(onTask).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(100)
  expect(fetch).toHaveBeenCalledTimes(2);expect(onTask).toHaveBeenCalledWith(task('awaiting_input'));poller.stop()
  let resolve!:(value:Task)=>void
  const stale=createTaskPoller({fetch:()=>new Promise<Task>(r=>{resolve=r}),onTask,onError})
  stale.start('other');stale.stop();resolve(task('failed'));await Promise.resolve()
  expect(onTask).toHaveBeenCalledTimes(1)
 })
})
