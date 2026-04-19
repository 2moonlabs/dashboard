<script setup lang="ts">
const user = useSupabaseUser()
</script>

<template>
  <UDashboardPanel id="overview">
    <template #header>
      <UDashboardNavbar title="Overview">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
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
  </UDashboardPanel>
</template>
