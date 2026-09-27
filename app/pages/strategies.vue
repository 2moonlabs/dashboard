<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  accountRefKey,
  accountRefLabel,
  uniqueSortedConnectors,
  type Account
} from '~/types/accounts'
import {
  normalizeStrategyAssets,
  normalizeStrategyTags,
  strategyAccountAssetKey,
  type NewStrategyInput,
  type StrategyWithAccounts,
  type UpdateStrategyInput
} from '~/types/strategies'

const toast = useToast()
const strategyModalOpen = ref(false)
const editModalOpen = ref(false)
const saving = ref(false)
const editSaving = ref(false)
const includeInactiveStrategies = ref(false)
const includeThisQuarter = ref(false)
const includeThisYear = ref(false)
const selectedConnectors = ref<string[]>([])
const selectedUsers = ref<string[]>([])
const selectedTags = ref<string[]>([])
const selectedStrategy = ref<StrategyWithAccounts | null>(null)

const {
  data: accounts,
  status: accountsStatus,
  error: accountsError,
  refresh: refreshAccounts
} = await useAccounts()
const {
  data: strategies,
  status: strategiesStatus,
  error: strategiesError,
  refresh: refreshStrategies
} = await useStrategies()

const insertStrategy = useInsertStrategy()
const updateStrategy = useUpdateStrategy()

const loadingStrategies = computed(() => strategiesStatus.value === 'pending')
const refreshing = computed(() => accountsStatus.value === 'pending' || strategiesStatus.value === 'pending')
const fetchError = computed(() => accountsError.value || strategiesError.value)
const hasAccounts = computed(() => Boolean(accounts.value?.length))
const statusFilteredStrategies = computed(() =>
  (strategies.value ?? []).filter(strategy => includeInactiveStrategies.value || strategy.active)
)
const connectorOptions = computed(() => uniqueSortedConnectors(
  statusFilteredStrategies.value.flatMap(strategy => strategy.accounts.map(account => account.connector))
))
const userOptions = computed(() => [...new Set(
  statusFilteredStrategies.value.flatMap(strategy => strategy.accounts.map(account => account.account_user))
)].sort())
const tagOptions = computed(() => [...new Set(statusFilteredStrategies.value.flatMap(strategy => strategy.tags))].sort())
const filteredStrategies = computed(() => {
  const accountFilterActive = selectedConnectors.value.length > 0 || selectedUsers.value.length > 0

  return statusFilteredStrategies.value.filter((strategy) => {
    const tagMatched = matchesFilter(selectedTags.value, ...strategy.tags)
    // Connector and user must match on the same account, not across two of them.
    const accountMatched = !accountFilterActive || strategy.accounts.some(account =>
      matchesFilter(selectedConnectors.value, account.connector)
      && matchesFilter(selectedUsers.value, account.account_user)
    )

    return tagMatched && accountMatched
  })
})
const snapshotTs = computed(() =>
  (strategies.value ?? []).find(strategy => strategy.snapshot)?.snapshot?.snapshot_ts ?? null
)
const snapshotLabel = computed(() => {
  if (!snapshotTs.value) return 'No snapshot'

  return `Snapshot ${new Date(snapshotTs.value).toISOString().slice(0, 19).replace('T', ' ')} UTC`
})
const summary = computed(() =>
  `${snapshotLabel.value} · Showing ${filteredStrategies.value.length} of ${strategies.value?.length ?? 0} strategies`
)
// Reset covers the dropdowns only; the checkboxes are view toggles the user keeps.
const filtersActive = computed(() =>
  selectedConnectors.value.length > 0
  || selectedUsers.value.length > 0
  || selectedTags.value.length > 0
)

function resetFilters() {
  selectedConnectors.value = []
  selectedUsers.value = []
  selectedTags.value = []
}

const accountOptions = computed(() => (accounts.value ?? []).map(account => ({
  label: accountRefLabel(account),
  value: accountRefKey(account)
})))

const strategyFormAccountSchema = z.object({
  accountKey: z.string().min(1, 'Account is required'),
  assets: z.array(z.string())
})

const strategyFormServerSchema = z.object({
  server: z.string().trim().min(1, 'Server is required'),
  label: z.string().trim().min(1, 'Label is required'),
  url: z.string().trim().min(1, 'URL is required')
})

