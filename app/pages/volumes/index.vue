<script setup lang="ts">
import { uniqueSortedConnectors } from '~/types/accounts'

const selectedConnector = ref('all')
const selectedUser = ref('all')

const {
  data: volumes,
  status,
  error,
  refresh: refreshVolumes
} = await useAccountVolumes()

const loading = computed(() => status.value === 'pending')
const rows = computed(() => volumes.value ?? [])

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

const filteredVolumes = computed(() => {
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

const snapshotTs = computed(() => rows.value[0]?.snapshot_ts ?? null)

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
        @refresh="refreshVolumes"
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
          <p>Showing {{ filteredVolumes.length }} of {{ rows.length }} accounts</p>
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

        <AccountVolumesTable
          :data="filteredVolumes"
          :loading="loading"
        />
      </div>
    </template>
  </AppPage>
</template>
