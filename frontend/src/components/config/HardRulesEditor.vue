<script setup lang="ts">
import type {JsonObject} from '@/domain/types'
const props=defineProps<{modelValue:JsonObject[];fields:{key:string;label:string}[]}>()
const emit=defineEmits<{'update:modelValue':[JsonObject[]]}>()
const conditions=[{label:'值相同',value:'match'},{label:'值不同',value:'mismatch'},{label:'至少一个为空',value:'empty'},{label:'都为空',value:'both_empty'},{label:'至少一个非空',value:'any_non_empty'}]
const results=[{label:'完全一致',value:'full_match'},{label:'不完全一致',value:'partial_match'},{label:'遗漏',value:'miss'}]
const condition=()=>({field:props.fields[0]?.key||'',condition:'mismatch'})
function add(combined=false){emit('update:modelValue',[...props.modelValue,{...(combined?{logic:'and',rules:[condition()]}:condition()),result:'miss',priority:0,message:''}])}
</script>
<template><section class="hard-rules"><div class="rules-title"><h3>优先判断规则</h3><el-button :disabled="!fields.length" @click="add()">添加规则</el-button><el-button :disabled="!fields.length" @click="add(true)">添加组合规则</el-button></div><p class="help">满足条件时，优先按指定结果判断。组合规则需同时满足全部条件。</p>
 <article v-for="(rule,index) in modelValue" :key="index" class="hard-rule">
  <div class="rules-title"><strong>{{rule.logic==='and'?'组合规则':'单字段规则'}} {{index+1}}</strong><el-button text type="danger" @click="emit('update:modelValue',modelValue.filter((_,i)=>i!==index))">移除</el-button></div>
  <div class="condition-row" v-for="(part,i) in (rule.logic==='and'?rule.rules:[rule])" :key="i"><el-select v-model="part.field" aria-label="判断字段" placeholder="选择字段"><el-option v-for="f in fields" :key="f.key" :label="f.label" :value="f.key"/></el-select><el-select v-model="part.condition" aria-label="判断条件"><el-option v-for="c in conditions" :key="c.value" :label="c.label" :value="c.value"/></el-select><el-button v-if="rule.logic==='and'&&rule.rules.length>1" text @click="rule.rules.splice(i,1)">移除条件</el-button></div>
  <el-button v-if="rule.logic==='and'" text type="primary" @click="rule.rules.push(condition())">添加条件</el-button>
  <div class="condition-row"><label>判定为</label><el-select v-model="rule.result" aria-label="判定结果"><el-option v-for="r in results" :key="r.value" :label="r.label" :value="r.value"/></el-select><label>优先级</label><el-input-number v-model="rule.priority" :min="0" :max="999" aria-label="规则优先级"/></div><el-input v-model="rule.message" placeholder="判断说明" aria-label="判断说明"/>
 </article>
 </section></template>
<style scoped>.hard-rules{margin-top:16px}.rules-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rules-title h3,.rules-title strong{margin-right:auto}.hard-rule{border:1px solid #e6ebf1;background:#fafbfd;border-radius:7px;padding:12px;margin:10px 0}.condition-row{display:flex;align-items:center;gap:8px;margin:10px 0;flex-wrap:wrap}.condition-row .el-select{flex:1;min-width:150px}.condition-row .el-input-number{width:130px}</style>
