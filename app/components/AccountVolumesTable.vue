<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AccountVolume } from '~/types/accounts'
import { accountVolumeLabel, accountVolumePath } from '~/types/accounts'

defineProps<{
  data: AccountVolume[]
  loading?: boolean
}>()

const feeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8
})

const smallNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
})

function placeholder() {
  return h('span', { class: 'text-muted' }, '-')
}

function humanizeNumber(value: number, precision = 1) {
  if (value === 0) return '0'

  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  let scaledValue: number
  let unit: string

  if (absValue >= 1_000_000_000_000) {
    scaledValue = absValue / 1_000_000_000_000
    unit = 'T'
  } else if (absValue >= 1_000_000_000) {
    scaledValue = absValue / 1_000_000_000
    unit = 'B'
  } else if (absValue >= 1_000_000) {
    scaledValue = absValue / 1_000_000
    unit = 'M'
  } else if (absValue >= 1_000) {
    scaledValue = absValue / 1_000
    unit = 'K'
  } else {
    return `${sign}${smallNumberFormatter.format(absValue)}`
  }

  const formattedValue = precision === 0
    ? scaledValue.toFixed(0)
    : scaledValue.toFixed(precision).replace(/\.?0+$/, '')

  return `${sign}${formattedValue}${unit}`
}

function formatFee(value: number) {
  return `${feeFormatter.format(value)} bp`
}

function numberCell(value: number | null) {
  if (value === null) return placeholder()

  return h('span', { class: 'flex w-full items-center justify-end tabular-nums text-[13px] font-semibold text-highlighted' }, humanizeNumber(value))
}

function metricLine(label: string, value: number | null, formatter: (value: number) => string) {
  return h('div', { class: 'grid grid-cols-[3rem_auto] items-baseline gap-2' }, [
    h('span', { class: 'text-[10px] uppercase tracking-wide text-muted' }, label),
    value === null
      ? placeholder()
      : h('span', { class: 'tabular-nums text-[13px] text-highlighted' }, formatter(value))
  ])
}

function feeCell(maker: number | null, taker: number | null) {
  return h('div', { class: 'space-y-0.5 text-right' }, [
    metricLine('Maker', maker, formatFee),
    metricLine('Taker', taker, formatFee)
  ])
}

function tierCell(current: number | null, next: number | null) {
  return h('div', { class: 'space-y-0.5 text-right' }, [
    metricLine('Current', current, humanizeNumber),
    metricLine('Next', next, humanizeNumber)
  ])
}

const columns: TableColumn<AccountVolume>[] = [
  {
    id: 'account',
    header: 'Account',
    meta: {
      class: {
        td: 'align-middle'
      }
    },
    cell: ({ row }) => h(
      resolveComponent('NuxtLink'),
      {
        'to': accountVolumePath(row.original),
        'class': 'font-mono text-xs text-highlighted',
        'aria-label': `View volume history for ${accountVolumeLabel(row.original)}`
      },
      () => accountVolumeLabel(row.original)
    )
  },
  {
    accessorKey: 'spot_volume_30d',
    header: '30d Spot Volume',
    meta: {
      class: {
        th: 'w-40 min-w-40 text-right',
        td: 'w-40 min-w-40 text-right align-middle'
      }
    },
    cell: ({ row }) => numberCell(row.original.spot_volume_30d)
  },
  {
    id: 'spotFees',
    header: 'Spot fees',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => feeCell(row.original.spot_maker_fee, row.original.spot_taker_fee)
  },
  {
    id: 'spotTier',
    header: 'Spot tier',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => tierCell(row.original.spot_tier_volume, row.original.spot_next_tier_volume)
  },
  {
    accessorKey: 'futures_volume_30d',
    header: '30d Futures Volume',
    meta: {
      class: {
        th: 'w-40 min-w-40 text-right',
        td: 'w-40 min-w-40 text-right align-middle'
      }
    },
    cell: ({ row }) => numberCell(row.original.futures_volume_30d)
  },
  {
    id: 'futuresFees',
    header: 'Futures fees',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => feeCell(row.original.futures_maker_fee, row.original.futures_taker_fee)
  },
  {
    id: 'futuresTier',
    header: 'Futures tier',
    meta: {
      class: {
        th: 'text-right',
        td: 'text-right'
      }
    },
    cell: ({ row }) => tierCell(row.original.futures_tier_volume, row.original.futures_next_tier_volume)
  }
]
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <UTable
      :data="data"
      :columns="columns"
      :loading="loading"
      :ui="tableUi({ td: 'align-top whitespace-nowrap' })"
      sticky
    >
      <template #empty>
        <div class="flex items-center justify-center py-10 text-sm text-muted">
          No volume data
        </div>
      </template>
    </UTable>
  </UCard>
</template>
