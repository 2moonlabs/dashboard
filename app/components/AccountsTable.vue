<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Account } from '~/types/accounts'

defineProps<{
  data: Account[]
  loading?: boolean
}>()

const columns: TableColumn<Account>[] = [
  {
    accessorKey: 'connector',
    header: 'Connector'
  },
  {
    accessorKey: 'account_type',
    header: 'Type'
  },
  {
    accessorKey: 'account_user',
    header: 'User'
  },
  {
    accessorKey: 'account_name',
    header: 'Account'
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
          No accounts
        </div>
      </template>
    </UTable>
  </UCard>
</template>
