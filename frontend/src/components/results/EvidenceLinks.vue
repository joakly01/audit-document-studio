<script setup lang="ts">
import type {Evidence} from '@/domain/types'
defineProps<{evidence:Evidence[]}>()
defineEmits<{open:[evidence:Evidence]}>()
</script>
<template><span class="evidence-links"><template v-if="evidence.length"><el-button v-for="(source,index) in evidence" :key="`${source.fileId}-${index}`" text type="primary" @click="$emit('open',source)" :title="source.fileName">{{ evidence.length===1 ? '查看来源' : `来源 ${index+1}` }}<span v-if="source.page"> · 第 {{source.page}} 页</span></el-button></template><span v-else class="muted">未提供来源</span></span></template>
<style scoped>.evidence-links{display:flex;flex-wrap:wrap;gap:4px}.evidence-links .el-button{margin:0;white-space:normal;text-align:left;padding:4px}.muted{font-size:14px;color:#596b80}</style>