const formSchema = z.object({
  strategy_name: z.string().trim().min(1, 'Strategy name is required'),
  tags: z.array(z.string()),
  accounts: z.array(strategyFormAccountSchema).min(1, 'At least one account is required'),
  servers: z.array(strategyFormServerSchema)
}).superRefine((value, ctx) => {
  const accountsByKey = new Map<string, { allAssets: boolean, assets: Set<string> }>()

  value.accounts.forEach((binding, index) => {
    const account = findAccount(binding.accountKey)
    if (!account) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', index, 'accountKey'],
        message: 'Account is invalid'
      })
      return
    }

    const assets = normalizeStrategyAssets(binding.assets)
    const accountKey = accountRefKey(account)
    const accountState = accountsByKey.get(accountKey) ?? { allAssets: false, assets: new Set<string>() }

    if (!assets.length) {
      if (accountState.allAssets || accountState.assets.size) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', index, 'assets'],
          message: 'All assets overlaps with this account'
        })
        return
      }

      accountState.allAssets = true
      accountsByKey.set(accountKey, accountState)
      return
    }

    if (accountState.allAssets) {
      ctx.addIssue({
        code: 'custom',
        path: ['accounts', index, 'assets'],
        message: 'All assets already covers this account'
      })
      return
    }

    for (const asset of assets) {
      const key = strategyAccountAssetKey(account, asset)
      if (accountState.assets.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['accounts', index, 'assets'],
          message: 'Asset already selected for this account'
        })
        return
      }
      accountState.assets.add(key)
    }

    accountsByKey.set(accountKey, accountState)
  })
})

const editFormSchema = z.object({
  strategy_name: z.string().trim().min(1, 'Strategy name is required'),
  active: z.boolean(),
  tags: z.array(z.string()),
  servers: z.array(strategyFormServerSchema)
})

type StrategyForm = z.output<typeof formSchema>
type EditForm = z.output<typeof editFormSchema>

const form = reactive<StrategyForm>({
  strategy_name: '',
  tags: [],
  accounts: [],
  servers: []
})

const editForm = reactive<EditForm>({
  strategy_name: '',
  active: true,
  tags: [],
  servers: []
})

function findAccount(key: string | undefined): Account | null {
  if (!key) return null
  return (accounts.value ?? []).find(account => accountRefKey(account) === key) ?? null
}

function firstAccountKey() {
  const account = accounts.value?.[0]
  return account ? accountRefKey(account) : ''
}

function resetForm() {
  const accountKey = firstAccountKey()

  form.strategy_name = ''
  form.tags = []
  form.accounts = accountKey ? [{ accountKey, assets: [] }] : []
  form.servers = []
}

function openStrategyModal() {
  if (!hasAccounts.value) return

  resetForm()
  strategyModalOpen.value = true
}

async function refreshPageData() {
  await Promise.all([
    refreshAccounts(),
    refreshStrategies()
  ])
}

function addAccountBinding() {
  const accountKey = firstAccountKey()
  if (!accountKey) return

  form.accounts.push({ accountKey, assets: [] })
}

function removeAccountBinding(index: number) {
  if (form.accounts.length === 1) return

  form.accounts.splice(index, 1)
}

function addServer(servers: StrategyForm['servers']) {
  servers.push({ server: '', label: 'main', url: '' })
}

function removeServer(servers: StrategyForm['servers'], index: number) {
  servers.splice(index, 1)
}

function openEditModal(strategy: StrategyWithAccounts) {
  selectedStrategy.value = strategy
  editForm.strategy_name = strategy.strategy_name
  editForm.active = strategy.active
  editForm.tags = [...strategy.tags]
  editForm.servers = strategy.servers.map(server => ({
    server: server.server,
    label: server.label,
    url: server.url
  }))
  editModalOpen.value = true
}

function buildAccountInputs(bindings: StrategyForm['accounts']) {
  return bindings.map((binding) => {
    const account = findAccount(binding.accountKey)
    if (!account) throw new Error('Selected account was not found')

    return {
      connector: account.connector,
      account_user: account.account_user,
      account_name: account.account_name,
      account_type: account.account_type,
      assets: normalizeStrategyAssets(binding.assets)
    }
  })
}

