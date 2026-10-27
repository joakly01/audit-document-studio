<script setup lang="ts">
import {ref} from 'vue'
import {Delete,Plus,Document} from '@element-plus/icons-vue'
import {ElMessageBox} from 'element-plus'
import MaterialPicker from '@/components/MaterialPicker.vue'
import type {JsonObject,Material} from '@/domain/types'
const props=defineProps<{config:JsonObject}>();const emit=defineEmits<{preview:[Material]}>()
const opened=ref(false),active=ref(''),target=ref<{project:any;company?:any}|null>(null),selection=ref<Material[]>([])
function project(){const p={id:crypto.randomUUID(),name:'',biddingFiles:[],companies:[]};props.config.projects.push(p);active.value=p.id}
function company(p:any){p.companies.push({id:crypto.randomUUID(),name:'',files:[]})}
function choose(p:any,c?:any){target.value={project:p,company:c};selection.value=c?c.files:p.biddingFiles;opened.value=true}
function confirm(files:Material[]){if(!target.value)return;if(target.value.company)target.value.company.files=files;else target.value.project.biddingFiles=files}
async function remove(p:any){try{await ElMessageBox.confirm(`移除「${p.name||'未命名项目'}」及本次选择的项目资料？资料库文件仍会保留。`,'移除项目',{confirmButtonText:'移除',cancelButtonText:'取消'});props.config.projects=props.config.projects.filter((v:any)=>v.id!==p.id)}catch{}}
</script>
<template>
 <div class="bidding-intro"><p class="help">按项目添加招标文件，再按单位添加投标文件。</p><el-button :icon="Plus" @click="project">添加项目</el-button></div>
 <div v-if="!config.projects.length" class="empty-state">添加项目后，选择本次要检查的文件。</div>
 <el-collapse v-model="active" accordion class="project-list">
  <el-collapse-item v-for="(p,i) in config.projects" :key="p.id" :name="p.id"><template #title><strong>{{p.name||'项目 '+(Number(i)+1)}}</strong><span class="project-count">{{p.biddingFiles.length}} 份招标 · {{p.companies.length}} 家投标单位</span></template>
   <div class="project-editor"><div class="toolbar"><el-input v-model="p.name" :aria-label="'项目 '+(Number(i)+1)+' 名称'" placeholder="项目名称"/><el-button text :icon="Delete" :aria-label="'移除项目 '+(Number(i)+1)" @click="remove(p)"/></div>
    <div class="role-heading"><h3>招标文件</h3><el-button text type="primary" @click="choose(p)">添加文件</el-button></div>
    <p v-if="!p.biddingFiles.length" class="role-empty">用于招标文件检查和联合分析</p>
    <div class="role-file" v-for="f in p.biddingFiles" :key="f.id"><button class="file-link" @click="emit('preview',f)" :title="f.name"><el-icon><Document/></el-icon>{{f.name}}</button><button class="icon-button" :aria-label="'移除 '+f.name" @click="p.biddingFiles=p.biddingFiles.filter((v:Material)=>v.id!==f.id)">×</button></div>
    <div class="role-heading"><h3>投标单位</h3><el-button text type="primary" @click="company(p)">添加单位</el-button></div>
    <p v-if="!p.companies.length" class="role-empty">每家单位分别添加投标文件</p>
    <section v-for="(c,j) in p.companies" :key="c.id" class="company"><div class="toolbar"><el-input v-model="c.name" :aria-label="'投标单位 '+(Number(j)+1)+' 名称'" placeholder="投标单位名称"/><el-button text :icon="Delete" :aria-label="'移除投标单位 '+(Number(j)+1)" @click="p.companies=p.companies.filter((v:any)=>v.id!==c.id)"/></div><div class="role-file" v-for="f in c.files" :key="f.id"><button class="file-link" @click="emit('preview',f)" :title="f.name">{{f.name}}</button><button class="icon-button" :aria-label="'移除 '+f.name" @click="c.files=c.files.filter((v:Material)=>v.id!==f.id)">×</button></div><el-button class="company-add" @click="choose(p,c)" :icon="Plus">添加投标文件</el-button></section>
   </div>
  </el-collapse-item>
 </el-collapse>
 <MaterialPicker v-model="opened" :selected="selection" :multiple="!!target?.company" :title="target?.company?'添加投标文件':'添加招标文件'" @confirm="confirm"/>
</template>
<style scoped>
.bidding-intro{padding:14px}.bidding-intro .help{margin-top:0}.project-list{border-top:0}.project-list :deep(.el-collapse-item__header){height:auto;min-height:52px;padding:10px 14px;line-height:1.6;align-items:start;flex-wrap:wrap}.project-list :deep(.el-collapse-item__content){padding-bottom:0}.project-count{font-size:12px;color:#596b80;margin-left:8px}.project-editor{padding:8px 14px 16px}.project-editor .toolbar{flex-wrap:nowrap}.role-heading{display:flex;justify-content:space-between;align-items:center;margin-top:14px}.role-heading h3{font-size:14px}.role-empty{background:#f5f7fa;color:#596b80;padding:10px;border-radius:6px;font-size:13px}.role-file{display:flex;align-items:center;gap:4px;margin:4px 0;min-width:0}.file-link{border:0;background:none;color:#245ec5;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;padding:5px 0;min-width:0;flex:1}.file-link .el-icon{margin-right:5px}.company{margin:8px 0 12px;background:#f8fafc;border:1px solid #e6ebf1;border-radius:7px;padding:10px}.company-add{width:100%;margin-top:8px}
</style>
