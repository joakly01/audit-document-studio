<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import type {Rule} from '@/domain/rules'
const props=withDefaults(defineProps<{items:Rule[];modelValue:Rule[];label?:string}>(),{label:'检查规则'})
const emit=defineEmits<{'update:modelValue':[Rule[]]}>()
const keyword=ref(''),category=ref(''),onlySelected=ref(false),page=ref(1)
const categories=computed(()=>[...new Set(props.items.map(v=>v.path).filter(Boolean))])
const selected=computed(()=>new Set(props.modelValue.map(v=>v.id)))
const filtered=computed(()=>props.items.filter(v=>(!category.value||v.path===category.value)&&(!onlySelected.value||selected.value.has(v.id))&&(!keyword.value||`${v.label} ${v.description}`.includes(keyword.value.trim()))))
const paged=computed(()=>filtered.value.slice((page.value-1)*10,page.value*10))
watch([keyword,category,onlySelected],()=>page.value=1)
function toggle(rule:Rule,checked:unknown){emit('update:modelValue',checked?[...props.modelValue.filter(v=>v.id!==rule.id),rule]:props.modelValue.filter(v=>v.id!==rule.id))}
function all(checked:boolean){const scope=new Set(filtered.value.map(v=>v.id));emit('update:modelValue',checked?[...props.modelValue.filter(v=>!scope.has(v.id)),...filtered.value]:props.modelValue.filter(v=>!scope.has(v.id)))}
</script>
<template>
 <section class="rule-picker">
  <div class="rule-title"><h3>{{label}}</h3><span class="muted">已选 <strong class="number">{{modelValue.length}}</strong> 项</span></div>
  <div class="toolbar"><el-input v-model="keyword" clearable :placeholder="'查找'+label" :aria-label="'查找'+label"/><el-select v-if="categories.length" v-model="category" clearable placeholder="全部分类"><el-option v-for="c in categories" :key="c" :value="c" :label="c"/></el-select></div>
  <div class="rule-controls"><el-checkbox v-model="onlySelected">仅看已选</el-checkbox><el-button link type="primary" @click="all(true)">选择全部页（{{filtered.length}}）</el-button><el-button link @click="all(false)">取消本范围</el-button></div>
  <div v-if="!items.length" class="empty-state">当前提示词没有提供{{label}}，请选择含规则的提示词。</div>
  <div v-else-if="!filtered.length" class="empty-state">没有符合条件的{{label}}</div>
  <article v-for="r in paged" :key="r.id" class="rule-row"><el-checkbox :model-value="selected.has(r.id)" @change="toggle(r,$event)">{{r.label}}</el-checkbox><slot name="actions" :rule="r"/><p v-if="r.path" class="rule-path">{{r.path}}</p><el-collapse v-if="r.description" class="rule-description"><el-collapse-item title="查看检查要点" :name="r.id"><p>{{r.description}}</p></el-collapse-item></el-collapse></article>
  <el-pagination v-if="filtered.length>10" v-model:current-page="page" :total="filtered.length" :page-size="10" layout="prev,pager,next" small/>
 </section>
</template>
<style scoped>
.rule-title{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px}.rule-picker .toolbar{flex-wrap:nowrap}.rule-picker .el-select{width:160px;flex-shrink:0}.rule-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:6px 0}.rule-row{border-bottom:1px solid #e6ebf1;padding:7px 0}.rule-row .el-checkbox{align-items:start}.rule-row :deep(.el-checkbox__input){margin-top:6px}.rule-row :deep(.el-checkbox__label){line-height:1.6}.rule-path{font-size:12px;color:#596b80;margin-left:25px}.rule-description{margin-left:25px;border:0}.rule-description :deep(.el-collapse-item__header){height:30px;min-height:30px;font-size:13px;color:#596b80;border:0;background:transparent}.rule-description :deep(.el-collapse-item__wrap){border:0;background:transparent}.rule-description :deep(.el-collapse-item__content){padding-bottom:6px;white-space:pre-wrap;font-size:14px}.rule-picker .el-pagination{margin-top:14px}
</style>
