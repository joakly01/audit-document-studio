<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessage} from 'element-plus'
import type {ContractReport,Task} from '@/domain/types'
import {safeFilename} from '@/domain/validation'
import {service} from '@/services/service'
const props=defineProps<{task:Task}>()
const report=ref<ContractReport>({status:'idle'}),error=ref(''),busy=ref(false),loading=ref(true)
let timer:ReturnType<typeof setTimeout>|undefined,request:AbortController|undefined,version=0
const ready=computed(()=>report.value.status==='success')
const canGenerate=computed(()=>props.task.hasResults&&['completed','partial'].includes(props.task.status))
function stop(){version++;if(timer)clearTimeout(timer);timer=undefined;request?.abort()}
async function load(epoch=version){
 request=new AbortController();loading.value=true
 try{const value=await service.getContractReport(props.task.id,request.signal);if(epoch!==version)return;report.value=value;error.value='';if(value.status==='running')timer=setTimeout(()=>void load(epoch),2000)}
 catch(e){if(epoch===version)error.value=(e as Error).message}
 finally{if(epoch===version)loading.value=false}
}
function refresh(){stop();void load(version)}
watch(()=>props.task.id,()=>{report.value={status:'idle'};error.value='';refresh()},{immediate:true})
onBeforeUnmount(stop)
async function action(){
 if(busy.value||loading.value||report.value.status==='unknown')return;busy.value=true;const epoch=version,taskId=props.task.id,filename=report.value.filename||'合同分析报告.docx'
 try{
  if(ready.value){const blob=await service.downloadContractReport(taskId);if(epoch!==version)return;if(!blob.size)throw Error('未返回有效报告文件');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=safeFilename(filename);link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  else{await service.generateContractReport(taskId);if(epoch===version)refresh()}
 }catch(e){ElMessage.error((e as Error).message)}finally{busy.value=false}
}
</script>
<template><div class="report-bar"><div><strong>合同分析报告</strong><span>{{report.status==='running'?'正在生成，可离开后再回来下载':ready?'报告已生成':report.status==='failed'?(report.error||'生成失败，可重试'):report.status==='unknown'?'报告状态待确认，请刷新重试':'汇总本任务的合同检查结果'}}</span><span v-if="error" class="error">{{error}}</span></div><el-button v-if="error||report.status==='unknown'" :disabled="loading" @click="refresh">刷新报告状态</el-button><el-button :disabled="loading||!!error||['running','unknown'].includes(report.status)||(!ready&&!canGenerate)" :loading="busy||loading" @click="action">{{ready?'下载报告':report.status==='running'?'报告生成中':report.status==='failed'?'重新生成报告':'生成报告'}}</el-button></div></template>
<style scoped>.report-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#f8fafc;border:1px solid #e6ebf1;border-radius:7px;padding:12px 16px;margin-bottom:16px}.report-bar>div{display:flex;gap:12px;align-items:center;flex:1;flex-wrap:wrap}.report-bar strong{font-size:14px}.report-bar span{font-size:14px;color:#596b80}.report-bar .error{color:#a33e3e}</style>
