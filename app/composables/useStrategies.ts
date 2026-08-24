import { z } from 'zod'
import type {
  NewStrategyInput,
  NewStrategyServerInput,
  Strategy,
  StrategyAccount,
  StrategyServer,
  StrategySnapshot,
  StrategyWithAccounts,
  UpdateStrategyInput
} from '~/types/strategies'
import { normalizeStrategyAssets, normalizeStrategyTags, strategyAccountAssetKey } from '~/types/strategies'
import { TRANSFER_TYPES, accountRefKey, compareAccounts, type AccountRef } from '~/types/accounts'

type StrategyRow = {
  id: number
  strategy_name: string
  tags: string[]
  active: boolean
}

type NewStrategyRow = Omit<StrategyRow, 'id'>

type StrategyServerRow = {
  id: number
  strategy_id: number
  server: string
  label: string
  url: string
}

type NewStrategyServerRow = Omit<StrategyServerRow, 'id'>

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
type NewStrategyAccountInputRow = Omit<NewStrategyAccountRow, 'strategy_id'>

type StrategySnapshotRow = {
  snapshot_ts: string
  strategy_id: number
  total: number | null
  last_order_placed_at: string | null
  last_trade_filled_at: string | null
}

type AccountTransferRow = {
  id: number
  ts: string
  transfer_type: 'deposit' | 'withdraw' | 'internal_transfer'
  from_connector: string | null
  from_account_user: string | null
  from_account_name: string | null
  from_account_type: string | null
  to_connector: string | null
  to_account_user: string | null
  to_account_name: string | null
  to_account_type: string | null
  asset: string
  amount: number
  note: string
}

type NewAccountTransferRow = Omit<AccountTransferRow, 'id'>

type AccountSnapshotAssetRow = {
  snapshot_ts: string
  connector: string
  account_user: string
  account_name: string
  account_type: string
  asset: string
  balance: number
  quote: number
  value: number
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
      strategy_servers: {
        Row: StrategyServerRow
        Insert: NewStrategyServerRow
        Update: Partial<NewStrategyServerRow>
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
      account_transfers: {
        Row: AccountTransferRow
        Insert: NewAccountTransferRow
        Update: Partial<NewAccountTransferRow>
        Relationships: []
      }
      account_snapshot_assets: {
        Row: AccountSnapshotAssetRow
        Insert: AccountSnapshotAssetRow
        Update: Partial<AccountSnapshotAssetRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      insert_strategy: {
        Args: {
          p_strategy_name: string
          p_tags: string[]
          p_active: boolean
          p_accounts: NewStrategyAccountInputRow[]
          p_servers: NewStrategyServerInput[]
        }
        Returns: number
      }
    }
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
  tags: z.array(z.string()),
  active: z.boolean()
})

const StrategyRowsSchema = z.array(StrategyRowSchema)

const StrategyServerRowSchema = z.object({
  id: StrictInteger,
  strategy_id: StrictInteger,
  server: z.string(),
  label: z.string(),
  url: z.string()
})

const StrategyServerRowsSchema = z.array(StrategyServerRowSchema)

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
  // Null when a collector run failed, which is distinct from a real zero balance.
  // A missing or empty value is still rejected rather than treated as a failure.
  total: StrictNumber.nullable(),
  last_order_placed_at: z.string().nullable(),
  last_trade_filled_at: z.string().nullable()
})

const StrategySnapshotRowsSchema = z.array(StrategySnapshotRowSchema)

const AccountTransferRowSchema = z.object({
  id: StrictInteger,
  ts: z.string().min(1),
  transfer_type: z.enum(TRANSFER_TYPES),
  from_connector: z.string().nullable(),
  from_account_user: z.string().nullable(),
  from_account_name: z.string().nullable(),
  from_account_type: z.string().nullable(),
  to_connector: z.string().nullable(),
  to_account_user: z.string().nullable(),
  to_account_name: z.string().nullable(),
  to_account_type: z.string().nullable(),
  asset: z.string().min(1),
  amount: StrictNumber
})

const AccountTransferRowsSchema = z.array(AccountTransferRowSchema)

const AccountSnapshotAssetQuoteRowSchema = z.object({
  snapshot_ts: z.string().min(1),
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1),
  asset: z.string().min(1),
  quote: StrictNumber
})

