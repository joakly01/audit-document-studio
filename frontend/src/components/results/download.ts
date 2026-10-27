import type { Task } from '@/domain/types'
import { service } from '@/services/service'
export async function downloadTask(task:Task,format:'excel'|'csv'|'json'|'markdown') {
  if(!service.capabilities.demo && ['engineering','contract'].includes(task.tool ?? '') && !['excel','json'].includes(format)) throw new Error('此工具的服务端仅提供专用导出；通用数据请选 JSON')
  const blob=format==='json' ? new Blob([JSON.stringify(task.results ?? {},null,2)],{type:'application/json'}) : await service.exportTask(task,format)
  if(!blob.size) throw new Error('服务未返回可下载的结果')
  const ext=!service.capabilities.demo && task.tool==='engineering' && format==='excel' ? 'zip' : {excel:'xlsx',csv:'csv',json:'json',markdown:'md'}[format]
  const a=document.createElement('a'),url=URL.createObjectURL(blob)
  a.href=url;a.download=`${task.name.replace(/[\\/:*?"<>|]/g,'_')}.${ext}`
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
