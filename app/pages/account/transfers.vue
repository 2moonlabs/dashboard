<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  CONNECTOR_OPTIONS,
  TRANSFER_TYPE_OPTIONS,
  TRANSFER_TYPES,
  accountRefKey,
  accountRefLabel,
  uniqueSortedConnectors,
  type Account,
  type NewAccountTransferInput,
  type TransferType
} from '~/types/accounts'

type TransferFilterType = TransferType | 'all'

const toast = useToast()
const selectedConnector = ref('all')
const selectedAccount = ref('all')
const selectedType = ref<TransferFilterType>('all')
const transferModalOpen = ref(false)
const saving = ref(false)

const { data: accounts, error: accountsError } = await useAccounts()
const {
  data: transfers,
  status: transfersStatus,
  error: transfersError,
  refresh: refreshTransfers
} = await useRecentAccountTransfers()

const insertTransfer = useInsertAccountTransfer()

const loadingTransfers = computed(() => transfersStatus.value === 'pending')
const fetchError = computed(() => accountsError.value || transfersError.value)

const connectorOptions = computed(() => {
  const transferConnectors = (transfers.value ?? []).flatMap(transfer => [
    transfer.from_connector,
    transfer.to_connector
  ]).filter((connector): connector is string => Boolean(connector))

  const connectors = uniqueSortedConnectors([
    ...CONNECTOR_OPTIONS.map(option => option.value),
    ...(accounts.value ?? []).map(account => account.connector),
    ...transferConnectors
  ])

  return [
    { label: 'All connectors', value: 'all' },
    ...connectors.map(connector => ({ label: connector, value: connector }))
  ]
})

const accountOptions = computed(() => [
  { label: 'All accounts', value: 'all' },
  ...(accounts.value ?? []).map(account => ({
    label: accountRefLabel(account),
    value: accountRefKey(account)
  }))
])

const transferTypeFilterOptions = [
  { label: 'All types', value: 'all' },
  ...TRANSFER_TYPE_OPTIONS
]

function transferAccountKey(transfer: {
  from_connector: string | null
  from_account_user: string | null
  from_account_name: string | null
  to_connector: string | null
  to_account_user: string | null
  to_account_name: string | null
}, side: 'from' | 'to') {
  const connector = transfer[`${side}_connector`]
  const accountUser = transfer[`${side}_account_user`]
  const accountName = transfer[`${side}_account_name`]

  if (!connector || !accountUser || !accountName) return null

  return accountRefKey({
    connector,
    account_user: accountUser,
    account_name: accountName
  })
}

const filteredTransfers = computed(() => {
  return (transfers.value ?? []).filter((transfer) => {
    const connectorMatched = selectedConnector.value === 'all'
      || transfer.from_connector === selectedConnector.value
      || transfer.to_connector === selectedConnector.value

    const accountMatched = selectedAccount.value === 'all'
      || transferAccountKey(transfer, 'from') === selectedAccount.value
      || transferAccountKey(transfer, 'to') === selectedAccount.value

    const typeMatched = selectedType.value === 'all'
      || transfer.transfer_type === selectedType.value

    return connectorMatched && accountMatched && typeMatched
  })
})

const formSchema = z.object({
  ts: z.string().min(1, 'Timestamp is required'),
  transfer_type: z.enum(TRANSFER_TYPES),
  fromAccountKey: z.string().optional(),
  toAccountKey: z.string().optional(),
  asset: z.string().trim().min(1, 'Asset is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  note: z.string().optional()
}).superRefine((value, ctx) => {
  if (Number.isNaN(new Date(value.ts).getTime())) {
    ctx.addIssue({
      code: 'custom',
      path: ['ts'],
      message: 'Timestamp is invalid'
    })
  }

  if (value.transfer_type !== 'deposit' && !value.fromAccountKey) {
    ctx.addIssue({
      code: 'custom',
      path: ['fromAccountKey'],
      message: 'From account is required'
    })
  }

  if (value.transfer_type !== 'withdraw' && !value.toAccountKey) {
    ctx.addIssue({
      code: 'custom',
      path: ['toAccountKey'],
      message: 'To account is required'
    })
  }
})

type TransferForm = z.output<typeof formSchema>

const form = reactive<TransferForm>({
  ts: toDateTimeLocal(new Date()),
  transfer_type: 'deposit',
  fromAccountKey: undefined,
  toAccountKey: undefined,
  asset: 'USD',
  amount: 0,
  note: ''
})

const formAccountOptions = computed(() => (accounts.value ?? []).map(account => ({
  label: accountRefLabel(account),
  value: accountRefKey(account),
  description: account.account_type
})))

const hasAccounts = computed(() => Boolean(accounts.value?.length))

watch(() => form.transfer_type, (transferType) => {
  if (transferType === 'deposit') {
    form.fromAccountKey = undefined
  }
  if (transferType === 'withdraw') {
    form.toAccountKey = undefined
  }
})

function toDateTimeLocal(date: Date) {
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 16)
}

