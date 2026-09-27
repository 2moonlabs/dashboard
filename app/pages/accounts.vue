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
// Reset covers the dropdowns only; the checkbox is a view toggle the user keeps.
const filtersActive = computed(() =>
  selectedConnectors.value.length > 0
  || selectedUsers.value.length > 0
  || selectedTypes.value.length > 0
)

function resetFilters() {
  selectedConnectors.value = []
  selectedUsers.value = []
  selectedTypes.value = []
}

const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'
  return `Snapshot ${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})
const summary = computed(() =>
  `${snapshotLabel.value} · Showing ${filteredBalances.value.length} of ${balances.value.length} accounts`
)
</script>

<template>
  <AppPage
    title="Accounts"
    :description="summary"
  >
    <template #actions>
      <AppRefreshButton
        :loading="loading"
        @refresh="refreshBalances"
      />
    </template>

    <template #toolbar>
      <AppFilterSelect
        v-model="selectedConnectors"
        :items="connectorOptions"
        placeholder="All connectors"
        class="w-full sm:w-36"
      />
      <AppFilterSelect
        v-model="selectedUsers"
        :items="userOptions"
        placeholder="All users"
        class="w-full sm:w-32"
      />
      <AppFilterSelect
        v-model="selectedTypes"
        :items="typeOptions"
        placeholder="All types"
        class="w-full sm:w-32"
      />
      <UButton
        label="Reset"
        variant="outline"
        color="neutral"
        size="sm"
        :disabled="!filtersActive"
        @click="resetFilters"
      />
    </template>

    <template #toggles>
      <UCheckbox
        v-model="showSmallBalances"
        label="Show small balances"
        size="sm"
        class="items-center"
      />
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
