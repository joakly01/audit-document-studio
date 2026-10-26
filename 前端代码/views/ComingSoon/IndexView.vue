<template>
  <div class="coming-soon-view">
    <el-empty description="功能建设中，敬请期待" />
  </div>
</template>

<script setup>
defineOptions({ name: 'ComingSoonView' })
</script>

<style scoped>
.coming-soon-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
}
</style>
