<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import {tools} from './domain/tools'
import {service} from './services/service'
const route=useRoute()
const embedded=new URLSearchParams(location.search).get('embed')==='1'
const active=computed(()=>route.path)
</script>
<template>
 <div class="studio-shell" :class="{embedded}">
  <nav v-if="!embedded" class="app-nav" aria-label="应用导航">
   <router-link to="/library" class="brand"><span class="brand-mark">文</span><span>文档挖掘助手</span></router-link>
   <div class="nav-items"><router-link to="/library" :class="{active:active==='/library'}">资料管理</router-link>
    <el-dropdown trigger="click"><button class="nav-dropdown" :class="{active:active.startsWith('/tool/')}">分析工具 <span aria-hidden="true">⌄</span></button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="tool in tools" :key="tool.id" @click="$router.push('/tool/'+tool.id)">{{tool.name}}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
    <router-link to="/templates" :class="{active:active==='/templates'}">提取模板</router-link><router-link to="/prompts" :class="{active:active==='/prompts'}">提示词库</router-link><router-link to="/tasks" :class="{active:active==='/tasks'}">任务中心</router-link>
   </div>
   <span v-if="service.capabilities.demo" class="demo-badge">演示数据</span>
  </nav>
  <main class="app-main"><router-view /></main>
 </div>
</template>
