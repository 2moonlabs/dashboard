<script setup lang="ts">
import type { RangePreset } from '~/types'

const {
  data: exchangeOptions,
  status: exchangesStatus,
  error: exchangesError,
  refresh: refreshExchanges
} = await useFundingExchanges()

const selectedExchange = ref<string | undefined>(exchangeOptions.value?.[0]?.value)

watch(exchangeOptions, (list) => {
  if (!list?.length) {
    selectedExchange.value = undefined
    return
  }

  if (!selectedExchange.value || !list.some(option => option.value === selectedExchange.value)) {
    selectedExchange.value = list[0]!.value
  }
}, { immediate: true })

const {
  data: symbols,
  status: symbolsStatus,
  error: symbolsError,
  refresh: refreshSymbols
} = await useSymbols(selectedExchange)

const selectedSymbol = ref<string | undefined>(symbols.value?.[0])

watch(selectedExchange, () => {
  selectedSymbol.value = undefined
})

watch(symbols, (list) => {
  if (!list?.length) {
    selectedSymbol.value = undefined
    return
  }
  if (!selectedSymbol.value || !list.includes(selectedSymbol.value)) {
    selectedSymbol.value = list[0]!
  }
})

const rangeOptions: { label: string, value: RangePreset }[] = [
  { label: 'Last Week', value: 'week' },
  { label: 'Last Month', value: 'month' },
  { label: 'Last 1000 Rows', value: 'all' }
]
const range = ref<RangePreset>('week')

const {
  data: history,
  status,
  error: historyError,
  refresh: refreshHistory
} = await useFundingHistory(
  selectedExchange,
  selectedSymbol,
  range
)
const loading = computed(() => status.value === 'pending')
const refreshing = computed(() =>
  exchangesStatus.value === 'pending' || symbolsStatus.value === 'pending' || status.value === 'pending'
)

const fetchError = computed(() => exchangesError.value || symbolsError.value || historyError.value)

const emptyState = computed(() => {
  if (!exchangeOptions.value?.length) {
    return {
      title: 'No exchanges found',
      description: 'perpetual_contracts has no rows. Insert contracts or confirm the current user can read the table.'
    }
  }

  if (!symbols.value?.length) {
    return {
      title: 'No symbols found',
      description: `No perpetual contracts found for ${(selectedExchange.value ?? '').toUpperCase()}.`
    }
  }

  return null
})

async function refreshPageData() {
  await refreshExchanges()
  await refreshSymbols()
  await nextTick()
  await refreshHistory()
}
</script>

<template>
  <AppPage title="Funding Rate History">
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
            v-model="selectedExchange"
            :items="exchangeOptions ?? []"
            value-key="value"
            class="min-w-36"
          />
          <USelectMenu
            v-model="selectedSymbol"
            :items="symbols ?? []"
            placeholder="Select symbol"
            class="min-w-56"
            searchable
          />
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end lg:shrink-0">
          <USelect
            v-model="range"
            :items="rangeOptions"
            value-key="value"
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
          title="Failed to load data"
          :description="String((fetchError as Error)?.message ?? fetchError)"
        />
        <UAlert
          v-else-if="emptyState"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          :title="emptyState.title"
          :description="emptyState.description"
        />
        <FundingRateChart :data="history ?? []" :loading="loading" />
        <FundingRateTable :data="history ?? []" :loading="loading" />
      </div>
    </template>
  </AppPage>
</template>