const AccountSnapshotAssetQuoteRowsSchema = z.array(AccountSnapshotAssetQuoteRowSchema)

const NewStrategyAccountSchema = z.object({
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1),
  assets: z.array(z.string())
})

const NewStrategyServerSchema = z.object({
  server: z.string().trim(),
  label: z.string().trim(),
  url: z.string().trim()
})

const NewStrategySchema = z.object({
  strategy_name: z.string().trim().min(1),
  tags: z.array(z.string()),
  active: z.boolean(),
  accounts: z.array(NewStrategyAccountSchema).min(1),
  servers: z.array(NewStrategyServerSchema)
})

const UpdateStrategySchema = z.object({
  id: StrictInteger,
  strategy_name: z.string().trim().min(1),
  active: z.boolean(),
  tags: z.array(z.string()),
  servers: z.array(NewStrategyServerSchema)
})

const UpdateStrategyResultSchema = z.object({
  id: StrictInteger
})

type ParsedStrategySnapshotRow = z.output<typeof StrategySnapshotRowSchema>
type ParsedAccountTransferRow = z.output<typeof AccountTransferRowSchema>
type ParsedAccountSnapshotAssetQuoteRow = z.output<typeof AccountSnapshotAssetQuoteRowSchema>
type PeriodKey = 'today' | 'this_week' | 'this_month' | 'this_quarter'
type StrategyAccountMembership = {
  allAssets: boolean
  assets: Set<string>
}
type QuotePoint = {
  ts: number
  quote: number
}
type QuoteLookupGroup = {
  account: AccountRef
  asset: string
  startTs: string
  endTs: string
}

const STABLE_ASSETS = new Set(['USD', 'USDT', 'USDC', 'DAI'])
const QUOTE_QUERY_PAGE_SIZE = 1000
const QUOTE_LOOKUP_GROUP_CONCURRENCY = 4

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

function utcStartOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function utcStartOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function utcStartOfQuarter(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3, 1))
}

function normalizeAsset(asset: string) {
  return asset.trim().toUpperCase()
}

function buildBaselineRows(rows: ParsedStrategySnapshotRow[]) {
  const baselines = new Map<number, ParsedStrategySnapshotRow>()

  for (const row of rows) {
    // Skip failed collector runs so the period anchors on the first usable snapshot.
    if (row.total === null) continue
    if (baselines.has(row.strategy_id)) continue

    baselines.set(row.strategy_id, row)
  }

  return baselines
}

function buildStrategyMembership(accounts: StrategyAccount[]) {
  const membership = new Map<number, Map<string, StrategyAccountMembership>>()

  for (const account of accounts) {
    const accountsByKey = membership.get(account.strategy_id) ?? new Map<string, StrategyAccountMembership>()
    const accountKey = accountRefKey(account)
    const accountMembership = accountsByKey.get(accountKey) ?? {
      allAssets: false,
      assets: new Set<string>()
    }

    if (account.asset === null) {
      accountMembership.allAssets = true
    } else {
      accountMembership.assets.add(normalizeAsset(account.asset))
    }

    accountsByKey.set(accountKey, accountMembership)
    membership.set(account.strategy_id, accountsByKey)
  }

  return membership
}

function transferSideAccount(transfer: ParsedAccountTransferRow, side: 'from' | 'to'): AccountRef | null {
  const connector = transfer[`${side}_connector`]
  const accountUser = transfer[`${side}_account_user`]
  const accountName = transfer[`${side}_account_name`]
  const accountType = transfer[`${side}_account_type`]

  if (!connector || !accountUser || !accountName || !accountType) return null

  return {
    connector,
    account_user: accountUser,
    account_name: accountName,
    account_type: accountType
  }
}

function strategyMatchesTransferSide(
  membership: Map<number, Map<string, StrategyAccountMembership>>,
  strategyId: number,
  account: AccountRef | null,
  asset: string
) {
  if (!account) return false

  const accountMembership = membership.get(strategyId)?.get(accountRefKey(account))
  if (!accountMembership) return false

  return accountMembership.allAssets || accountMembership.assets.has(asset)
}

function quoteKey(account: AccountRef, asset: string) {
  return strategyAccountAssetKey(account, asset)
}