function findAccount(key: string | undefined): Account | null {
  if (!key) return null
  return (accounts.value ?? []).find(account => accountRefKey(account) === key) ?? null
}

function firstAccountForCurrentFilter() {
  if (selectedConnector.value !== 'all') {
    const matched = (accounts.value ?? []).find(account => account.connector === selectedConnector.value)
    if (matched) return matched
  }

  return accounts.value?.[0] ?? null
}

function resetForm() {
  const defaultAccount = firstAccountForCurrentFilter()

  form.ts = toDateTimeLocal(new Date())
  form.transfer_type = selectedType.value === 'all' ? 'deposit' : selectedType.value
  form.fromAccountKey = form.transfer_type === 'deposit' || !defaultAccount ? undefined : accountRefKey(defaultAccount)
  form.toAccountKey = form.transfer_type === 'withdraw' || !defaultAccount ? undefined : accountRefKey(defaultAccount)
  form.asset = 'USD'
  form.amount = 0
  form.note = ''
}

function openTransferModal() {
  resetForm()
  transferModalOpen.value = true
}

async function onSubmit(event: FormSubmitEvent<TransferForm>) {
  const fromAccount = event.data.transfer_type === 'deposit'
    ? null
    : findAccount(event.data.fromAccountKey)
  const toAccount = event.data.transfer_type === 'withdraw'
    ? null
    : findAccount(event.data.toAccountKey)

  saving.value = true

  try {
    const payload: NewAccountTransferInput = {
      ts: new Date(event.data.ts).toISOString(),
      transfer_type: event.data.transfer_type,
      from_connector: fromAccount?.connector ?? null,
      from_account_user: fromAccount?.account_user ?? null,
      from_account_name: fromAccount?.account_name ?? null,
      to_connector: toAccount?.connector ?? null,
      to_account_user: toAccount?.account_user ?? null,
      to_account_name: toAccount?.account_name ?? null,
      asset: event.data.asset.trim().toUpperCase(),
      amount: event.data.amount,
      note: event.data.note?.trim() ?? ''
    }

    await insertTransfer(payload)

    await refreshTransfers()
    transferModalOpen.value = false
    toast.add({ title: 'Transfer added', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Failed to add transfer',
      description: String((error as Error)?.message ?? error),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPage title="Account Transfers">
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="New transfer"
        :disabled="!hasAccounts"
        @click="openTransferModal"
      />
    </template>

    <template #toolbar>
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <USelect
            v-model="selectedConnector"
            :items="connectorOptions"
            value-key="value"
            class="min-w-44"
          />
          <USelectMenu
            v-model="selectedAccount"
            :items="accountOptions"
            value-key="value"
            class="min-w-72"
            searchable
          />
          <USelect
            v-model="selectedType"
            :items="transferTypeFilterOptions"
            value-key="value"
            class="min-w-44"
          />
        </div>

        <p class="text-xs text-muted tabular-nums">
          Showing {{ filteredTransfers.length }} of {{ transfers?.length ?? 0 }} recent rows
        </p>
      </div>
    </template>

    <template #default>
      <div class="space-y-4">
        <UAlert
          v-if="fetchError"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Failed to load transfers"
          :description="String((fetchError as Error)?.message ?? fetchError)"
        />
        <UAlert
          v-else-if="!hasAccounts"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          title="No accounts found"
          description="Transfers can only be added after accounts are available from Supabase."
        />

        <AccountTransfersTable
          :data="filteredTransfers"
          :loading="loadingTransfers"
        />
      </div>
    </template>
  </AppPage>

  <UModal
    v-model:open="transferModalOpen"
    title="New transfer"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UForm
        :schema="formSchema"
        :state="form"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Type"
            name="transfer_type"
            required
          >
            <USelect
              v-model="form.transfer_type"
              :items="TRANSFER_TYPE_OPTIONS"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Timestamp"
            name="ts"
            required
          >
            <UInput
              v-model="form.ts"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          v-if="form.transfer_type !== 'deposit'"
          label="From account"
          name="fromAccountKey"
          required
        >
          <USelectMenu
            v-model="form.fromAccountKey"
            :items="formAccountOptions"
            value-key="value"
            placeholder="Select account"
            searchable
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="form.transfer_type !== 'withdraw'"
          label="To account"
          name="toAccountKey"
          required
        >
          <USelectMenu
            v-model="form.toAccountKey"
            :items="formAccountOptions"
            value-key="value"
            placeholder="Select account"
            searchable
            class="w-full"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Asset"
            name="asset"
            required
          >
            <UInput
              v-model="form.asset"
              placeholder="USD"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Amount"
            name="amount"
            required
          >
            <UInputNumber
              v-model="form.amount"
              :min="0"
              :step="0.00000001"
              :decrement="false"
              :increment="false"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Note"
          name="note"
        >
          <UTextarea
            v-model="form.note"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <UButton
            type="button"
            variant="outline"
            color="neutral"
            label="Cancel"
            :disabled="saving"
            @click="transferModalOpen = false"
          />
          <UButton
            type="submit"
            label="Add transfer"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
