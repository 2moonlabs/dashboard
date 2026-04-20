<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <AppPage title="Overview">
    <template #default>
      <UCard>
        <template #header>
          <p class="text-xs text-muted uppercase">
            Welcome
          </p>
          <p class="text-xl font-semibold text-highlighted mt-1">
            {{ user?.email ?? 'Trader' }}
          </p>
        </template>

        <p class="text-sm text-muted">
          Pick a section from the sidebar to get started. More widgets coming here soon.
        </p>
      </UCard>
    </template>
  </AppPage>
</template>
