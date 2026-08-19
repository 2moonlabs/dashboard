import { z } from 'zod'
import {
  compareAccountVolumes,
  type AccountVolume,
  type AccountVolumeHistoryPoint,
  type AccountVolumeRangeDays
} from '~/types/accounts'

type AccountVolumeRow = {
  connector: string
  account_user: string
  account_name: string
  snapshot_ts: string
  spot_volume_30d: number | null
  spot_maker_fee: number | null
  spot_taker_fee: number | null
  spot_tier_volume: number | null
  spot_next_tier_volume: number | null
  futures_volume_30d: number | null
  futures_maker_fee: number | null
  futures_taker_fee: number | null
  futures_tier_volume: number | null
  futures_next_tier_volume: number | null
}

type AccountRow = {
  connector: string
  account_user: string
  account_name: string
  account_type: string
}

type AccountVolumeRef = Pick<AccountVolume, 'connector' | 'account_user' | 'account_name'>

interface AccountVolumesDatabase {
  public: {
    Tables: {
      accounts: {
        Row: AccountRow
        Insert: AccountRow
        Update: Partial<AccountRow>
        Relationships: []
      }
      account_volumes: {
        Row: AccountVolumeRow
        Insert: AccountVolumeRow
        Update: Partial<AccountVolumeRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const StrictNumber = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined
    if (typeof value === 'string') return Number(value)
    return value
  },
  z.number().finite()
)

const LatestSnapshotRowSchema = z.object({
  snapshot_ts: z.string().min(1)
})

const AccountVolumeRefRowSchema = z.object({
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1)
})

const AccountVolumeRefRowsSchema = z.array(AccountVolumeRefRowSchema)

const AccountVolumeRowSchema = AccountVolumeRefRowSchema.extend({
  snapshot_ts: z.string().min(1),
  spot_volume_30d: StrictNumber.nullable(),
  spot_maker_fee: StrictNumber.nullable(),
  spot_taker_fee: StrictNumber.nullable(),
  spot_tier_volume: StrictNumber.nullable(),
  spot_next_tier_volume: StrictNumber.nullable(),
  futures_volume_30d: StrictNumber.nullable(),
  futures_maker_fee: StrictNumber.nullable(),
  futures_taker_fee: StrictNumber.nullable(),
  futures_tier_volume: StrictNumber.nullable(),
  futures_next_tier_volume: StrictNumber.nullable()
})

const AccountVolumeRowsSchema = z.array(AccountVolumeRowSchema)

const AccountVolumeHistoryRowSchema = z.object({
  snapshot_ts: z.string().min(1),
  spot_volume_30d: StrictNumber.nullable(),
  futures_volume_30d: StrictNumber.nullable()
})

const AccountVolumeHistoryRowsSchema = z.array(AccountVolumeHistoryRowSchema)
const HISTORY_PAGE_SIZE = 1000
const DAY_MS = 24 * 60 * 60 * 1000

function accountVolumeKey(account: AccountVolumeRef) {
  return JSON.stringify([account.connector, account.account_user, account.account_name])
}

function missingAccountVolume(account: AccountVolumeRef, snapshotTs: string): AccountVolume {
  return {
    ...account,
    snapshot_ts: snapshotTs,
    spot_volume_30d: null,
    spot_maker_fee: null,
    spot_taker_fee: null,
    spot_tier_volume: null,
    spot_next_tier_volume: null,
    futures_volume_30d: null,
    futures_maker_fee: null,
    futures_taker_fee: null,
    futures_tier_volume: null,
    futures_next_tier_volume: null
  }
}

function mergeLatestAccountVolumes(
  accounts: AccountVolumeRef[],
  volumes: AccountVolume[],
  snapshotTs: string
) {
  const accountsByKey = new Map<string, AccountVolumeRef>()
  const volumesByKey = new Map(volumes.map(volume => [accountVolumeKey(volume), volume]))

  for (const account of [...accounts, ...volumes]) {
    accountsByKey.set(accountVolumeKey(account), account)
  }

  return Array.from(
    accountsByKey.values(),
    account => volumesByKey.get(accountVolumeKey(account)) ?? missingAccountVolume(account, snapshotTs)
  ).sort(compareAccountVolumes)
}

export function useAccountVolumes() {
  const supabase = useSupabaseClient<AccountVolumesDatabase>()

  return useAsyncData<AccountVolume[]>(
    'account-volumes',
    async () => {
      const [latestSnapshotResult, accountsResult] = await Promise.all([
        supabase
          .from('account_volumes')
          .select('snapshot_ts')
          .order('snapshot_ts', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('accounts')
          .select('connector, account_user, account_name')
          .eq('account_name', 'main')
      ])

      const { data: latestSnapshotData, error: latestSnapshotError } = latestSnapshotResult
      const { data: accountsData, error: accountsError } = accountsResult

      if (latestSnapshotError) throw latestSnapshotError
      if (accountsError) throw accountsError

      const latestSnapshot = LatestSnapshotRowSchema.nullable().parse(latestSnapshotData)
      if (!latestSnapshot) return []

      const accounts = AccountVolumeRefRowsSchema.parse(accountsData ?? [])

      const { data, error } = await supabase
        .from('account_volumes')
        .select('connector, account_user, account_name, snapshot_ts, spot_volume_30d, spot_maker_fee, spot_taker_fee, spot_tier_volume, spot_next_tier_volume, futures_volume_30d, futures_maker_fee, futures_taker_fee, futures_tier_volume, futures_next_tier_volume')
        .eq('snapshot_ts', latestSnapshot.snapshot_ts)

      if (error) throw error

      const volumes = AccountVolumeRowsSchema.parse(data ?? [])
      return mergeLatestAccountVolumes(accounts, volumes, latestSnapshot.snapshot_ts)
    },
    { default: () => [] }
  )
}

export function useAccountVolumeHistory(
  connector: Ref<string | null | undefined>,
  accountUser: Ref<string | null | undefined>,
  accountName: Ref<string | null | undefined>,
  rangeDays: Ref<AccountVolumeRangeDays>
) {
  const supabase = useSupabaseClient<AccountVolumesDatabase>()
  const historyKey = computed(() => [
    'account-volume-history',
    connector.value ?? '',
    accountUser.value ?? '',
    accountName.value ?? '',
    rangeDays.value
  ].join(':'))

  return useAsyncData<AccountVolumeHistoryPoint[]>(
    historyKey,
    async () => {
      const selectedConnector = connector.value
      const selectedAccountUser = accountUser.value
      const selectedAccountName = accountName.value
      if (!selectedConnector || !selectedAccountUser || !selectedAccountName) return []

      const rangeStart = new Date(Date.now() - rangeDays.value * DAY_MS).toISOString()
      const rows: AccountVolumeHistoryPoint[] = []

      for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('account_volumes')
          .select('snapshot_ts, spot_volume_30d, futures_volume_30d')
          .eq('connector', selectedConnector)
          .eq('account_user', selectedAccountUser)
          .eq('account_name', selectedAccountName)
          .gte('snapshot_ts', rangeStart)
          .order('snapshot_ts', { ascending: true })
          .range(from, from + HISTORY_PAGE_SIZE - 1)

        if (error) throw error

        const pageRows = AccountVolumeHistoryRowsSchema.parse(data ?? [])
        rows.push(...pageRows)

        if (pageRows.length < HISTORY_PAGE_SIZE) break
      }

      return rows
    },
    {
      // Switching account navigates to a new route, which remounts the page.
      // Blocking that navigation on this query keeps the outgoing page mounted
      // long enough to unmount underneath the open USelect portal and crash, so
      // let the page mount first and fill the chart in behind its spinner.
      lazy: true,
      default: () => []
    }
  )
}
