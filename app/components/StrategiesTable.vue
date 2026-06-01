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

interface AccountGroup {
  account: AccountRef
  assets: (string | null)[]
}

function placeholder() {
  return h('span', { class: 'text-muted' }, '-')
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
            color: tag.startsWith('id:') ? 'neutral' : 'primary',
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
    cell: placeholder
  },
  {
    id: 'todayPnl',
    header: 'Today',
    cell: placeholder
  },
  {
    id: 'weekPnl',
    header: 'This week',
    cell: placeholder
  },
  {
    id: 'monthPnl',
    header: 'This month',
    cell: placeholder
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
    cell: placeholder
  },
  {
    id: 'lastTradeFilledAt',
    header: 'Last Trade',
    cell: placeholder
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
          class: 'text-primary underline-offset-2 hover:underline'
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
