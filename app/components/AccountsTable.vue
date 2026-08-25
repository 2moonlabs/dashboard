<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AccountBalance, AccountSnapshotAsset } from '~/types/accounts'
import { accountRefKey } from '~/types/accounts'

const props = defineProps<{
  data: AccountBalance[]
  portfolioTotal?: number
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
  Idle: 'bg-neutral-300'
}

const total = computed(() => props.data.reduce<number | null>(
  (sum, account) => sum === null || account.total === null ? null : sum + account.total,
  0
))

const portfolioTotal = computed(() => props.portfolioTotal ?? total.value)

const expandedOptions = {
  getRowCanExpand: (row: { original: AccountBalance }) => row.original.assets.length > 0
}

watch(() => props.data, () => {
  expanded.value = {}
})

function getRowId(row: AccountBalance) {
  return accountRefKey(row)
}

function formatCurrency(value: number) {
  return `$${totalFormatter.format(value)}`
}

function formatAccountTotal(value: number | null) {
  return value === null ? 'No data' : formatCurrency(value)
}

function formatPortfolioShare(value: number | null) {
  if (value === null || portfolioTotal.value === null || portfolioTotal.value <= 0) return '-'

  return `${totalFormatter.format((value / portfolioTotal.value) * 100)}%`
}

function formatBalance(value: number) {
  return balanceFormatter.format(value)
}

function formatAccount(row: AccountBalance) {
  return `${row.connector} / ${row.account_user} / ${row.account_name} / ${row.account_type}`
}

function getAccountStatus(row: AccountBalance): AccountStatus {
  return row.hasActiveStrategy ? 'Active' : 'Idle'
}

const columns: TableColumn<AccountBalance>[] = [
  {
    id: 'expand',
    header: '',
    meta: {
      class: {
        th: 'w-px pr-0',
        td: 'w-px pr-0'
      }
    },
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
    cell: ({ row }) => h('span', { class: 'font-mono text-xs text-highlighted' }, formatAccount(row.original))
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
    id: 'portfolioShare',
    header: 'Portfolio %',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => h(
      'span',
      { class: row.original.total === null ? 'text-xs text-muted' : 'tabular-nums text-[13px] text-highlighted' },
      formatPortfolioShare(row.original.total)
    )
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
      { class: row.original.total === null ? 'text-xs text-muted' : 'tabular-nums text-[13px] text-highlighted' },
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
      :ui="tableUi({ td: '[&[colspan]]:p-0' })"
      sticky
    >
      <template #expanded="{ row }">
        <div class="pb-3 pl-12 sm:pl-40">
          <UTable
            v-if="row.original.assets.length"
            :data="row.original.assets"
            :columns="assetColumns"
            :ui="nestedTableUi()"
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
          <td class="w-px py-2 pl-4 pr-0 whitespace-nowrap" />
          <td class="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap">
            Total
          </td>
          <td class="px-4 py-2 whitespace-nowrap" />
          <td class="px-4 py-2 whitespace-nowrap" />
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <span class="tabular-nums text-[13px] font-semibold text-highlighted">{{ total === null ? '-' : formatCurrency(total) }}</span>
          </td>
        </tr>
      </template>
    </UTable>
  </UCard>
</template>
