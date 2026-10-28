<script setup lang="ts">
import type {ToolId} from '@/domain/types'
import {toolVisuals} from '@/domain/toolVisuals'
defineProps<{tool:ToolId}>()
</script>
<template><span class="tool-glyph" :style="{color:toolVisuals[tool].color,background:toolVisuals[tool].background}" aria-hidden="true"><el-icon><component :is="toolVisuals[tool].icon"/></el-icon></span></template>
<style scoped>.tool-glyph{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;border-radius:7px}.tool-glyph .el-icon{font-size:19px}</style>
