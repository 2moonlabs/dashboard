<script setup lang="ts">
import { CONNECTOR_OPTIONS, uniqueSortedConnectors } from '~/types/accounts'

const selectedConnector = ref('all')

const { data: accounts, status, error } = await useAccounts()

const loading = computed(() => status.value === 'pending')

const connectorOptions = computed(() => {
  const connectors = uniqueSortedConnectors([
    ...CONNECTOR_OPTIONS.map(option => option.value),
    ...(accounts.value ?? []).map(account => account.connector)
  ])

  return [
    { label: 'All connectors', value: 'all' },
    ...connectors.map(connector => ({ label: connector, value: connector }))
  ]
})

const filteredAccounts = computed(() => {
  if (selectedConnector.value === 'all') return accounts.value ?? []
  return (accounts.value ?? []).filter(account => account.connector === selectedConnector.value)
})
</script>

<template>
  <AppPage title="Account Balances">
    <template #toolbar>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <USelect
          v-model="selectedConnector"
          :items="connectorOptions"
          value-key="value"
          class="min-w-44"
        />
      </div>
    </template>

    <template #default>
      <div class="space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Failed to load accounts"
          :description="String((error as Error)?.message ?? error)"
        />

        <AccountsTable
          :data="filteredAccounts"
          :loading="loading"
        />
      </div>
    </template>
  </AppPage>
</template>
