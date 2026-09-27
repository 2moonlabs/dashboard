<script setup lang="ts">
import { uniqueSortedConnectors } from '~/types/accounts'

const selectedConnectors = ref<string[]>([])
const selectedUsers = ref<string[]>([])

const {
  data: volumes,
  status,
  error,
  refresh: refreshVolumes
} = await useAccountVolumes()

const loading = computed(() => status.value === 'pending')
const rows = computed(() => volumes.value ?? [])

const connectorOptions = computed(() => uniqueSortedConnectors(rows.value.map(row => row.connector)))

const userOptions = computed(() => [...new Set(rows.value.map(row => row.account_user))].sort())

const filteredVolumes = computed(() => rows.value.filter(row =>
  matchesFilter(selectedConnectors.value, row.connector)
  && matchesFilter(selectedUsers.value, row.account_user)
))

const filtersActive = computed(() =>
  selectedConnectors.value.length > 0
  || selectedUsers.value.length > 0
)

const snapshotTs = computed(() => rows.value[0]?.snapshot_ts ?? null)

const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'

  return `Snapshot ${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})

const summary = computed(() =>
  `${snapshotLabel.value} · Showing ${filteredVolumes.value.length} of ${rows.value.length} accounts`
)

function resetFilters() {
  selectedConnectors.value = []
  selectedUsers.value = []
}
</script>

<template>
  <AppPage
    title="Volumes"
    :description="summary"
  >
    <template #actions>
      <AppRefreshButton
        :loading="loading"
        @refresh="refreshVolumes"
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
      <UButton
        label="Reset"
        variant="outline"
        color="neutral"
        size="sm"
        :disabled="!filtersActive"
        @click="resetFilters"
      />
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
