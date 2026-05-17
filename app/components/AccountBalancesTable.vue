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

const statusColors: Record<AccountStatus, 'success' | 'neutral'> = {
  Active: 'success',
  Idle: 'neutral'
}

const total = computed(() =>
  props.data.reduce((sum, account) => sum + (account.total ?? 0), 0)
)

const expandedOptions = {
  getRowCanExpand: (row: { original: AccountBalance }) => row.original.assets.length > 0
}

watch(() => props.data, () => {
  expanded.value = {}
})

function getRowId(row: AccountBalance) {
  return accountRefKey(row)
}

function formatTotal(value: number) {
  return totalFormatter.format(value)
}

function formatAccountTotal(value: number | null) {
  return value === null ? 'No snapshot' : formatTotal(value)
}

function formatBalance(value: number) {
  return balanceFormatter.format(value)
}

function formatAccount(row: AccountBalance) {
  return `${row.connector} / ${row.account_user} / ${row.account_name}`
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
    cell: ({ row }) => h('span', { class: 'font-mono text-xs text-highlighted' }, formatAccount(row.original))
  },
  {
    accessorKey: 'account_type',
    header: 'Type',
    cell: ({ row }) => h('span', { class: 'text-highlighted' }, row.original.account_type)
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = getAccountStatus(row.original)

      return h(resolveComponent('UBadge'), {
        color: statusColors[status],
        label: status,
        size: 'sm',
        variant: 'soft'
      })
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
    cell: ({ row }) => h('span', { class: 'tabular-nums text-highlighted' }, formatTotal(row.original.quote))
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
    cell: ({ row }) => h('span', { class: 'tabular-nums text-highlighted' }, formatTotal(row.original.value))
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
      sticky
    >
      <template #expanded="{ row }">
        <div class="py-3 pr-3 pl-12 sm:pl-40">
          <UTable
            v-if="row.original.assets.length"
            :data="row.original.assets"
            :columns="assetColumns"
            :ui="{
              th: 'text-xs text-toned',
              td: 'text-xs text-highlighted'
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
          No accounts
        </div>
      </template>

      <template #body-bottom>
        <tr v-if="data.length" class="border-t border-default bg-elevated/30">
          <td class="p-4 text-sm text-highlighted whitespace-nowrap" />
          <td class="p-4 text-sm font-semibold text-highlighted whitespace-nowrap">
            Total
          </td>
          <td class="p-4 text-sm text-highlighted whitespace-nowrap" />
          <td class="p-4 text-sm text-highlighted whitespace-nowrap" />
          <td class="p-4 text-sm font-semibold text-right text-highlighted whitespace-nowrap">
            <span class="tabular-nums">{{ formatTotal(total) }}</span>
          </td>
        </tr>
      </template>
    </UTable>
  </UCard>
</template>
