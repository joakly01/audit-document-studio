<script setup lang="ts">
import {ref} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import type {Evidence,JsonObject,Task} from '@/domain/types'
import {service} from '@/services/service'
import {rows,resultEmptyText} from './model'
import BusinessTable from './BusinessTable.vue'
const props=defineProps<{data:JsonObject;task:Task}>()
const emit=defineEmits<{source:[evidence:Evidence];detail:[row:JsonObject];refresh:[]}>()
const amount=ref<number|undefined>(),busy=ref(false),active=ref(rows(props.data.calculations).length ? 'calculation' : 'agreements')
async function calculate(){if(amount.value===undefined || amount.value<0)return;try{await ElMessageBox.confirm(`以 ${amount.value.toLocaleString()} 元作为计费基数，继续本任务的费用计算。`,'确认计费基数',{confirmButtonText:'继续计算',cancelButtonText:'取消'});busy.value=true;await service.continueTask(props.task,'prepaid-continue',{billing_base_wan:amount.value});emit('refresh')}catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e instanceof Error ? e.message : '继续计算失败')}finally{busy.value=false}}
</script>
<template><div><el-alert v-if="task.status==='awaiting_input'" title="计费约定已提取，请确认后填写计费基数。" type="warning" :closable="false" show-icon/><el-tabs v-model="active"><el-tab-pane label="计费约定" name="agreements"/><el-tab-pane :label="`费用计算（${rows(data.calculations).length}）`" name="calculation"/></el-tabs><BusinessTable :rows="rows(active==='agreements' ? data.agreements : data.calculations)" :empty-text="resultEmptyText(data,active==='agreements' ? 'agreements' : 'calculations')" @source="emit('source',$event)" @detail="emit('detail',$event)"/><section v-if="task.status==='awaiting_input'" class="calculation"><h3>填写计费基数</h3><el-form inline><el-form-item label="计费基数（元）"><el-input-number v-model="amount" :min="0" :precision="2" :disabled="!service.capabilities.prepaidUnitConfirmed" :controls="false" style="width:260px"/></el-form-item><el-form-item><el-button type="primary" :disabled="!service.capabilities.prepaidUnitConfirmed || amount===undefined" :loading="busy" @click="calculate">继续计算</el-button></el-form-item></el-form><p v-if="!service.capabilities.prepaidUnitConfirmed" class="muted">计费基数的接口单位尚未确认，暂不能提交计算；已提取约定可正常查看。</p></section><p class="muted">费用结果依据合同约定和本次输入计算，缺少的约定或金额不会补为零。</p></div></template>
<style scoped>.calculation{padding:20px;background:#f5f8fd;border:1px solid #dce6f5;border-radius:8px;margin:16px 0}.calculation h3{font-size:18px;margin:0 0 16px}.muted{font-size:14px;line-height:1.7;color:#596b80}</style>
