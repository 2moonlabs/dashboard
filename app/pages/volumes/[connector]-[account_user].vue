<script setup lang="ts">
import {
  accountVolumePath,
  uniqueSortedConnectors,
  type AccountVolumeRangeDays
} from '~/types/accounts'

const route = useRoute()
const accountName = ref('main')
const historyRangeDays = ref<AccountVolumeRangeDays>(30)

const historyRangeOptions: { label: string, value: AccountVolumeRangeDays }[] = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 }
]

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

const connector = computed(() => routeParam(route.params.connector))
const accountUser = computed(() => routeParam(route.params.account_user))
const initialConnector = connector.value
const initialAccountUser = accountUser.value
const selectedConnector = ref(initialConnector)
const selectedUser = ref(initialAccountUser)

const {
  data: volumes,
  status: volumesStatus,
  error: volumesError,
  refresh: refreshVolumes
} = await useAccountVolumes()

const rows = computed(() => volumes.value ?? [])
const connectorOptions = computed(() => uniqueSortedConnectors(
  rows.value.map(row => row.connector)
).map(value => ({ label: value, value })))
const userOptions = computed(() => [...new Set(
  rows.value
    .filter(row => row.connector === selectedConnector.value)
    .map(row => row.account_user)
)].sort().map(value => ({ label: value, value })))
const filtersActive = computed(() =>
  selectedConnector.value !== initialConnector
  || selectedUser.value !== initialAccountUser
)

const {
  data: volumeHistory,
  status: historyStatus,
  error: historyError,
  refresh: refreshVolumeHistory
} = await useAccountVolumeHistory(
  connector,
  accountUser,
  accountName,
  historyRangeDays
)

const loading = computed(() => historyStatus.value === 'pending')
const refreshing = computed(() =>
  volumesStatus.value === 'pending' || historyStatus.value === 'pending'
)
const fetchError = computed(() => volumesError.value || historyError.value)

watch([connector, accountUser], ([nextConnector, nextAccountUser]) => {
  selectedConnector.value = nextConnector
  selectedUser.value = nextAccountUser
})

watch(selectedConnector, (nextConnector) => {
  const users = rows.value
    .filter(row => row.connector === nextConnector)
    .map(row => row.account_user)

  if (!users.includes(selectedUser.value)) {
    selectedUser.value = users.sort()[0] ?? ''
  }
})

watch([selectedConnector, selectedUser], async ([nextConnector, nextAccountUser]) => {
  if (nextConnector === connector.value && nextAccountUser === accountUser.value) return

  const account = rows.value.find(row =>
    row.connector === nextConnector && row.account_user === nextAccountUser
  )
  if (!account) return

  await navigateTo(accountVolumePath(account))
})

function resetFilters() {
  selectedConnector.value = initialConnector
  selectedUser.value = initialAccountUser
}

async function refreshPageData() {
  await Promise.all([
    refreshVolumes(),
    refreshVolumeHistory()
  ])
}
</script>

<template>
  <AppPage title="Volumes">
    <template #actions>
      <AppRefreshButton
        :loading="refreshing"
        @refresh="refreshPageData"
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

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end lg:shrink-0">
          <USelect
            v-model="historyRangeDays"
            :items="historyRangeOptions"
            value-key="value"
            aria-label="History range"
            class="min-w-36"
          />
        </div>
      </div>
    </template>

    <template #default>
      <div class="space-y-4 sm:space-y-6">
        <UAlert
          v-if="fetchError"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Failed to load volume history"
          :description="String((fetchError as Error)?.message ?? fetchError)"
        />

        <AccountVolumesChart
          :data="volumeHistory ?? []"
          :loading="loading"
        />
      </div>
    </template>
  </AppPage>
</template>
