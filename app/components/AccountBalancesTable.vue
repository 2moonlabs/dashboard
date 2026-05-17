<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AccountBalance, AccountSnapshotAsset } from '~/types/accounts'
import { accountRefKey } from '~/types/accounts'

const props = defineProps<{
  data: AccountBalance[]
  loading?: boolean
}>()

const expanded = ref<Record<string, boolean>>({})

const totalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
})

const balanceFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 12
})

type AccountStatus = 'Active' | 'Idle'

const statusDotClass: Record<AccountStatus, string> = {
  Active: 'bg-success',
  Idle: 'bg-muted'
}

const total = computed(() =>
  props.data.reduce((sum, account) => sum + (account.total ?? 0), 0)
)

const expandedOptions = {
  getRowCanExpand: (row: { original: AccountBalance }) => row.original.assets.length > 0
}

function getDefaultExpanded(data: AccountBalance[]) {
  return Object.fromEntries(
    data
      .filter(account => account.assets.length)
      .map(account => [accountRefKey(account), true])
  )
}

watch(() => props.data, (data) => {
  expanded.value = getDefaultExpanded(data)
}, { immediate: true })

function getRowId(row: AccountBalance) {
  return accountRefKey(row)
}

function formatCurrency(value: number) {
  return `$${totalFormatter.format(value)}`
}

function formatAccountTotal(value: number | null) {
  return value === null ? 'No data' : formatCurrency(value)
}

function formatBalance(value: number) {
  return balanceFormatter.format(value)
}

function formatAccount(row: AccountBalance) {
  return `${row.connector} / ${row.account_type} / ${row.account_user} / ${row.account_name}`
}

function getAccountStatus(_row: AccountBalance): AccountStatus {
  return 'Active'
}

const columns: TableColumn<AccountBalance>[] = [
  {
    id: 'expand',
    header: '',
    cell: ({ row }) => {
      if (!row.getCanExpand()) return null

      return h(resolveComponent('UButton'), {
        'aria-label': row.getIsExpanded() ? 'Collapse assets' : 'Expand assets',
        'color': 'neutral',
        'icon': row.getIsExpanded() ? 'i-lucide-minus' : 'i-lucide-plus',
        'size': 'xs',
        'variant': 'ghost',
        'onClick': (event: MouseEvent) => {
          event.stopPropagation()
          row.toggleExpanded()
        }
      })
    }
  },
  {
    id: 'account',
    header: 'Account',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm text-highlighted' }, formatAccount(row.original))
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = getAccountStatus(row.original)

      return h(
        'span',
        { class: 'inline-flex items-center gap-1.5 text-xs text-muted' },
        [
          h('span', { class: `size-1.5 rounded-full ${statusDotClass[status]}` }),
          status
        ]
      )
    }
  },
  {
    accessorKey: 'total',
    header: 'Total',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => h(
      'span',
      { class: row.original.total === null ? 'text-xs text-muted' : 'tabular-nums text-highlighted' },
      formatAccountTotal(row.original.total)
    )
  }
]

const assetColumns: TableColumn<AccountSnapshotAsset>[] = [
  {
    accessorKey: 'asset',
    header: 'Asset',
    cell: ({ row }) => h('span', { class: 'text-highlighted' }, row.original.asset)
  },
  {
    accessorKey: 'balance',
    header: 'Balance',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => h('span', { class: 'tabular-nums text-highlighted' }, formatBalance(row.original.balance))
  },
  {
    accessorKey: 'quote',
    header: 'Quote',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => h('span', { class: 'tabular-nums text-highlighted' }, formatCurrency(row.original.quote))
  },
  {
    accessorKey: 'value',
    header: 'Value',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => h('span', { class: 'tabular-nums text-highlighted' }, formatCurrency(row.original.value))
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      v-model:expanded="expanded"
      :data="data"
      :columns="columns"
      :expanded-options="expandedOptions"
      :get-row-id="getRowId"
      :loading="loading"
      :ui="{
        td: '[&[colspan]]:p-0'
      }"
      sticky
    >
      <template #expanded="{ row }">
        <div class="pb-3 pl-12 sm:pl-40">
          <UTable
            v-if="row.original.assets.length"
            :data="row.original.assets"
            :columns="assetColumns"
            :ui="{
              th: 'px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-dimmed whitespace-nowrap',
              td: 'px-3 py-2 text-xs text-highlighted whitespace-nowrap'
            }"
          />
          <div
            v-else
            class="flex items-center justify-center py-6 text-sm text-muted"
          >
            No assets for this snapshot
          </div>
        </div>
      </template>

      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No data
        </div>
      </template>

      <template #body-bottom>
        <tr v-if="data.length" class="border-t-2 border-default bg-elevated/40">
          <td class="p-4 whitespace-nowrap" />
          <td class="p-4 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap">
            Total
          </td>
          <td class="p-4 whitespace-nowrap" />
          <td class="p-4 text-right whitespace-nowrap">
            <span class="tabular-nums text-sm font-semibold text-highlighted">{{ formatCurrency(total) }}</span>
          </td>
        </tr>
      </template>
    </UTable>
  </UCard>
</template>
