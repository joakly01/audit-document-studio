<script setup lang="ts">
import {Delete,Plus} from '@element-plus/icons-vue'
import type {ExtractionField} from '@/domain/types'
import {createId} from '@/domain/ids'
const props=defineProps<{modelValue:ExtractionField[]}>();const emit=defineEmits<{'update:modelValue':[ExtractionField[]]}>()
function update(i:number,key:'name'|'description',value:string){emit('update:modelValue',props.modelValue.map((f,j)=>j===i?{...f,[key]:value}:f))}
function add(){emit('update:modelValue',[...props.modelValue,{id:createId(),name:'',description:''}])}
</script>
<template>
 <div class="fields-heading"><h3>提取字段 <span class="number">{{modelValue.length}}</span></h3><el-button :icon="Plus" @click="add">添加字段</el-button></div>
 <div v-if="!modelValue.length" class="empty-fields">选择模板载入字段，或点击“添加字段”设置要提取的内容。</div>
 <article v-for="(field,i) in modelValue" :key="field.id" class="field-item">
  <div class="field-top"><span class="field-index">{{i+1}}</span><el-input :model-value="field.name" @update:model-value="update(i,'name',$event)" :aria-label="'字段 '+(i+1)+' 名称'" placeholder="字段名称，如合同金额" maxlength="100"/><el-button text :icon="Delete" :aria-label="'删除字段 '+(i+1)" @click="emit('update:modelValue',modelValue.filter((_,j)=>i!==j))" /></div>
  <el-input :model-value="field.description" @update:model-value="update(i,'description',$event)" :aria-label="'字段 '+(i+1)+' 提取说明'" type="textarea" :autosize="{minRows:2,maxRows:5}" placeholder="提取说明，如含税合同总额及币种" />
 </article>
</template>
<style scoped>
.fields-heading{display:flex;align-items:center;justify-content:space-between;margin:12px 0;gap:8px}.fields-heading h3{font-size:15px}.field-item{padding:12px;margin-bottom:10px;border:1px solid #e6ebf1;border-radius:7px;background:#fafbfd}.field-top{display:flex;align-items:center;gap:6px;margin-bottom:8px}.field-index{width:20px;flex-shrink:0;color:#596b80;font-size:14px}.empty-fields{font-size:14px;color:#596b80;border:1px dashed #ccd7e6;padding:20px 14px;border-radius:7px}
</style>
