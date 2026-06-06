<script setup lang="ts">
import type { RangePreset } from '~/types'
import { EXCHANGE_OPTIONS, type ExchangeId } from '~/types/exchanges'

const selectedExchange = ref<ExchangeId>('coinbase')

const {
  data: symbols,
  status: symbolsStatus,
  error: symbolsError,
  refresh: refreshSymbols
} = await useSymbols(selectedExchange)

const selectedSymbol = ref<string | undefined>(symbols.value?.[0])
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
const refreshing = computed(() => symbolsStatus.value === 'pending' || status.value === 'pending')

const fetchError = computed(() => symbolsError.value || historyError.value)

async function refreshPageData() {
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
            :items="EXCHANGE_OPTIONS"
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
          v-else-if="!symbols?.length"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          title="No symbols found"
          description="Symbols RPC returned empty. Check the distinct-symbols function exists for the selected exchange and that authenticated has EXECUTE permission."
        />
        <FundingRateChart :data="history ?? []" :loading="loading" />
        <FundingRateTable :data="history ?? []" :loading="loading" />
      </div>
    </template>
  </AppPage>
</template>
