<script setup lang="ts">
import {Folder,DocumentCopy,Collection,Setting,Fold,Expand} from '@element-plus/icons-vue'
import {useRoute} from 'vue-router'
import {toolMap} from '@/domain/tools'
import {toolVisuals} from '@/domain/toolVisuals'
import type {ToolId} from '@/domain/types'
withDefaults(defineProps<{collapsed?:boolean;collapsible?:boolean}>(),{collapsed:false,collapsible:true})
defineEmits<{navigate:[];collapse:[]}>()
const route=useRoute()
const sections:{label:string;tools:ToolId[]}[]=[
 {label:'基础分析',tools:['extract','word','theme','timeline']},
 {label:'审计专题',tools:['risk','meeting','contract','bidding','prepaid']},
 {label:'数据核对',tools:['engineering','association']}
]
const links=[{path:'/library',label:'资料管理',icon:Folder},{path:'/tasks',label:'任务中心',icon:DocumentCopy},{path:'/templates',label:'提取模板',icon:Collection},{path:'/prompts',label:'提示词库',icon:Setting}]
</script>
<template>
 <div class="studio-navigation" :class="{collapsed}">
  <router-link to="/library" class="brand" @click="$emit('navigate')"><span class="brand-mark"><el-icon><Collection/></el-icon></span><span v-if="!collapsed">文档挖掘助手</span></router-link>
  <button v-if="collapsible" class="sidebar-collapse" :aria-label="collapsed?'展开菜单':'折叠菜单'" @click="$emit('collapse')"><el-icon><Expand v-if="collapsed"/><Fold v-else/></el-icon><span v-if="!collapsed">折叠菜单</span></button>
  <nav class="navigation-scroll" aria-label="应用导航">
   <el-tooltip v-for="link in links" :key="link.path" :content="link.label" placement="right" :disabled="!collapsed"><router-link :to="link.path" :aria-label="link.label" :class="['navigation-link',{active:route.path===link.path}]" @click="$emit('navigate')"><el-icon><component :is="link.icon"/></el-icon><span v-if="!collapsed">{{link.label}}</span></router-link></el-tooltip>
   <section v-for="section in sections" :key="section.label" class="navigation-group"><h2 v-if="!collapsed">{{section.label}}</h2><el-tooltip v-for="id in section.tools" :key="id" :content="toolMap[id].name" placement="right" :disabled="!collapsed"><router-link :to="'/tool/'+id" :aria-label="toolMap[id].name" :class="['navigation-link',{active:route.path.startsWith('/tool/'+id)}]" @click="$emit('navigate')"><el-icon><component :is="toolVisuals[id].icon"/></el-icon><span v-if="!collapsed">{{toolMap[id].name}}</span></router-link></el-tooltip></section>
  </nav>
 </div>
</template>
<style scoped>
.studio-navigation{height:100%;display:flex;flex-direction:column;background:#182f41;color:#a9bed0;padding-bottom:36px;min-height:0}.brand{display:flex;align-items:center;gap:10px;height:56px;min-height:56px;padding:0 16px;color:#fff;font-size:16px;font-weight:600;white-space:nowrap}.brand-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:#ffffff0b;border:1px solid #ffffff1a;color:#9dc4ff;flex:none}.brand-mark .el-icon{font-size:22px}.sidebar-collapse{display:flex;gap:10px;align-items:center;min-height:32px;padding:0 20px;border:0;background:transparent;color:#a9bed0;text-align:left;font-size:14px}.navigation-scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 10px 12px;min-height:0;scrollbar-width:thin;scrollbar-color:#627d90 transparent}.navigation-link{display:flex;align-items:center;gap:10px;min-height:36px;padding:5px 10px;margin-bottom:0;border-radius:6px;color:#b5c7d7;font-size:16px;line-height:1.5;white-space:nowrap;border-left:3px solid transparent}.navigation-link .el-icon{font-size:18px;flex:none;color:#94afc4}.navigation-link:hover{background:#ffffff0b;color:#fff}.navigation-link.active{background:#ffffff0f;border-left-color:#8baff0;color:#fff}.navigation-link.active .el-icon{color:#b8d1ff}.navigation-group h2{font-size:14px;font-weight:400;color:#9db5c9;padding:6px 10px 2px;line-height:20px;margin:0}.collapsed .brand{padding:0 14px}.collapsed .sidebar-collapse{justify-content:center;padding:0}.collapsed .navigation-scroll{padding:8px}.collapsed .navigation-link{padding:8px;justify-content:center}.collapsed .navigation-group{border-top:1px solid #ffffff15;padding-top:8px;margin-top:8px}
</style>