async function onSubmit(event: FormSubmitEvent<StrategyForm>) {
  saving.value = true

  try {
    const payload: NewStrategyInput = {
      strategy_name: event.data.strategy_name.trim(),
      tags: normalizeStrategyTags(event.data.tags),
      active: true,
      accounts: buildAccountInputs(event.data.accounts),
      servers: event.data.servers
    }

    await insertStrategy(payload)

    await refreshStrategies()
    strategyModalOpen.value = false
    toast.add({ title: 'Strategy added', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Failed to add strategy',
      description: String((error as Error)?.message ?? error),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

async function onEditSubmit(event: FormSubmitEvent<EditForm>) {
  if (!selectedStrategy.value) return

  editSaving.value = true

  try {
    const payload: UpdateStrategyInput = {
      id: selectedStrategy.value.id,
      strategy_name: event.data.strategy_name.trim(),
      active: event.data.active,
      tags: normalizeStrategyTags(event.data.tags),
      servers: event.data.servers
    }

    await updateStrategy(payload)

    await refreshStrategies()
    editModalOpen.value = false
    selectedStrategy.value = null
    toast.add({ title: 'Strategy updated', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Failed to update strategy',
      description: String((error as Error)?.message ?? error),
      color: 'error'
    })
  } finally {
    editSaving.value = false
  }
}
</script>

<template>
  <AppPage
    title="Strategies"
    :description="summary"
  >
    <template #actions>
      <UButton
        icon="i-lucide-plus"
        label="Add strategy"
        :disabled="!hasAccounts"
        @click="openStrategyModal"
      />
      <AppRefreshButton
        :loading="refreshing"
        @refresh="refreshPageData"
      />
    </template>

    <template #toolbar>
      <AppFilterSelect
        v-model="selectedConnectors"
        :items="connectorOptions"
        placeholder="All connectors"
        class="w-full sm:w-36"
      />
      <AppFilterSelect
        v-model="selectedUsers"
        :items="userOptions"
        placeholder="All users"
        class="w-full sm:w-32"
      />
      <AppFilterSelect
        v-model="selectedTags"
        :items="tagOptions"
        placeholder="All tags"
        class="w-full sm:w-32"
      />
      <UButton
        label="Reset"
        variant="outline"
        color="neutral"
        size="sm"
        :disabled="!filtersActive"
        @click="resetFilters"
      />
      <UCheckbox
        v-model="includeInactiveStrategies"
        label="Include inactive strategies"
        size="sm"
        class="items-center sm:ml-auto"
      />
      <UCheckbox
        v-model="includeThisQuarter"
        label="Include this quarter"
        size="sm"
        class="items-center"
      />
      <UCheckbox
        v-model="includeThisYear"
        label="Include this year"
        size="sm"
        class="items-center"
      />
    </template>

    <template #default>
      <div class="space-y-4">
        <UAlert
          v-if="fetchError"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Failed to load strategies"
          :description="String((fetchError as Error)?.message ?? fetchError)"
        />
        <UAlert
          v-else-if="!hasAccounts"
          color="warning"
          variant="soft"
          icon="i-lucide-info"
          title="No accounts found"
          description="Strategies can only be added after accounts are available from Supabase."
        />

        <StrategiesTable
          :data="filteredStrategies"
          :loading="loadingStrategies"
          :show-quarter="includeThisQuarter"
          :show-year="includeThisYear"
          @edit-strategy="openEditModal"
        />
      </div>
    </template>
  </AppPage>

  <UModal
    v-model:open="strategyModalOpen"
    title="Add strategy"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm
        :schema="formSchema"
        :state="form"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Strategy"
          name="strategy_name"
          required
        >
          <UInput
            v-model="form.strategy_name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Tags"
          name="tags"
        >
          <UInputTags
            v-model="form.tags"
            add-on-blur
            add-on-paste
            add-on-tab
            delimiter=","
            placeholder="Add tag"
            class="w-full"
          />
        </UFormField>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-highlighted">
              Accounts
            </p>
            <UButton
              type="button"
              icon="i-lucide-plus"
              label="Add account"
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="saving"
              @click="addAccountBinding"
            />
          </div>

          <div
            v-for="(binding, index) in form.accounts"
            :key="index"
            class="rounded-lg border border-default p-3"
          >
            <div class="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-start">
              <UFormField
                label="Account"
                :name="`accounts.${index}.accountKey`"
                required
              >
                <USelectMenu
                  v-model="binding.accountKey"
                  :items="accountOptions"
                  value-key="value"
                  searchable
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Assets"
                :name="`accounts.${index}.assets`"
              >
                <UInputTags
                  v-model="binding.assets"
                  add-on-blur
                  add-on-paste
                  add-on-tab
                  delimiter=","
                  placeholder="All assets"
                  class="w-full"
                />
              </UFormField>

              <UButton
                type="button"
                icon="i-lucide-trash-2"
                aria-label="Remove account"
                variant="ghost"
                color="neutral"
                class="sm:mt-7"
                :disabled="form.accounts.length === 1 || saving"
                @click="removeAccountBinding(index)"
              />
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-highlighted">
              Servers
            </p>
            <UButton
              type="button"
              icon="i-lucide-plus"
              label="Add server"
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="saving"
              @click="addServer(form.servers)"
            />
          </div>

          <div
            v-for="(server, index) in form.servers"
            :key="index"
            class="rounded-lg border border-default p-3"
          >
            <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.5fr)_auto] sm:items-start">
              <UFormField
                label="Server"
                :name="`servers.${index}.server`"
                required
              >
                <UInput
                  v-model="server.server"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Label"
                :name="`servers.${index}.label`"
                required
              >
                <UInput
                  v-model="server.label"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="URL"
                :name="`servers.${index}.url`"
                required
              >
                <UInput
                  v-model="server.url"
                  class="w-full"
                />
              </UFormField>

              <UButton
                type="button"
                icon="i-lucide-trash-2"
                aria-label="Remove server"
                variant="ghost"
                color="neutral"
                class="sm:mt-7"
                :disabled="saving"
                @click="removeServer(form.servers, index)"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <UButton
            type="button"
            variant="outline"
            color="neutral"
            label="Cancel"
            :disabled="saving"
            @click="strategyModalOpen = false"
          />
          <UButton
            type="submit"
            label="Add strategy"
            :loading="saving"
          />
        </div>
      </UForm>
    </template>
  </UModal>

  <UModal
    v-model:open="editModalOpen"
    :title="selectedStrategy ? `Edit ${selectedStrategy.strategy_name}` : 'Edit strategy'"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <UForm
        :schema="editFormSchema"
        :state="editForm"
        class="space-y-4"
        @submit="onEditSubmit"
      >
        <UFormField
          label="Strategy"
          name="strategy_name"
          required
        >
          <UInput
            v-model="editForm.strategy_name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Status"
          name="active"
        >
          <UCheckbox
            v-model="editForm.active"
            label="Active"
            class="items-center"
          />
        </UFormField>

        <UFormField
          label="Tags"
          name="tags"
        >
          <UInputTags
            v-model="editForm.tags"
            add-on-blur
            add-on-paste
            add-on-tab
            delimiter=","
            placeholder="Add tag"
            class="w-full"
          />
        </UFormField>

        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-highlighted">
              Servers
            </p>
            <UButton
              type="button"
              icon="i-lucide-plus"
              label="Add server"
              variant="outline"
              color="neutral"
              size="sm"
              :disabled="editSaving"
              @click="addServer(editForm.servers)"
            />
          </div>

          <div
            v-for="(server, index) in editForm.servers"
            :key="index"
            class="rounded-lg border border-default p-3"
          >
            <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.5fr)_auto] sm:items-start">
              <UFormField
                label="Server"
                :name="`servers.${index}.server`"
                required
              >
                <UInput
                  v-model="server.server"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Label"
                :name="`servers.${index}.label`"
                required
              >
                <UInput
                  v-model="server.label"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="URL"
                :name="`servers.${index}.url`"
                required
              >
                <UInput
                  v-model="server.url"
                  class="w-full"
                />
              </UFormField>

              <UButton
                type="button"
                icon="i-lucide-trash-2"
                aria-label="Remove server"
                variant="ghost"
                color="neutral"
                class="sm:mt-7"
                :disabled="editSaving"
                @click="removeServer(editForm.servers, index)"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <UButton
            type="button"
            variant="outline"
            color="neutral"
            label="Cancel"
            :disabled="editSaving"
            @click="editModalOpen = false"
          />
          <UButton
            type="submit"
            label="Save"
            :loading="editSaving"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>
