<script setup lang="ts">
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

function formatInterval(n: number | null): string {
  if (n === null) return '-'
  if (n >= 1000) return `${n / 3600}h`
  return `${n}h`
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(6)}%`
}

function formatUtcDateTime(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

const columns: TableColumn<FundingRate>[] = [
  {
    accessorKey: 'funding_time',
    header: 'Time',
    cell: ({ row }) => formatUtcDateTime(row.original.funding_time)
  },
  {
    accessorKey: 'funding_interval',
    header: 'Funding Interval',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => formatInterval(row.original.funding_interval)
  },
  {
    accessorKey: 'funding_rate',
    header: 'Funding Rate',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => {
      const v = row.original.funding_rate
      const className = v < 0 ? 'text-pnl-down' : v > 0 ? 'text-pnl-up' : 'text-muted'
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
      :ui="tableUi()"
      sticky
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
        class="hidden sm:flex"
        :total="data.length"
        :items-per-page="pageSize"
        :sibling-count="1"
        show-edges
      />
      <UPagination
        v-model:page="page"
        class="sm:hidden"
        :total="data.length"
        :items-per-page="pageSize"
        :sibling-count="0"
      />
    </div>
  </UCard>
</template>
