<script setup lang="ts">
import { uniqueSortedConnectors } from '~/types/accounts'

const selectedConnector = ref('all')
const selectedUser = ref('all')
const selectedType = ref('all')
const showSmallBalances = ref(false)

const {
  data: accountBalances,
  status,
  error,
  refresh: refreshBalances
} = await useLatestAccountBalances()

const loading = computed(() => status.value === 'pending')
const balances = computed(() => accountBalances.value?.balances ?? [])
const snapshotTs = computed(() => accountBalances.value?.snapshotTs ?? null)

const connectorOptions = computed(() => {
  const connectors = uniqueSortedConnectors(balances.value.map(account => account.connector))

  return [
    { label: 'All connectors', value: 'all' },
    ...connectors.map(connector => ({ label: connector, value: connector }))
  ]
})

const typeOptions = computed(() => {
  const types = [...new Set([
    'spot',
    'futures',
    'margin',
    ...balances.value.map(account => account.account_type)
  ])].sort()

  return [
    { label: 'All types', value: 'all' },
    ...types.map(type => ({ label: type, value: type }))
  ]
})

const userOptions = computed(() => {
  const users = [...new Set(balances.value.map(account => account.account_user))].sort()

  return [
    { label: 'All users', value: 'all' },
    ...users.map(user => ({ label: user, value: user }))
  ]
})

const filteredBalances = computed(() => {
  return balances.value.flatMap((account) => {
    const connectorMatched = selectedConnector.value === 'all'
      || account.connector === selectedConnector.value
    const userMatched = selectedUser.value === 'all'
      || account.account_user === selectedUser.value
    const typeMatched = selectedType.value === 'all'
      || account.account_type === selectedType.value

    if (!connectorMatched || !userMatched || !typeMatched) return []
    if (!showSmallBalances.value && account.total !== null && account.total < 1) return []

    return [{
      ...account,
      assets: showSmallBalances.value
        ? account.assets
        : account.assets.filter(asset => asset.value >= 1)
    }]
  })
})

const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'
  return `${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})
</script>

<template>
  <AppPage title="Account">
    <template #actions>
      <AppRefreshButton
        :loading="loading"
        @refresh="refreshBalances"
      />
    </template>

    <template #toolbar>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <USelect
            v-model="selectedConnector"
            :items="connectorOptions"
            value-key="value"
            class="min-w-44"
          />
          <USelect
            v-model="selectedUser"
            :items="userOptions"
            value-key="value"
            class="min-w-36"
          />
          <USelect
            v-model="selectedType"
            :items="typeOptions"
            value-key="value"
            class="min-w-36"
          />
          <UCheckbox
            v-model="showSmallBalances"
            label="Show small balances"
            class="items-center"
          />
        </div>
        <div class="text-xs text-muted tabular-nums lg:text-right">
          <p>Snapshot {{ snapshotLabel }}</p>
          <p>Showing {{ filteredBalances.length }} of {{ balances.length }} accounts</p>
        </div>
      </div>
    </template>

    <template #default>
      <div class="space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Failed to load account balances"
          :description="String((error as Error)?.message ?? error)"
        />

        <ClientOnly>
          <AccountsTable
            :data="filteredBalances"
            :loading="loading"
          />

          <template #fallback>
            <UCard :ui="{ body: 'p-0 sm:p-0' }">
              <div class="flex items-center justify-center py-10 text-sm text-muted">
                Loading account balances
              </div>
            </UCard>
          </template>
        </ClientOnly>
      </div>
    </template>
  </AppPage>
</template>
