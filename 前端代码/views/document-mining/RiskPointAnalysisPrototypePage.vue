<template>
  <div class="risk-point-prototype-page">
    <RiskPointAnalysisPrototype :hide-close="true" />
  </div>
</template>

<script setup>
import RiskPointAnalysisPrototype from './RiskPointAnalysisPrototype.vue'

defineOptions({ name: 'RiskPointAnalysisPrototypePage' })
</script>

<style scoped>
.risk-point-prototype-page {
  height: calc(100vh - 40px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.risk-point-prototype-page :deep(.risk-point-prototype) {
  flex: 1;
}
</style>