async function mapInConcurrentChunks<T, R>(
  items: T[],
  chunkSize: number,
  task: (item: T) => Promise<R>
) {
  const results: R[] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize)
    results.push(...await Promise.all(chunk.map(task)))
  }

  return results
}

function buildQuoteLookupGroups(
  transfers: ParsedAccountTransferRow[],
  strategyIds: number[],
  membership: Map<number, Map<string, StrategyAccountMembership>>
) {
  const groups = new Map<string, {
    account: AccountRef
    asset: string
    minTs: number
    maxTs: number
  }>()

  for (const transfer of transfers) {
    const asset = normalizeAsset(transfer.asset)
    if (STABLE_ASSETS.has(asset)) continue

    const transferTs = new Date(transfer.ts).getTime()
    if (!Number.isFinite(transferTs)) continue

    for (const side of ['from', 'to'] as const) {
      const account = transferSideAccount(transfer, side)
      if (!account) continue
      if (!strategyIds.some(strategyId => strategyMatchesTransferSide(membership, strategyId, account, asset))) continue

      const key = quoteKey(account, asset)
      const group = groups.get(key)

      if (group) {
        group.minTs = Math.min(group.minTs, transferTs)
        group.maxTs = Math.max(group.maxTs, transferTs)
        continue
      }

      groups.set(key, {
        account,
        asset,
        minTs: transferTs,
        maxTs: transferTs
      })
    }
  }

  return [...groups.values()].map<QuoteLookupGroup>(group => ({
    account: group.account,
    asset: group.asset,
    startTs: new Date(group.minTs).toISOString(),
    endTs: new Date(group.maxTs).toISOString()
  }))
}

function buildQuotePoints(rows: ParsedAccountSnapshotAssetQuoteRow[]) {
  const quotePoints = new Map<string, QuotePoint[]>()

  for (const row of rows) {
    const key = quoteKey(row, normalizeAsset(row.asset))
    const points = quotePoints.get(key) ?? []
    const ts = new Date(row.snapshot_ts).getTime()
    if (Number.isFinite(ts)) {
      points.push({ ts, quote: row.quote })
      quotePoints.set(key, points)
    }
  }

  for (const points of quotePoints.values()) {
    points.sort((a, b) => a.ts - b.ts)
  }

  return quotePoints
}

function nearestQuote(account: AccountRef, asset: string, ts: number, quotePoints: Map<string, QuotePoint[]>) {
  const points = quotePoints.get(quoteKey(account, asset))
  if (!points?.length) return null

  let nearest: QuotePoint | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const point of points) {
    const distance = Math.abs(point.ts - ts)
    if (distance >= nearestDistance) continue

    nearest = point
    nearestDistance = distance
  }

  return nearest?.quote ?? null
}

function transferSideValue(
  transfer: ParsedAccountTransferRow,
  side: 'from' | 'to',
  asset: string,
  ts: number,
  quotePoints: Map<string, QuotePoint[]>
) {
  if (STABLE_ASSETS.has(asset)) return transfer.amount

  const account = transferSideAccount(transfer, side)
  if (!account) return null

  const quote = nearestQuote(account, asset, ts, quotePoints)
  return quote === null ? null : transfer.amount * quote
}

function transferFlowForStrategy(
  transfer: ParsedAccountTransferRow,
  strategyId: number,
  membership: Map<number, Map<string, StrategyAccountMembership>>,
  quotePoints: Map<string, QuotePoint[]>
) {
  const asset = normalizeAsset(transfer.asset)
  const ts = new Date(transfer.ts).getTime()
  if (!Number.isFinite(ts)) return 0

  const fromAccount = transferSideAccount(transfer, 'from')
  const toAccount = transferSideAccount(transfer, 'to')
  const fromMatches = strategyMatchesTransferSide(membership, strategyId, fromAccount, asset)
  const toMatches = strategyMatchesTransferSide(membership, strategyId, toAccount, asset)

  if (transfer.transfer_type === 'deposit') {
    return toMatches ? transferSideValue(transfer, 'to', asset, ts, quotePoints) : 0
  }

  if (transfer.transfer_type === 'withdraw') {
    const value = fromMatches ? transferSideValue(transfer, 'from', asset, ts, quotePoints) : 0
    return value === null ? null : -value
  }

  if (fromMatches === toMatches) return 0

  if (toMatches) {
    return transferSideValue(transfer, 'to', asset, ts, quotePoints)
  }

  const value = transferSideValue(transfer, 'from', asset, ts, quotePoints)
  return value === null ? null : -value
}

