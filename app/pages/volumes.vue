<script setup lang="ts">
import { uniqueSortedConnectors } from '~/types/accounts'

const selectedConnector = ref('all')
const selectedUser = ref('all')

const {
  data: feeTiers,
  status,
  error,
  refresh: refreshFeeTiers
} = await useAccountFeeTiers()

const loading = computed(() => status.value === 'pending')
const rows = computed(() => feeTiers.value ?? [])

const connectorOptions = computed(() => {
  const connectors = uniqueSortedConnectors(rows.value.map(row => row.connector))

  return [
    { label: 'All connectors', value: 'all' },
    ...connectors.map(connector => ({ label: connector, value: connector }))
  ]
})

const userOptions = computed(() => {
  const users = [...new Set(rows.value.map(row => row.account_user))].sort()

  return [
    { label: 'All users', value: 'all' },
    ...users.map(user => ({ label: user, value: user }))
  ]
})

const filteredFeeTiers = computed(() => {
  return rows.value.filter((row) => {
    const connectorMatched = selectedConnector.value === 'all'
      || row.connector === selectedConnector.value
    const userMatched = selectedUser.value === 'all'
      || row.account_user === selectedUser.value

    return connectorMatched && userMatched
  })
})

const filtersActive = computed(() =>
  selectedConnector.value !== 'all'
  || selectedUser.value !== 'all'
)

const snapshotTs = computed(() => {
  let latestTs: string | null = null
  let latestTime = Number.NEGATIVE_INFINITY

  for (const row of rows.value) {
    const timestamp = new Date(row.snapshot_ts).getTime()
    if (!Number.isFinite(timestamp) || timestamp <= latestTime) continue

    latestTime = timestamp
    latestTs = row.snapshot_ts
  }

  return latestTs
})

const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'

  return `${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})

function resetFilters() {
  selectedConnector.value = 'all'
  selectedUser.value = 'all'
}
</script>

<template>
  <AppPage title="Volumes">
    <template #actions>
      <AppRefreshButton
        :loading="loading"
        @refresh="refreshFeeTiers"
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
          <UButton
            label="Reset filters"
            variant="outline"
            color="neutral"
            class="w-fit"
            :disabled="!filtersActive"
            @click="resetFilters"
          />
        </div>
        <div class="text-xs text-muted tabular-nums lg:text-right">
          <p>Snapshot {{ snapshotLabel }}</p>
          <p>Showing {{ filteredFeeTiers.length }} of {{ rows.length }} accounts</p>
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
          title="Failed to load volume data"
          :description="String((error as Error)?.message ?? error)"
        />

        <FeeTiersTable
          :data="filteredFeeTiers"
          :loading="loading"
        />
      </div>
    </template>
  </AppPage>
</template>
