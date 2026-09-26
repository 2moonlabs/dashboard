<script setup lang="ts">
import { uniqueSortedConnectors } from '~/types/accounts'

const selectedConnectors = ref<string[]>([])
const selectedUsers = ref<string[]>([])
const selectedTypes = ref<string[]>([])
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

const connectorOptions = computed(() => uniqueSortedConnectors(balances.value.map(account => account.connector)))

const typeOptions = computed(() => [...new Set([
  'spot',
  'futures',
  'margin',
  ...balances.value.map(account => account.account_type)
])].sort())

const userOptions = computed(() => [...new Set(balances.value.map(account => account.account_user))].sort())

const filteredBalances = computed(() => {
  return balances.value.flatMap((account) => {
    const matched = matchesFilter(selectedConnectors.value, account.connector)
      && matchesFilter(selectedUsers.value, account.account_user)
      && matchesFilter(selectedTypes.value, account.account_type)

    if (!matched) return []
    if (!showSmallBalances.value && account.total !== null && account.total < 1) return []

    return [{
      ...account,
      assets: showSmallBalances.value
        ? account.assets
        : account.assets.filter(asset => asset.value >= 1)
    }]
  })
})
const filtersActive = computed(() =>
  selectedConnectors.value.length > 0
  || selectedUsers.value.length > 0
  || selectedTypes.value.length > 0
  || showSmallBalances.value
)

function resetFilters() {
  selectedConnectors.value = []
  selectedUsers.value = []
  selectedTypes.value = []
  showSmallBalances.value = false
}

const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'
  return `${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})
</script>

<template>
  <AppPage title="Accounts">
    <template #actions>
      <AppRefreshButton
        :loading="loading"
        @refresh="refreshBalances"
      />
    </template>

    <template #toolbar>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <AppFilterSelect
              v-model="selectedConnectors"
              :items="connectorOptions"
              placeholder="All connectors"
              class="sm:w-44"
            />
            <AppFilterSelect
              v-model="selectedUsers"
              :items="userOptions"
              placeholder="All users"
              class="sm:w-36"
            />
            <AppFilterSelect
              v-model="selectedTypes"
              :items="typeOptions"
              placeholder="All types"
              class="sm:w-36"
            />
            <UButton
              label="Reset filters"
              variant="outline"
              color="neutral"
              class="w-fit"
              :disabled="!filtersActive"
              @click="resetFilters"
            />
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <UCheckbox
              v-model="showSmallBalances"
              label="Show small balances"
              class="items-center"
            />
          </div>
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