function addTransferFlow(flows: Map<number, number | null>, strategyId: number, value: number | null) {
  if (flows.get(strategyId) === null) return

  if (value === null) {
    flows.set(strategyId, null)
    return
  }

  flows.set(strategyId, (flows.get(strategyId) ?? 0) + value)
}

function buildTransferFlows(
  transfers: ParsedAccountTransferRow[],
  strategyIds: number[],
  membership: Map<number, Map<string, StrategyAccountMembership>>,
  quotePoints: Map<string, QuotePoint[]>,
  baselinesByPeriod: Record<PeriodKey, Map<number, ParsedStrategySnapshotRow>>,
  latestSnapshotTs: string
) {
  const latestTs = new Date(latestSnapshotTs).getTime()
  const flows: Record<PeriodKey, Map<number, number | null>> = {
    today: new Map(),
    this_week: new Map(),
    this_month: new Map(),
    this_quarter: new Map()
  }

  if (!Number.isFinite(latestTs)) return flows

  for (const transfer of transfers) {
    const transferTs = new Date(transfer.ts).getTime()
    if (!Number.isFinite(transferTs) || transferTs > latestTs) continue

    for (const strategyId of strategyIds) {
      const value = transferFlowForStrategy(transfer, strategyId, membership, quotePoints)
      if (value === 0) continue

      for (const period of Object.keys(flows) as PeriodKey[]) {
        const baseline = baselinesByPeriod[period].get(strategyId)
        if (!baseline) continue

        const baselineTs = new Date(baseline.snapshot_ts).getTime()
        if (!Number.isFinite(baselineTs) || transferTs <= baselineTs) continue

        addTransferFlow(flows[period], strategyId, value)
      }
    }
  }

  return flows
}

function deltaFromBaseline(
  row: ParsedStrategySnapshotRow,
  baselines: Map<number, ParsedStrategySnapshotRow>,
  transferFlows: Map<number, number | null>
) {
  const baseline = baselines.get(row.strategy_id)
  if (!baseline) return null

  // Guard explicitly: arithmetic would silently coerce a null total into a zero.
  if (row.total === null || baseline.total === null) return null

  const transferFlow = transferFlows.get(row.strategy_id) ?? 0
  if (transferFlow === null) return null

  return row.total - baseline.total - transferFlow
}

function buildSnapshot(
  row: ParsedStrategySnapshotRow,
  baselinesByPeriod: Record<PeriodKey, Map<number, ParsedStrategySnapshotRow>>,
  transferFlows: Record<PeriodKey, Map<number, number | null>>
): StrategySnapshot {
  return {
    snapshot_ts: row.snapshot_ts,
    total: row.total,
    today: deltaFromBaseline(row, baselinesByPeriod.today, transferFlows.today),
    this_week: deltaFromBaseline(row, baselinesByPeriod.this_week, transferFlows.this_week),
    this_month: deltaFromBaseline(row, baselinesByPeriod.this_month, transferFlows.this_month),
    this_quarter: deltaFromBaseline(row, baselinesByPeriod.this_quarter, transferFlows.this_quarter),
    last_order_placed_at: row.last_order_placed_at,
    last_trade_filled_at: row.last_trade_filled_at
  }
}

