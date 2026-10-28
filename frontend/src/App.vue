<script setup lang="ts">
import {ref} from 'vue'
import {Menu} from '@element-plus/icons-vue'
import StudioNavigation from './components/StudioNavigation.vue'
import {service} from './services/service'
const embedded=new URLSearchParams(location.search).get('embed')==='1'
const collapsed=ref(false),mobileNavigation=ref(false)
</script>
<template>
 <div class="studio-shell" :class="{embedded,'navigation-collapsed':collapsed}">
  <aside v-if="!embedded" class="app-nav"><StudioNavigation :collapsed="collapsed" @collapse="collapsed=!collapsed"/></aside>
  <header v-if="!embedded" class="mobile-topbar"><el-button :icon="Menu" text aria-label="打开功能导航" @click="mobileNavigation=true"/><span>文档挖掘助手</span></header>
  <span v-if="service.capabilities.demo" class="demo-badge">{{collapsed&&!embedded?'演示':'演示数据'}}</span>
  <main class="app-main"><router-view /></main>
  <el-drawer v-if="!embedded" v-model="mobileNavigation" title="功能导航" direction="ltr" size="260px" class="navigation-drawer"><StudioNavigation :collapsible="false" @navigate="mobileNavigation=false"/></el-drawer>
 </div>
</template>
