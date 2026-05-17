<script setup lang="ts">
import { format } from 'date-fns'
import type { TableColumn } from '@nuxt/ui'
import type { AccountTransfer } from '~/types/accounts'
import { transferSideLabel } from '~/types/accounts'

defineProps<{
  data: AccountTransfer[]
  loading?: boolean
}>()

function formatTime(value: string) {
  return format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
}

function formatType(value: string) {
  const label = value.replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 12
  }).format(value)
}

const columns: TableColumn<AccountTransfer>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, row.original.id)
  },
  {
    accessorKey: 'ts',
    header: 'Time',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, formatTime(row.original.ts))
  },
  {
    accessorKey: 'transfer_type',
    header: 'Type',
    cell: ({ row }) => formatType(row.original.transfer_type)
  },
  {
    id: 'from',
    header: 'From',
    cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, transferSideLabel(row.original, 'from'))
  },
  {
    id: 'to',
    header: 'To',
    cell: ({ row }) => h('span', { class: 'font-mono text-xs' }, transferSideLabel(row.original, 'to'))
  },
  {
    accessorKey: 'asset',
    header: 'Asset'
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, formatAmount(row.original.amount))
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => row.original.note || h('span', { class: 'text-muted' }, '-')
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      :data="data"
      :columns="columns"
      :loading="loading"
      sticky
    >
      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No transfers
        </div>
      </template>
    </UTable>
  </UCard>
</template>
