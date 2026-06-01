import { z } from 'zod'
import type { NewStrategyInput, Strategy, StrategyAccount, StrategyWithAccounts, UpdateStrategyInput } from '~/types/strategies'
import { normalizeStrategyAssets, normalizeStrategyTags, strategyAccountAssetKey } from '~/types/strategies'
import { accountRefKey, compareAccounts } from '~/types/accounts'

type StrategyRow = {
  id: number
  strategy_name: string
  server: string | null
  url: string | null
  tags: string[]
  active: boolean
}

type NewStrategyRow = Omit<StrategyRow, 'id'>

type StrategyAccountRow = {
  id: number
  strategy_id: number
  connector: string
  account_user: string
  account_name: string
  account_type: string
  asset: string | null
}

type NewStrategyAccountRow = Omit<StrategyAccountRow, 'id'>

interface StrategiesDatabase {
  public: {
    Tables: {
      strategies: {
        Row: StrategyRow
        Insert: NewStrategyRow
        Update: Partial<NewStrategyRow>
        Relationships: []
      }
      strategy_accounts: {
        Row: StrategyAccountRow
        Insert: NewStrategyAccountRow
        Update: Partial<NewStrategyAccountRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const StrictInteger = z.preprocess(
  (value) => {
    if (typeof value === 'string') return Number(value)
    return value
  },
  z.number().int()
)

const StrategyRowSchema = z.object({
  id: StrictInteger,
  strategy_name: z.string().min(1),
  server: z.string().nullable(),
  url: z.string().nullable(),
  tags: z.array(z.string()),
  active: z.boolean()
})

const StrategyRowsSchema = z.array(StrategyRowSchema)

const StrategyAccountRowSchema = z.object({
  id: StrictInteger,
  strategy_id: StrictInteger,
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1),
  asset: z.string().nullable()
})

const StrategyAccountRowsSchema = z.array(StrategyAccountRowSchema)

const NewStrategyAccountSchema = z.object({
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1),
  assets: z.array(z.string())
})

const NewStrategySchema = z.object({
  strategy_name: z.string().trim().min(1),
  server: z.string().trim().nullable(),
  url: z.string().trim().nullable(),
  tags: z.array(z.string()),
  active: z.boolean(),
  accounts: z.array(NewStrategyAccountSchema).min(1)
})

const UpdateStrategySchema = z.object({
  id: StrictInteger,
  active: z.boolean(),
  tags: z.array(z.string())
})

const UpdateStrategyResultSchema = z.object({
  id: StrictInteger
})

const StrategyIdSchema = z.object({
  id: StrictInteger
})

function compareStrategies(a: Strategy, b: Strategy) {
  return Number(b.active) - Number(a.active)
    || a.strategy_name.localeCompare(b.strategy_name)
    || a.id - b.id
}

function compareStrategyAccounts(a: StrategyAccount, b: StrategyAccount) {
  return compareAccounts(a, b)
    || (a.asset ?? '').localeCompare(b.asset ?? '')
    || a.id - b.id
}

function nullableText(value: string | null) {
  const text = value?.trim() ?? ''
  return text || null
}

function buildStrategyAccountRows(input: NewStrategyInput, strategyId: number) {
  const rows = input.accounts.flatMap((account) => {
    const assets = normalizeStrategyAssets(account.assets)
    const rowAssets: (string | null)[] = assets.length ? assets : [null]

    return rowAssets.map(asset => ({
      strategy_id: strategyId,
      connector: account.connector,
      account_user: account.account_user,
      account_name: account.account_name,
      account_type: account.account_type,
      asset
    }))
  })

  const accountsByKey = new Map<string, { allAssets: boolean, assets: Set<string> }>()
  for (const row of rows) {
    const accountKey = accountRefKey(row)
    const accountState = accountsByKey.get(accountKey) ?? { allAssets: false, assets: new Set<string>() }

    if (row.asset === null) {
      if (accountState.allAssets || accountState.assets.size) {
        throw new Error('All assets overlaps with this account')
      }

      accountState.allAssets = true
      accountsByKey.set(accountKey, accountState)
      continue
    }

    if (accountState.allAssets) {
      throw new Error('All assets already covers this account')
    }

    const key = strategyAccountAssetKey(row, row.asset)
    if (accountState.assets.has(key)) {
      throw new Error('Duplicate strategy account asset')
    }

    accountState.assets.add(key)
    accountsByKey.set(accountKey, accountState)
  }

  return rows
}

export function useStrategies() {
  const supabase = useSupabaseClient<StrategiesDatabase>()

  return useAsyncData<StrategyWithAccounts[]>(
    'strategies',
    async () => {
      const [{ data: strategyData, error: strategyError }, { data: accountData, error: accountError }] = await Promise.all([
        supabase
          .from('strategies')
          .select('id, strategy_name, server, url, tags, active'),
        supabase
          .from('strategy_accounts')
          .select('id, strategy_id, connector, account_user, account_name, account_type, asset')
      ])

      if (strategyError) throw strategyError
      if (accountError) throw accountError

      const strategies = StrategyRowsSchema.parse(strategyData ?? []).sort(compareStrategies)
      const accounts = StrategyAccountRowsSchema.parse(accountData ?? [])
      const accountsByStrategy = new Map<number, StrategyAccount[]>()

      for (const account of accounts) {
        const rows = accountsByStrategy.get(account.strategy_id) ?? []
        rows.push(account)
        accountsByStrategy.set(account.strategy_id, rows)
      }

      for (const rows of accountsByStrategy.values()) {
        rows.sort(compareStrategyAccounts)
      }

      return strategies.map(strategy => ({
        ...strategy,
        accounts: accountsByStrategy.get(strategy.id) ?? []
      }))
    },
    { default: () => [] }
  )
}

export function useInsertStrategy() {
  const supabase = useSupabaseClient<StrategiesDatabase>()

  return async (input: NewStrategyInput) => {
    const payload = NewStrategySchema.parse(input)
    const { data: strategyData, error: strategyError } = await supabase
      .from('strategies')
      .insert({
        strategy_name: payload.strategy_name,
        server: nullableText(payload.server),
        url: nullableText(payload.url),
        tags: normalizeStrategyTags(payload.tags),
        active: payload.active
      })
      .select('id')
      .single()

    if (strategyError) throw strategyError

    const strategy = StrategyIdSchema.parse(strategyData)
    const accountRows = buildStrategyAccountRows(payload, strategy.id)
    const { error: accountError } = await supabase
      .from('strategy_accounts')
      .insert(accountRows)

    if (accountError) {
      await supabase.from('strategies').delete().eq('id', strategy.id)
      throw accountError
    }
  }
}

export function useUpdateStrategy() {
  const supabase = useSupabaseClient<StrategiesDatabase>()

  return async (input: UpdateStrategyInput) => {
    const payload = UpdateStrategySchema.parse(input)
    const { data, error } = await supabase
      .from('strategies')
      .update({
        active: payload.active,
        tags: normalizeStrategyTags(payload.tags)
      })
      .eq('id', payload.id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('No strategy was updated. Check update permissions for strategies.')

    UpdateStrategyResultSchema.parse(data)
  }
}
