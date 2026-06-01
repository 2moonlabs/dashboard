import { z } from 'zod'
import type { NewStrategyInput, Strategy, StrategyAccount, StrategySnapshot, StrategyWithAccounts, UpdateStrategyInput } from '~/types/strategies'
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

type StrategySnapshotRow = {
  snapshot_ts: string
  strategy_id: number
  total: number
  last_order_placed_at: string | null
  last_trade_filled_at: string | null
}

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
      strategy_snapshots: {
        Row: StrategySnapshotRow
        Insert: StrategySnapshotRow
        Update: Partial<StrategySnapshotRow>
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

const StrictNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined
    if (typeof value === 'string') return Number(value)
    return value
  },
  z.number().finite()
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

const LatestStrategySnapshotRowSchema = z.object({
  snapshot_ts: z.string().min(1)
})

const StrategySnapshotRowSchema = z.object({
  snapshot_ts: z.string().min(1),
  strategy_id: StrictInteger,
  total: StrictNumber,
  last_order_placed_at: z.string().nullable(),
  last_trade_filled_at: z.string().nullable()
})

const StrategySnapshotRowsSchema = z.array(StrategySnapshotRowSchema)

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
  server: z.string().trim().nullable(),
  url: z.string().trim().nullable(),
  active: z.boolean(),
  tags: z.array(z.string())
})

const UpdateStrategyResultSchema = z.object({
  id: StrictInteger
})

const StrategyIdSchema = z.object({
  id: StrictInteger
})

type ParsedStrategySnapshotRow = z.output<typeof StrategySnapshotRowSchema>

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

function utcStartOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function utcStartOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function buildBaselineTotals(rows: ParsedStrategySnapshotRow[]) {
  const baselines = new Map<number, number>()

  for (const row of rows) {
    if (baselines.has(row.strategy_id)) continue

    baselines.set(row.strategy_id, row.total)
  }

  return baselines
}

function deltaFromBaseline(row: ParsedStrategySnapshotRow, baselines: Map<number, number>) {
  const baseline = baselines.get(row.strategy_id)
  return baseline === undefined ? null : row.total - baseline
}

function buildSnapshot(
  row: ParsedStrategySnapshotRow,
  todayBaselines: Map<number, number>,
  weekBaselines: Map<number, number>,
  monthBaselines: Map<number, number>
): StrategySnapshot {
  return {
    snapshot_ts: row.snapshot_ts,
    total: row.total,
    today: deltaFromBaseline(row, todayBaselines),
    this_week: deltaFromBaseline(row, weekBaselines),
    this_month: deltaFromBaseline(row, monthBaselines),
    last_order_placed_at: row.last_order_placed_at,
    last_trade_filled_at: row.last_trade_filled_at
  }
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
      const [
        { data: strategyData, error: strategyError },
        { data: accountData, error: accountError },
        { data: latestData, error: latestError }
      ] = await Promise.all([
        supabase
          .from('strategies')
          .select('id, strategy_name, server, url, tags, active'),
        supabase
          .from('strategy_accounts')
          .select('id, strategy_id, connector, account_user, account_name, account_type, asset'),
        supabase
          .from('strategy_snapshots')
          .select('snapshot_ts')
          .order('snapshot_ts', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (strategyError) throw strategyError
      if (accountError) throw accountError
      if (latestError) throw latestError

      const strategies = StrategyRowsSchema.parse(strategyData ?? []).sort(compareStrategies)
      const accounts = StrategyAccountRowsSchema.parse(accountData ?? [])
      const latestSnapshot = LatestStrategySnapshotRowSchema.nullable().parse(latestData)
      const accountsByStrategy = new Map<number, StrategyAccount[]>()

      for (const account of accounts) {
        const rows = accountsByStrategy.get(account.strategy_id) ?? []
        rows.push(account)
        accountsByStrategy.set(account.strategy_id, rows)
      }

      for (const rows of accountsByStrategy.values()) {
        rows.sort(compareStrategyAccounts)
      }

      if (!strategies.length) return []

      if (!latestSnapshot) {
        return strategies.map(strategy => ({
          ...strategy,
          accounts: accountsByStrategy.get(strategy.id) ?? [],
          snapshot: null
        }))
      }

      const latestDate = new Date(latestSnapshot.snapshot_ts)
      const todayStart = utcStartOfDay(latestDate)
      const weekStart = new Date(todayStart)
      weekStart.setUTCDate(weekStart.getUTCDate() - 6)
      const monthStart = utcStartOfMonth(latestDate)
      const strategyIds = strategies.map(strategy => strategy.id)
      const snapshotColumns = 'snapshot_ts, strategy_id, total, last_order_placed_at, last_trade_filled_at'

      const [
        { data: latestSnapshotData, error: latestSnapshotError },
        { data: todaySnapshotData, error: todaySnapshotError },
        { data: weekSnapshotData, error: weekSnapshotError },
        { data: monthSnapshotData, error: monthSnapshotError }
      ] = await Promise.all([
        supabase
          .from('strategy_snapshots')
          .select(snapshotColumns)
          .eq('snapshot_ts', latestSnapshot.snapshot_ts)
          .in('strategy_id', strategyIds),
        supabase
          .from('strategy_snapshots')
          .select(snapshotColumns)
          .gte('snapshot_ts', todayStart.toISOString())
          .lte('snapshot_ts', latestSnapshot.snapshot_ts)
          .order('snapshot_ts', { ascending: true })
          .order('strategy_id', { ascending: true })
          .in('strategy_id', strategyIds)
          .limit(1000),
        supabase
          .from('strategy_snapshots')
          .select(snapshotColumns)
          .gte('snapshot_ts', weekStart.toISOString())
          .lte('snapshot_ts', latestSnapshot.snapshot_ts)
          .order('snapshot_ts', { ascending: true })
          .order('strategy_id', { ascending: true })
          .in('strategy_id', strategyIds)
          .limit(1000),
        supabase
          .from('strategy_snapshots')
          .select(snapshotColumns)
          .gte('snapshot_ts', monthStart.toISOString())
          .lte('snapshot_ts', latestSnapshot.snapshot_ts)
          .order('snapshot_ts', { ascending: true })
          .order('strategy_id', { ascending: true })
          .in('strategy_id', strategyIds)
          .limit(1000)
      ])

      if (latestSnapshotError) throw latestSnapshotError
      if (todaySnapshotError) throw todaySnapshotError
      if (weekSnapshotError) throw weekSnapshotError
      if (monthSnapshotError) throw monthSnapshotError

      const latestSnapshots = StrategySnapshotRowsSchema.parse(latestSnapshotData ?? [])
      const todayBaselines = buildBaselineTotals(StrategySnapshotRowsSchema.parse(todaySnapshotData ?? []))
      const weekBaselines = buildBaselineTotals(StrategySnapshotRowsSchema.parse(weekSnapshotData ?? []))
      const monthBaselines = buildBaselineTotals(StrategySnapshotRowsSchema.parse(monthSnapshotData ?? []))
      const snapshotsByStrategy = new Map(latestSnapshots.map(snapshot => [
        snapshot.strategy_id,
        buildSnapshot(snapshot, todayBaselines, weekBaselines, monthBaselines)
      ]))

      return strategies.map(strategy => ({
        ...strategy,
        accounts: accountsByStrategy.get(strategy.id) ?? [],
        snapshot: snapshotsByStrategy.get(strategy.id) ?? null
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
        server: nullableText(payload.server),
        url: nullableText(payload.url),
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
