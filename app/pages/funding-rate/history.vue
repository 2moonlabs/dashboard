<script setup lang="ts">
import type { RangePreset } from '~/types'
import { EXCHANGE_OPTIONS, type ExchangeId } from '~/types/exchanges'

const selectedExchange = ref<ExchangeId>('coinbase')

const { data: symbols, error: symbolsError } = await useSymbols(selectedExchange)

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
  { label: 'All', value: 'all' }
]
const range = ref<RangePreset>('week')

const { data: history, status, error: historyError } = await useFundingHistory(
  selectedExchange,
  selectedSymbol,
  range
)
const loading = computed(() => status.value === 'pending')

const fetchError = computed(() => symbolsError.value || historyError.value)
</script>

<template>
  <UDashboardPanel id="funding-history">
    <template #header>
      <UDashboardNavbar title="Funding Rate History" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
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
        </template>
        <template #right>
          <USelect
            v-model="range"
            :items="rangeOptions"
            value-key="value"
            class="min-w-36"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
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
        <FundingRateChart :data="history ?? []" />
        <FundingRateTable :data="history ?? []" :loading="loading" />
      </div>
    </template>
  </UDashboardPanel>
</template>
