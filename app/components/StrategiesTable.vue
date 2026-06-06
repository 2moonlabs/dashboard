<script setup lang="ts">
import type { HeaderContext, SortingState } from '@tanstack/table-core'
import type { TableColumn } from '@nuxt/ui'
import type { AccountRef } from '~/types/accounts'
import { accountRefKey, accountRefLabel } from '~/types/accounts'
import type { StrategyAccount, StrategyWithAccounts } from '~/types/strategies'

const props = defineProps<{
  data: StrategyWithAccounts[]
  loading?: boolean
}>()

const emit = defineEmits<{
  editStrategy: [strategy: StrategyWithAccounts]
}>()

const now = useState('strategy-table-now', () => Date.now())
const sorting = ref<SortingState>([{ id: 'strategy_name', desc: false }])
const sortingOptions = {
  enableMultiSort: false,
  enableSortingRemoval: false,
  sortDescFirst: false
}

watch(() => [props.data, props.loading], () => {
  now.value = Date.now()
})

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

function sortIcon(direction: false | 'asc' | 'desc') {
  if (direction === 'asc') return 'i-lucide-arrow-up'
  if (direction === 'desc') return 'i-lucide-arrow-down'
  return 'i-lucide-arrow-up-down'
}

function sortableHeader(label: string, align: 'left' | 'right' = 'left') {
  return ({ column }: HeaderContext<StrategyWithAccounts, unknown>) => h(
    'button',
    {
      type: 'button',
      class: [
        'inline-flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted transition hover:text-highlighted',
        align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
      ].join(' '),
      onClick: column.getToggleSortingHandler()
    },
    [
      h('span', label),
      h(resolveComponent('UIcon'), {
        name: sortIcon(column.getIsSorted()),
        class: 'size-3.5 shrink-0'
      })
    ]
  )
}

function formatValue(value: number) {
  return valueFormatter.format(value)
}

function valueCell(value: number | null | undefined) {
  if (value === null || value === undefined) return placeholder()

  return h('span', { class: 'tabular-nums text-[13px] font-medium text-highlighted' }, formatValue(value))
}

function changeValue(value: number, formatter: Intl.NumberFormat, zeroThreshold = 0) {
  const sign = value < -zeroThreshold ? '-' : ''
  const magnitude = Math.abs(value) < zeroThreshold ? 0 : Math.abs(value)

  return `${sign}${formatter.format(magnitude)}`
}

function valueClass(value: number) {
  if (value < 0) return 'text-error'
  if (value > 0) return 'text-success'
  return 'text-muted'
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
    ratio === null
      ? placeholder()
      : h('span', { class: `${valueClass(value)} tabular-nums text-[13px] font-medium` }, `${changeValue(ratio, ratioFormatter)}${unit}`),
    h('span', { class: 'tabular-nums text-[11px] text-muted' }, changeValue(value, valueFormatter, 0.005))
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

function formatServer(row: StrategyWithAccounts) {
  return row.server || row.url || '-'
}

function sortText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function sortNumber(value: number | null | undefined) {
  return value ?? undefined
}

function sortTime(value: string | null | undefined) {
  if (!value) return undefined

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function activitySortTime(row: StrategyWithAccounts) {
  return sortTime(row.snapshot?.last_order_placed_at) ?? sortTime(row.snapshot?.last_trade_filled_at)
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

function accountsSortValue(accounts: StrategyAccount[]) {
  const labels = groupedAccounts(accounts).map((group) => {
    const assets = accountAssets(group.assets)
    return [accountRefLabel(group.account), ...assets].join(' ')
  })

  return sortText(labels.join(' '))
}

function activityLine(label: string, value: string | null | undefined, className: string) {
  const seconds = ageSeconds(value)

  return h('div', { class: 'grid grid-cols-[2.25rem_auto] items-baseline gap-1.5' }, [
    h('span', { class: 'text-muted' }, label),
    seconds === null
      ? placeholder()
      : h('span', { class: `${className} tabular-nums` }, formatAge(seconds))
  ])
}

function activityCell(row: StrategyWithAccounts) {
  const orderSeconds = ageSeconds(row.snapshot?.last_order_placed_at)

  return h('div', { class: 'space-y-1' }, [
    activityLine(
      'Order',
      row.snapshot?.last_order_placed_at,
      orderSeconds === null ? 'text-highlighted' : orderAgeClass(orderSeconds)
    ),
    activityLine('Trade', row.snapshot?.last_trade_filled_at, 'text-highlighted')
  ])
}

const columns: TableColumn<StrategyWithAccounts>[] = [
  {
    accessorKey: 'strategy_name',
    header: sortableHeader('Strategy'),
    sortingFn: 'alphanumeric',
    sortUndefined: 'last',
    cell: ({ row }) => {
      const tags = [`id:${row.original.id}`, ...strategyTags(row.original)]

      return h('div', { class: 'space-y-1.5' }, [
        h('div', { class: 'relative min-w-0' }, [
          h('div', { class: 'flex min-w-0 flex-wrap items-center gap-1.5' }, [
            h('span', { class: 'font-medium text-highlighted' }, row.original.strategy_name),
            row.original.active
              ? null
              : h(resolveComponent('UBadge'), {
                  color: 'neutral',
                  variant: 'soft',
                  size: 'sm'
                }, () => 'inactive')
          ]),
          h(resolveComponent('UButton'), {
            'aria-label': 'Edit strategy',
            'class': 'absolute left-full top-1/2 ml-1 -translate-y-1/2 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/strategy-row:opacity-100 sm:focus-visible:opacity-100',
            'color': 'neutral',
            'icon': 'i-lucide-square-pen',
            'size': 'xs',
            'variant': 'ghost',
            'onClick': (event: MouseEvent) => {
              event.stopPropagation()
              emit('editStrategy', row.original)
            }
          })
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
    accessorFn: row => sortNumber(row.snapshot?.total),
    header: sortableHeader('Total', 'right'),
    sortUndefined: 'last',
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
    accessorFn: row => sortNumber(row.snapshot?.today),
    header: sortableHeader('Today', 'right'),
    sortUndefined: 'last',
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
    accessorFn: row => sortNumber(row.snapshot?.this_week),
    header: sortableHeader('This week', 'right'),
    sortUndefined: 'last',
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
    accessorFn: row => sortNumber(row.snapshot?.this_month),
    header: sortableHeader('This month', 'right'),
    sortUndefined: 'last',
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
    accessorFn: row => accountsSortValue(row.accounts),
    header: sortableHeader('Accounts'),
    sortingFn: 'alphanumeric',
    sortUndefined: 'last',
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
    id: 'activity',
    accessorFn: row => activitySortTime(row),
    header: sortableHeader('Activity'),
    sortUndefined: 'last',
    cell: ({ row }) => activityCell(row.original)
  },
  {
    id: 'server',
    accessorFn: row => sortText(row.server || row.url),
    header: sortableHeader('Server'),
    sortingFn: 'alphanumeric',
    sortUndefined: 'last',
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
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      v-model:sorting="sorting"
      :data="data"
      :columns="columns"
      :loading="loading"
      :sorting-options="sortingOptions"
      :ui="{
        tr: 'group/strategy-row',
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
