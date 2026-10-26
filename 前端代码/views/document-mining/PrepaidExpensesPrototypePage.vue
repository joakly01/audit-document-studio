<template>
  <div class="prepaid-expenses-prototype-page">
    <PrepaidExpensesPrototype :hide-close="true" />
  </div>
</template>

<script setup>
import PrepaidExpensesPrototype from './PrepaidExpensesPrototype.vue'

defineOptions({ name: 'PrepaidExpensesPrototypePage' })
</script>

<style scoped>
.prepaid-expenses-prototype-page {
  height: 100vh;
  overflow: hidden;
  background: #f5f5f5;
}

.prepaid-expenses-prototype-page :deep(.prepaid-expenses-prototype) {
  height: 100vh;
}
</style>
