<script setup lang="ts">
defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  (event: 'refresh'): void
}>()
</script>

<template>
  <UButton
    aria-label="Refresh"
    icon="i-lucide-refresh-cw"
    variant="outline"
    color="neutral"
    :loading="loading"
    :disabled="loading"
    @click="emit('refresh')"
  />
</template>
