import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Task } from '@/domain/types'

export const activeTaskStates = new Set(['queued','running'])
export interface PollOptions {interval?:number;fetch:(id:string,signal:AbortSignal)=>Promise<Task>;onTask:(task:Task)=>void;onError:(error:unknown)=>void}
/** Sequential recursive polling: completion and disposal never leave a pending interval. */
export function createTaskPoller(options:PollOptions) {
  let timer:ReturnType<typeof setTimeout>|undefined, controller:AbortController|undefined, epoch=0
  function stop() { epoch++; if(timer) clearTimeout(timer); timer=undefined; controller?.abort(); controller=undefined }
  async function run(id:string,version:number) {
    if(version!==epoch) return
    controller=new AbortController()
    try {
      const task=await options.fetch(id,controller.signal)
      if(version!==epoch) return
      options.onTask(task)
      if(!activeTaskStates.has(task.status)) return
    } catch(error) {
      if(version!==epoch || controller.signal.aborted) return
      options.onError(error)
    }
    if(version===epoch) timer=setTimeout(()=>void run(id,version),options.interval ?? 5000)
  }
  function start(id:string) { stop(); if(id) void run(id,epoch) }
  return {start,stop}
}
export function useTaskPolling(id:Ref<string>,fetch:PollOptions['fetch']) {
  const task=ref<Task|null>(null), error=ref(''), loading=ref(false)
  const poller=createTaskPoller({fetch,onTask(value){task.value=value;error.value='';loading.value=false},onError(value){error.value=value instanceof Error ? value.message : '获取任务状态失败';loading.value=false}})
  watch(id,value=>{task.value=null;error.value='';loading.value=Boolean(value);poller.start(value)},{immediate:true})
  onScopeDispose(()=>poller.stop())
  return {task,error,loading,refresh(){loading.value=true;poller.start(id.value)}}
}
