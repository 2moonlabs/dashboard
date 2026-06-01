<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AccountRef } from '~/types/accounts'
import { accountRefKey, accountRefLabel } from '~/types/accounts'
import type { StrategyAccount, StrategyWithAccounts } from '~/types/strategies'

defineProps<{
  data: StrategyWithAccounts[]
  loading?: boolean
}>()

const emit = defineEmits<{
  editTags: [strategy: StrategyWithAccounts]
}>()

const now = useState('strategy-table-now', () => Date.now())

interface AccountGroup {
  account: AccountRef
  assets: (string | null)[]
}

const valueFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
})

const ratioFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
})

function placeholder() {
  return h('span', { class: 'text-muted' }, '-')
}

function formatValue(value: number) {
  return valueFormatter.format(value)
}

function valueCell(value: number | null | undefined) {
  if (value === null || value === undefined) return placeholder()

  return h('span', { class: 'tabular-nums text-sm font-medium text-highlighted' }, formatValue(value))
}

function signedValue(value: number, formatter: Intl.NumberFormat, zeroThreshold = 0) {
  const sign = value > zeroThreshold ? '+' : value < -zeroThreshold ? '-' : ''
  const magnitude = Math.abs(value) < zeroThreshold ? 0 : Math.abs(value)

  return `${sign}${formatter.format(magnitude)}`
}

function valueClass(value: number) {
  if (value < 0) return 'text-error'
  if (value > 0) return 'text-success'
  return 'text-muted'
}

function badgeColor(value: number) {
  if (value < 0) return 'error'
  if (value > 0) return 'success'
  return 'neutral'
}

function relativePnl(value: number, total: number | null | undefined, multiplier: number) {
  if (total === null || total === undefined) return null

  const baseline = total - value
  if (baseline === 0) return null

  return value / baseline * multiplier
}

function pnlCell(value: number | null | undefined, total: number | null | undefined, multiplier: number, unit: string) {
  if (value === null || value === undefined) return placeholder()

  const ratio = relativePnl(value, total, multiplier)

  return h('div', { class: 'flex flex-col items-end gap-1' }, [
    h('span', { class: `${valueClass(value)} tabular-nums text-[13px] font-medium` }, signedValue(value, valueFormatter, 0.005)),
    ratio === null
      ? placeholder()
      : h(resolveComponent('UBadge'), {
          color: badgeColor(value),
          variant: 'soft',
          size: 'sm'
        }, () => `${signedValue(ratio, ratioFormatter)}${unit}`)
  ])
}

function ageSeconds(value: string | null | undefined) {
  if (!value) return null

  const diffMs = now.value - new Date(value).getTime()
  if (!Number.isFinite(diffMs)) return null

  return Math.max(0, Math.floor(diffMs / 1000))
}

function formatAge(seconds: number) {
  if (seconds < 60) {
    const unit = seconds === 1 ? 'second' : 'seconds'
    return `${seconds} ${unit} ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const unit = minutes === 1 ? 'minute' : 'minutes'
    return `${minutes} ${unit} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const unit = hours === 1 ? 'hour' : 'hours'
    return `${hours} ${unit} ago`
  }

  const days = Math.floor(hours / 24)
  const unit = days === 1 ? 'day' : 'days'
  return `${days} ${unit} ago`
}

function orderAgeClass(seconds: number) {
  if (seconds <= 10 * 60) return 'text-highlighted'
  if (seconds <= 30 * 60) return 'text-warning'
  return 'text-error'
}

function ageCell(value: string | null | undefined, className = 'text-highlighted') {
  const seconds = ageSeconds(value)
  if (seconds === null) return placeholder()

  return h('span', { class: `${className} tabular-nums` }, formatAge(seconds))
}

function formatServer(row: StrategyWithAccounts) {
  return row.server || row.url || '-'
}

function strategyTags(row: StrategyWithAccounts) {
  return row.tags
}

function groupedAccounts(accounts: StrategyAccount[]) {
  const groups = new Map<string, AccountGroup>()

  for (const account of accounts) {
    const key = accountRefKey(account)
    const group = groups.get(key) ?? {
      account,
      assets: []
    }

    group.assets.push(account.asset)
    groups.set(key, group)
  }

  return [...groups.values()]
}

