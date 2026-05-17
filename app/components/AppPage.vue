<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <section class="border-b border-default pb-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-highlighted tracking-tight sm:text-2xl">
            {{ title }}
          </h1>
          <p
            v-if="description"
            class="mt-1 text-sm text-muted"
          >
            {{ description }}
          </p>
        </div>

        <div
          v-if="$slots.actions"
          class="flex flex-wrap items-center gap-3"
        >
          <slot name="actions" />
        </div>
      </div>
    </section>

    <section
      v-if="$slots.toolbar"
      class="rounded-xl border border-default bg-elevated/15 p-4"
    >
      <slot name="toolbar" />
    </section>

    <slot />
  </div>
</template>