function buildStrategyAccountRows(input: NewStrategyInput) {
  const rows = input.accounts.flatMap((account) => {
    const assets = normalizeStrategyAssets(account.assets)
    const rowAssets: (string | null)[] = assets.length ? assets : [null]

    return rowAssets.map(asset => ({
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
        { data: serverData, error: serverError },
        { data: latestData, error: latestError }
      ] = await Promise.all([
        supabase
          .from('strategies')
          .select('id, strategy_name, tags, active'),
        supabase
          .from('strategy_accounts')
          .select('id, strategy_id, connector, account_user, account_name, account_type, asset'),
        supabase
          .from('strategy_servers')
          .select('id, strategy_id, server, label, url')
          .order('id', { ascending: true }),
        supabase
          .from('strategy_snapshots')
          .select('snapshot_ts')
          .order('snapshot_ts', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (strategyError) throw strategyError
      if (accountError) throw accountError
      if (serverError) throw serverError
      if (latestError) throw latestError

      const strategies = StrategyRowsSchema.parse(strategyData ?? []).sort(compareStrategies)
      const accounts = StrategyAccountRowsSchema.parse(accountData ?? [])
      const servers = StrategyServerRowsSchema.parse(serverData ?? [])
      const latestSnapshot = LatestStrategySnapshotRowSchema.nullable().parse(latestData)
      const accountsByStrategy = new Map<number, StrategyAccount[]>()
      const serversByStrategy = new Map<number, StrategyServer[]>()

      for (const account of accounts) {
        const rows = accountsByStrategy.get(account.strategy_id) ?? []
        rows.push(account)
        accountsByStrategy.set(account.strategy_id, rows)
      }

      for (const rows of accountsByStrategy.values()) {
        rows.sort(compareStrategyAccounts)
      }

      for (const server of servers) {
        const rows = serversByStrategy.get(server.strategy_id) ?? []
        rows.push(server)
        serversByStrategy.set(server.strategy_id, rows)
      }

      if (!strategies.length) return []

      if (!latestSnapshot) {
        return strategies.map(strategy => ({
          ...strategy,
          accounts: accountsByStrategy.get(strategy.id) ?? [],
          servers: serversByStrategy.get(strategy.id) ?? [],
          snapshot: null
        }))
      }

      const latestDate = new Date(latestSnapshot.snapshot_ts)
      const todayStart = utcStartOfDay(latestDate)
      const weekStart = new Date(todayStart)
      weekStart.setUTCDate(weekStart.getUTCDate() - 6)
      const monthStart = utcStartOfMonth(latestDate)
      const quarterStart = utcStartOfQuarter(latestDate)
      const transferStart = new Date(Math.min(
        todayStart.getTime(),
        weekStart.getTime(),
        monthStart.getTime(),
        quarterStart.getTime()
      ))
      const strategyIds = strategies.map(strategy => strategy.id)
      const snapshotColumns = 'snapshot_ts, strategy_id, total, last_order_placed_at, last_trade_filled_at'

      const [
        { data: latestSnapshotData, error: latestSnapshotError },
        { data: todaySnapshotData, error: todaySnapshotError },
        { data: weekSnapshotData, error: weekSnapshotError },
        { data: monthSnapshotData, error: monthSnapshotError },
        { data: quarterSnapshotData, error: quarterSnapshotError }
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
          .limit(1000),
        supabase
          .from('strategy_snapshots')
          .select(snapshotColumns)
          .gte('snapshot_ts', quarterStart.toISOString())
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
      if (quarterSnapshotError) throw quarterSnapshotError

      const latestSnapshots = StrategySnapshotRowsSchema.parse(latestSnapshotData ?? [])
      if (!latestSnapshots.length) {
        return strategies.map(strategy => ({
          ...strategy,
          accounts: accountsByStrategy.get(strategy.id) ?? [],
          servers: serversByStrategy.get(strategy.id) ?? [],
          snapshot: null
        }))
      }

      const baselinesByPeriod = {
        today: buildBaselineRows(StrategySnapshotRowsSchema.parse(todaySnapshotData ?? [])),
        this_week: buildBaselineRows(StrategySnapshotRowsSchema.parse(weekSnapshotData ?? [])),
        this_month: buildBaselineRows(StrategySnapshotRowsSchema.parse(monthSnapshotData ?? [])),
        this_quarter: buildBaselineRows(StrategySnapshotRowsSchema.parse(quarterSnapshotData ?? []))
      }

      // Assumes the strategy transfer window stays below the UI fetch cap.
      // Paginate or move this calculation server-side if transfer volume grows.
      const { data: transferData, error: transferError } = await supabase
        .from('account_transfers')
        .select('id, ts, transfer_type, from_connector, from_account_user, from_account_name, from_account_type, to_connector, to_account_user, to_account_name, to_account_type, asset, amount')
        .gt('ts', transferStart.toISOString())
        .lte('ts', latestSnapshot.snapshot_ts)
        .order('ts', { ascending: true })
        .limit(5000)

      if (transferError) throw transferError

      const transfers = AccountTransferRowsSchema.parse(transferData ?? [])
      const strategyMembership = buildStrategyMembership(accounts)
      const quoteLookupGroups = buildQuoteLookupGroups(transfers, strategyIds, strategyMembership)
      const quoteRows: ParsedAccountSnapshotAssetQuoteRow[] = []

      if (quoteLookupGroups.length) {
        const quoteColumns = 'snapshot_ts, connector, account_user, account_name, account_type, asset, quote'
        const quoteRowsByGroup = await mapInConcurrentChunks(
          quoteLookupGroups,
          QUOTE_LOOKUP_GROUP_CONCURRENCY,
          async (group) => {
            const rows: ParsedAccountSnapshotAssetQuoteRow[] = []
            const baseQuery = () => supabase
              .from('account_snapshot_assets')
              .select(quoteColumns)
              .eq('connector', group.account.connector)
              .eq('account_user', group.account.account_user)
              .eq('account_name', group.account.account_name)
              .eq('account_type', group.account.account_type)
              .eq('asset', group.asset)

            const [
              { data: beforeData, error: beforeError },
              { data: afterData, error: afterError }
            ] = await Promise.all([
              baseQuery()
                .lte('snapshot_ts', group.startTs)
                .order('snapshot_ts', { ascending: false })
                .limit(1)
                .maybeSingle(),
              baseQuery()
                .gte('snapshot_ts', group.endTs)
                .order('snapshot_ts', { ascending: true })
                .limit(1)
                .maybeSingle()
            ])

            if (beforeError) throw beforeError
            if (afterError) throw afterError

            for (const data of [beforeData, afterData]) {
              const row = AccountSnapshotAssetQuoteRowSchema.nullable().parse(data)
              if (row) rows.push(row)
            }

            for (let from = 0; ; from += QUOTE_QUERY_PAGE_SIZE) {
              const { data, error } = await baseQuery()
                .gte('snapshot_ts', group.startTs)
                .lte('snapshot_ts', group.endTs)
                .order('snapshot_ts', { ascending: true })
                .range(from, from + QUOTE_QUERY_PAGE_SIZE - 1)

              if (error) throw error

              const pageRows = AccountSnapshotAssetQuoteRowsSchema.parse(data ?? [])
              rows.push(...pageRows)

              if (pageRows.length < QUOTE_QUERY_PAGE_SIZE) break
            }

            return rows
          }
        )

        quoteRows.push(...quoteRowsByGroup.flat())
      }

      const transferFlows = buildTransferFlows(
        transfers,
        strategyIds,
        strategyMembership,
        buildQuotePoints(quoteRows),
        baselinesByPeriod,
        latestSnapshot.snapshot_ts
      )
      const snapshotsByStrategy = new Map(latestSnapshots.map(snapshot => [
        snapshot.strategy_id,
        buildSnapshot(snapshot, baselinesByPeriod, transferFlows)
      ]))

      return strategies.map(strategy => ({
        ...strategy,
        accounts: accountsByStrategy.get(strategy.id) ?? [],
        servers: serversByStrategy.get(strategy.id) ?? [],
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
    const accountRows = buildStrategyAccountRows(payload)
    const { error } = await supabase.rpc('insert_strategy', {
      p_strategy_name: payload.strategy_name,
      p_tags: normalizeStrategyTags(payload.tags),
      p_active: payload.active,
      p_accounts: accountRows,
      p_servers: payload.servers
    })

    if (error) throw error
  }
}

export function useUpdateStrategy() {
  const supabase = useSupabaseClient<StrategiesDatabase>()

  return async (input: UpdateStrategyInput) => {
    const payload = UpdateStrategySchema.parse(input)
    const { data, error } = await supabase
      .from('strategies')
      .update({
        strategy_name: payload.strategy_name,
        active: payload.active,
        tags: normalizeStrategyTags(payload.tags)
      })
      .eq('id', payload.id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('No strategy was updated. Check update permissions for strategies.')

    UpdateStrategyResultSchema.parse(data)

    const { error: deleteServersError } = await supabase
      .from('strategy_servers')
      .delete()
      .eq('strategy_id', payload.id)

    if (deleteServersError) throw deleteServersError

    if (payload.servers.length) {
      const { error: insertServersError } = await supabase
        .from('strategy_servers')
        .insert(payload.servers.map(server => ({
          strategy_id: payload.id,
          ...server
        })))

      if (insertServersError) throw insertServersError
    }
  }
}
