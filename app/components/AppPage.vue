<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="space-y-4">
    <section class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <h1 class="min-w-0 text-xl font-semibold text-highlighted tracking-tight sm:text-2xl">
        {{ title }}
      </h1>

      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-3"
      >
        <slot name="actions" />
      </div>
    </section>

    <!-- The toolbar sits closer to the content it filters than to the header. -->
    <div class="space-y-3">
      <section
        v-if="$slots.toolbar || description"
        class="flex flex-wrap items-center gap-x-3 gap-y-2"
      >
        <slot name="toolbar" />
        <p
          v-if="description"
          class="text-xs text-muted tabular-nums sm:ml-auto"
        >
          {{ description }}
        </p>
      </section>

      <div
        v-if="$slots.toggles"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end"
      >
        <slot name="toggles" />
      </div>

      <slot />
    </div>
  </div>
</template>