function accountAssets(assets: (string | null)[]) {
  return assets.filter((asset): asset is string => Boolean(asset))
}

const columns: TableColumn<StrategyWithAccounts>[] = [
  {
    accessorKey: 'strategy_name',
    header: 'Strategy',
    cell: ({ row }) => {
      const tags = [`id:${row.original.id}`, ...strategyTags(row.original)]

      return h('div', { class: 'space-y-1.5' }, [
        h('div', { class: 'flex flex-wrap items-center gap-1.5' }, [
          h('span', { class: 'font-medium text-highlighted' }, row.original.strategy_name),
          row.original.active
            ? null
            : h(resolveComponent('UBadge'), {
                color: 'neutral',
                variant: 'soft',
                size: 'sm'
              }, () => 'inactive')
        ]),
        h(
          'div',
          { class: 'flex flex-wrap gap-1' },
          tags.map(tag => h(resolveComponent('UBadge'), {
            color: 'neutral',
            variant: 'soft',
            size: 'sm'
          }, () => tag))
        )
      ])
    }
  },
  {
    id: 'total',
    header: 'Total',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => valueCell(row.original.snapshot?.total)
  },
  {
    id: 'todayPnl',
    header: 'Today',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => pnlCell(row.original.snapshot?.today, row.original.snapshot?.total, 10000, 'bps')
  },
  {
    id: 'weekPnl',
    header: 'This week',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => pnlCell(row.original.snapshot?.this_week, row.original.snapshot?.total, 1000, '‰')
  },
  {
    id: 'monthPnl',
    header: 'This month',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => pnlCell(row.original.snapshot?.this_month, row.original.snapshot?.total, 100, '%')
  },
  {
    id: 'accounts',
    header: 'Accounts',
    cell: ({ row }) => {
      const groups = groupedAccounts(row.original.accounts)
      if (!groups.length) return h('span', { class: 'text-muted' }, '-')

      return h(
        'div',
        { class: 'space-y-2' },
        groups.map((group) => {
          const assets = accountAssets(group.assets)

          return h('div', { class: 'space-y-1' }, [
            h('div', { class: 'font-mono text-xs text-highlighted' }, accountRefLabel(group.account)),
            assets.length
              ? h(
                  'div',
                  { class: 'flex flex-wrap gap-1' },
                  assets.map(asset => h(resolveComponent('UBadge'), {
                    color: 'neutral',
                    variant: 'soft',
                    size: 'sm'
                  }, () => asset))
                )
              : null
          ])
        })
      )
    }
  },
  {
    id: 'lastOrderPlacedAt',
    header: 'Last Order',
    cell: ({ row }) => {
      const seconds = ageSeconds(row.original.snapshot?.last_order_placed_at)
      if (seconds === null) return placeholder()

      return h('span', { class: `${orderAgeClass(seconds)} tabular-nums` }, formatAge(seconds))
    }
  },
  {
    id: 'lastTradeFilledAt',
    header: 'Last Trade',
    cell: ({ row }) => ageCell(row.original.snapshot?.last_trade_filled_at)
  },
  {
    id: 'server',
    header: 'Server',
    cell: ({ row }) => {
      const label = formatServer(row.original)
      if (!row.original.url) return label

      return h(
        'a',
        {
          href: row.original.url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-highlighted underline-offset-2 hover:underline'
        },
        label
      )
    }
  },
  {
    id: 'edit',
    header: 'Edit',
    meta: {
      class: {
        th: 'text-center',
        td: 'text-center'
      }
    },
    cell: ({ row }) => h(resolveComponent('UButton'), {
      'aria-label': 'Edit',
      'color': 'neutral',
      'icon': 'i-lucide-square-pen',
      'size': 'xs',
      'variant': 'ghost',
      'onClick': (event: MouseEvent) => {
        event.stopPropagation()
        emit('editTags', row.original)
      }
    })
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      :data="data"
      :columns="columns"
      :loading="loading"
      :ui="{
        th: 'text-xs whitespace-nowrap',
        td: 'align-middle text-xs'
      }"
      sticky
    >
      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No strategies
        </div>
      </template>
    </UTable>
  </UCard>
</template>
