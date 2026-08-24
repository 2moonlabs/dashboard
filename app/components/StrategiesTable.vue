<script setup lang="ts">
import type { HeaderContext, SortingState } from '@tanstack/table-core'
import type { TableColumn } from '@nuxt/ui'
import type { AccountRef } from '~/types/accounts'
import { accountRefKey, accountRefLabel } from '~/types/accounts'
import type { StrategyAccount, StrategyServer, StrategyWithAccounts } from '~/types/strategies'

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

watch(() => props.data, () => {
  now.value = Date.now()
})

interface AccountGroup {
  account: AccountRef
  assets: (string | null)[]
}

interface ServerGroup {
  server: string
  entries: StrategyServer[]
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

// Missing snapshots are skipped rather than nulling the whole footer: the total
// row sums whatever the visible rows actually report.
function sumTotal() {
  let sum: number | null = null

  for (const strategy of props.data) {
    const value = strategy.snapshot?.total
    if (value === null || value === undefined) continue
    sum = (sum ?? 0) + value
  }

  return sum
}

// Each period carries the total of exactly the strategies it summed, so the
// footer ratio divides by the same cohort it adds up. A strategy missing this
// period's delta (a baseline outside the fetch window, say) contributes to
// neither side; one contributing a delta but no total leaves the cohort
// baseline unknown, and the ratio is dropped rather than skewed.
function sumPeriod(key: 'today' | 'this_week' | 'this_month' | 'this_quarter') {
  let value: number | null = null
  let total: number | null = null
  let totalKnown = true

  for (const strategy of props.data) {
    const delta = strategy.snapshot?.[key]
    if (delta === null || delta === undefined) continue

    value = (value ?? 0) + delta

    const strategyTotal = strategy.snapshot?.total
    if (strategyTotal === null || strategyTotal === undefined) {
      totalKnown = false
      continue
    }

    total = (total ?? 0) + strategyTotal
  }

  return { value, total: totalKnown ? total : null }
}

const totals = computed(() => ({
  total: sumTotal(),
  today: sumPeriod('today'),
  thisWeek: sumPeriod('this_week'),
  thisMonth: sumPeriod('this_month'),
  thisQuarter: sumPeriod('this_quarter')
}))

// Functional components so the footer reuses the exact cell renderers below;
// the object is stable, so Vue does not remount them on every render.
const totalCells = {
  total: () => valueCell(totals.value.total),
  today: () => pnlCell(totals.value.today.value, totals.value.today.total, 10000, 'bp'),
  thisWeek: () => pnlCell(totals.value.thisWeek.value, totals.value.thisWeek.total, 100, '%'),
  thisMonth: () => pnlCell(totals.value.thisMonth.value, totals.value.thisMonth.total, 100, '%'),
  thisQuarter: () => pnlCell(totals.value.thisQuarter.value, totals.value.thisQuarter.total, 100, '%')
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
  if (value < 0) return 'text-pnl-down'
  if (value > 0) return 'text-pnl-up'
  return 'text-muted'
}

function relativePnl(value: number, total: number | null | undefined, multiplier: number) {
  if (total === null || total === undefined) return null

  // Reconstructed starting capital. Non-positive means it is missing or corrupt,
  // so no ratio is shown rather than a meaningless one.
  const baseline = total - value
  if (baseline <= 0) return null

  return value / baseline * multiplier
}

function pnlCell(value: number | null | undefined, total: number | null | undefined, multiplier: number, unit: string) {
  if (value === null || value === undefined) return placeholder()

  const ratio = relativePnl(value, total, multiplier)

  return h('div', { class: 'flex flex-col items-end gap-0.5' }, [
    ratio === null
      ? placeholder()
      : h('span', { class: `${valueClass(value)} tabular-nums text-[13px] font-medium` }, `${changeValue(ratio, ratioFormatter)} ${unit}`),
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

function formatActivity(seconds: number) {
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

// Order recency escalates yellow -> orange amber, deliberately staying off red.
function orderActivityClass(seconds: number) {
  if (seconds <= 10 * 60) return 'text-highlighted'
  if (seconds <= 30 * 60) return 'text-amber-300'
  return 'text-amber-600'
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

// A strategy can run several dashboards on one host, so the host is printed
// once per group and its roles are listed under it.
function groupedServers(servers: StrategyServer[]) {
  const groups = new Map<string, ServerGroup>()

  for (const server of servers) {
    const group = groups.get(server.server) ?? {
      server: server.server,
      entries: []
    }

    group.entries.push(server)
    groups.set(server.server, group)
  }

  return [...groups.values()]
}

function serversSortValue(servers: StrategyServer[]) {
  const labels = groupedServers(servers).map(group => [
    group.server,
    ...group.entries.map(entry => entry.label)
  ].join(' '))

  return sortText(labels.join(' '))
}

function activityLine(label: string, value: string | null | undefined, className: string) {
  const seconds = ageSeconds(value)

  return h('div', { class: 'grid grid-cols-[2.5rem_auto] items-baseline gap-2' }, [
    h('span', { class: 'text-[10px] uppercase tracking-wide text-muted' }, label),
    seconds === null
      ? placeholder()
      : h('span', {
          class: `${className} tabular-nums`,
          title: formatAge(seconds)
        }, formatActivity(seconds))
  ])
}

function activityCell(row: StrategyWithAccounts) {
  const orderSeconds = ageSeconds(row.snapshot?.last_order_placed_at)

  return h('div', { class: 'space-y-0.5' }, [
    activityLine(
      'Order',
      row.snapshot?.last_order_placed_at,
      orderSeconds === null ? 'text-highlighted' : orderActivityClass(orderSeconds)
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
      const tags = strategyTags(row.original)

      return h('div', { class: 'space-y-1' }, [
        h('div', { class: 'relative min-w-0' }, [
          h('div', { class: 'flex min-w-0 flex-wrap items-center gap-1.5' }, [
            h('span', { class: 'font-medium lowercase text-highlighted' }, row.original.strategy_name),
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
        h('div', { class: 'flex flex-wrap items-center gap-1' }, [
          // Record id, deliberately not a badge: it is unique per row and not
          // filterable, unlike the tags it sits next to.
          h('span', { class: 'font-mono text-[10px] tabular-nums text-muted' }, `#${row.original.id}`),
          ...tags.map(tag => h(resolveComponent('UBadge'), {
            color: 'neutral',
            variant: 'soft',
            size: 'sm'
          }, () => tag))
        ])
      ])
    }
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
        { class: 'space-y-1.5' },
        groups.map((group) => {
          const assets = accountAssets(group.assets)

          return h('div', { class: 'space-y-0.5' }, [
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
    id: 'server',
    accessorFn: row => serversSortValue(row.servers),
    header: sortableHeader('Server'),
    sortingFn: 'alphanumeric',
    sortUndefined: 'last',
    cell: ({ row }) => {
      const groups = groupedServers(row.original.servers)
      if (!groups.length) return placeholder()

      return h(
        'div',
        { class: 'space-y-1' },
        groups.map(group => h(
          'div',
          {
            key: group.server,
            // w-fit keeps the auto columns at content width: an auto track in a
            // full-width grid would stretch into the cell's slack.
            class: 'grid w-fit grid-cols-[auto_auto] items-baseline gap-x-1.5 gap-y-1 whitespace-nowrap'
          },
          [
            h('span', { class: 'text-muted' }, group.server),
            // col-start-2 puts every role under the first one, leaving the host
            // column blank from the second row on.
            ...group.entries.map(server => h(
              'a',
              {
                key: server.id,
                href: server.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                class: 'col-start-2 text-highlighted no-underline'
              },
              server.label
            ))
          ]
        ))
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
    cell: ({ row }) => pnlCell(row.original.snapshot?.today, row.original.snapshot?.total, 10000, 'bp')
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
    cell: ({ row }) => pnlCell(row.original.snapshot?.this_week, row.original.snapshot?.total, 100, '%')
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
    id: 'quarterPnl',
    accessorFn: row => sortNumber(row.snapshot?.this_quarter),
    header: sortableHeader('This quarter', 'right'),
    sortUndefined: 'last',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => pnlCell(row.original.snapshot?.this_quarter, row.original.snapshot?.total, 100, '%')
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
      :ui="tableUi({ tr: 'group/strategy-row' })"
      sticky
    >
      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No strategies
        </div>
      </template>

      <template #body-bottom>
        <tr v-if="data.length" class="border-t-2 border-default bg-elevated/40">
          <td class="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap">
            Total
          </td>
          <td class="px-4 py-2 whitespace-nowrap" />
          <td class="px-4 py-2 whitespace-nowrap" />
          <td class="px-4 py-2 whitespace-nowrap" />
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <component :is="totalCells.today" />
          </td>
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <component :is="totalCells.thisWeek" />
          </td>
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <component :is="totalCells.thisMonth" />
          </td>
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <component :is="totalCells.thisQuarter" />
          </td>
          <td class="px-4 py-2 text-right whitespace-nowrap">
            <component :is="totalCells.total" />
          </td>
        </tr>
      </template>
    </UTable>
  </UCard>
</template>
