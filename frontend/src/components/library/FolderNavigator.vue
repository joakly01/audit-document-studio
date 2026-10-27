<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder as FolderIcon, Search, Refresh } from '@element-plus/icons-vue'
import type { Folder } from '@/domain/types'
import { spaces } from '@/composables/useFileBrowser'
const props=defineProps<{folders:Folder[];space:string;currentId?:string;loading?:boolean;error?:string}>()
const emit=defineEmits<{space:[string];select:[Folder];refresh:[]}>()
const keyword=ref(''),composing=ref(false),searchText=ref('')
function updateSearch(){if(!composing.value)searchText.value=keyword.value.trim().toLowerCase()}
function filtered(nodes:Folder[]):Folder[]{return nodes.flatMap(node=>{const children=filtered(node.children||[]);return !searchText.value||node.name.toLowerCase().includes(searchText.value)||children.length?[{...node,children:searchText.value&&node.name.toLowerCase().includes(searchText.value)?node.children:children}]:[]})}
const tree=computed(()=>filtered(props.folders))
</script>
<template>
 <aside class="directory-nav">
  <div class="space-select"><el-select :model-value="space" aria-label="资料空间" @change="emit('space',$event)"><el-option v-for="item in spaces" :key="item.value" :value="item.value" :label="item.label" /></el-select></div>
  <div class="directory-search"><el-input v-model="keyword" placeholder="查找目录" aria-label="查找目录" clearable :prefix-icon="Search" @input="updateSearch" @clear="updateSearch" @compositionstart="composing=true" @compositionend="composing=false;updateSearch()"/><el-button text :icon="Refresh" aria-label="刷新目录" title="刷新目录" @click="emit('refresh')"/></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <el-scrollbar class="directory-tree" v-loading="loading">
   <el-tree :data="tree" node-key="id" :props="{label:'name',children:'children'}" :current-node-key="currentId" highlight-current :expand-on-click-node="false" default-expand-all empty-text="暂无目录" @node-click="emit('select',$event)">
    <template #default="{data}"><span class="directory-node" :title="data.path||data.name"><el-icon><FolderIcon/></el-icon><span>{{data.name}}</span></span></template>
   </el-tree>
  </el-scrollbar>
 </aside>
</template>
<style scoped>
.directory-nav{display:flex;flex-direction:column;min-width:0;background:#fff;border-right:1px solid #e6ebf1}.space-select{padding:16px 14px 12px}.space-select .el-select{width:100%}.directory-search{display:flex;align-items:center;gap:4px;padding:0 10px 12px 14px}.directory-tree{flex:1;min-height:180px;padding:0 8px 12px}.directory-node{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px}.directory-node .el-icon{color:#3269db;flex:none}.directory-node>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.directory-nav :deep(.el-tree-node__content){height:38px;border-radius:6px;margin:2px 0}.directory-nav :deep(.el-tree-node.is-current>.el-tree-node__content){background:#eef4ff;color:#2555b4}.directory-nav :deep(.el-alert){margin:0 10px;width:auto}
</style>
