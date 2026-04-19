<script setup lang="ts">
import { format } from 'date-fns'
import type { TableColumn } from '@nuxt/ui'
import type { FundingRate } from '~/types'

const props = defineProps<{
  data: FundingRate[]
  loading?: boolean
}>()

const pageSize = 20
const page = ref(1)

const pagedRows = computed(() =>
  props.data.slice((page.value - 1) * pageSize, page.value * pageSize)
)

watch(() => props.data, () => {
  page.value = 1
})

function formatInterval(n: number): string {
  if (n >= 1000) return `${n / 3600}h`
  return `${n}h`
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(6)}%`
}

const columns: TableColumn<FundingRate>[] = [
  {
    accessorKey: 'funding_time',
    header: 'Time',
    cell: ({ row }) => format(new Date(row.original.funding_time), 'yyyy-MM-dd HH:mm:ss')
  },
  {
    accessorKey: 'funding_interval',
    header: 'Funding Interval',
    cell: ({ row }) => formatInterval(row.original.funding_interval)
  },
  {
    accessorKey: 'funding_rate',
    header: 'Funding Rate',
    cell: ({ row }) => {
      const v = row.original.funding_rate
      const className = v < 0 ? 'text-error' : v > 0 ? 'text-success' : 'text-muted'
      return h('span', { class: `${className} tabular-nums` }, formatPercent(v))
    }
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      :data="pagedRows"
      :columns="columns"
      :loading="loading"
      sticky
      class="min-h-48"
    >
      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No data
        </div>
      </template>
    </UTable>

    <div
      v-if="data.length > pageSize"
      class="flex items-center justify-between px-4 py-3 border-t border-default"
    >
      <p class="text-xs text-muted tabular-nums">
        Total {{ data.length }} rows
      </p>
      <UPagination
        v-model:page="page"
        :total="data.length"
        :items-per-page="pageSize"
        show-edges
      />
    </div>
  </UCard>
</template>
