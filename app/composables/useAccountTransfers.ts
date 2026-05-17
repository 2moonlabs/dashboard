import { z } from 'zod'
import {
  TRANSFER_TYPES,
  accountRefKey,
  compareAccounts,
  type Account,
  type AccountBalance,
  type AccountSnapshotAsset,
  type AccountTransfer,
  type LatestAccountBalances,
  type NewAccountTransferInput
} from '~/types/accounts'

type AccountRow = {
  connector: string
  account_user: string
  account_name: string
  account_type: string
}

type AccountTransferRow = {
  id: number
  ts: string
  transfer_type: 'deposit' | 'withdraw' | 'internal_transfer'
  from_connector: string | null
  from_account_user: string | null
  from_account_name: string | null
  to_connector: string | null
  to_account_user: string | null
  to_account_name: string | null
  asset: string
  amount: number
  note: string
}

type NewAccountTransferRow = Omit<AccountTransferRow, 'id'>

type AccountSnapshotRow = {
  snapshot_ts: string
  connector: string
  account_user: string
  account_name: string
  account_type: string
  total: number
}

type AccountSnapshotAssetRow = {
  snapshot_ts: string
  connector: string
  account_user: string
  account_name: string
  asset: string
  balance: number
  quote: number
  value: number
}

interface AccountTransfersDatabase {
  public: {
    Tables: {
      accounts: {
        Row: AccountRow
        Insert: AccountRow
        Update: Partial<AccountRow>
        Relationships: []
      }
      account_transfers: {
        Row: AccountTransferRow
        Insert: NewAccountTransferRow
        Update: Partial<NewAccountTransferRow>
        Relationships: []
      }
      account_snapshots: {
        Row: AccountSnapshotRow
        Insert: AccountSnapshotRow
        Update: Partial<AccountSnapshotRow>
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

const StrictInteger = z.preprocess(
  (value) => {
    if (typeof value === 'string') return Number(value)
    return value
  },
  z.number().int()
)

const AccountRowSchema = z.object({
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  account_type: z.string().min(1)
})

const AccountRowsSchema = z.array(AccountRowSchema)

const AccountTransferRowSchema = z.object({
  id: StrictInteger,
  ts: z.string().min(1),
  transfer_type: z.enum(TRANSFER_TYPES),
  from_connector: z.string().nullable(),
  from_account_user: z.string().nullable(),
  from_account_name: z.string().nullable(),
  to_connector: z.string().nullable(),
  to_account_user: z.string().nullable(),
  to_account_name: z.string().nullable(),
  asset: z.string().min(1),
  amount: StrictNumber,
  note: z.string()
})

const AccountTransferRowsSchema = z.array(AccountTransferRowSchema)

const LatestSnapshotRowSchema = z.object({
  snapshot_ts: z.string().min(1)
})

const AccountSnapshotRowSchema = AccountRowSchema.extend({
  snapshot_ts: z.string().min(1),
  total: StrictNumber
})

const AccountSnapshotRowsSchema = z.array(AccountSnapshotRowSchema)

const AccountSnapshotAssetRowSchema = z.object({
  snapshot_ts: z.string().min(1),
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
  asset: z.string().min(1),
  balance: StrictNumber,
  quote: StrictNumber,
  value: StrictNumber
})

const AccountSnapshotAssetRowsSchema = z.array(AccountSnapshotAssetRowSchema)

const NewAccountTransferSchema = z.object({
  ts: z.string().datetime(),
  transfer_type: z.enum(TRANSFER_TYPES),
  from_connector: z.string().nullable(),
  from_account_user: z.string().nullable(),
  from_account_name: z.string().nullable(),
  to_connector: z.string().nullable(),
  to_account_user: z.string().nullable(),
  to_account_name: z.string().nullable(),
  asset: z.string().min(1),
  amount: z.number().positive(),
  note: z.string()
})

export function useAccounts() {
  const supabase = useSupabaseClient<AccountTransfersDatabase>()

  return useAsyncData<Account[]>(
    'accounts',
    async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('connector, account_user, account_name, account_type')

      if (error) throw error

      return AccountRowsSchema.parse(data ?? []).sort(compareAccounts)
    },
    { default: () => [] }
  )
}

function compareSnapshotAssets(a: AccountSnapshotAsset, b: AccountSnapshotAsset) {
  return b.value - a.value || a.asset.localeCompare(b.asset)
}

export function useLatestAccountBalances() {
  const supabase = useSupabaseClient<AccountTransfersDatabase>()

  return useAsyncData<LatestAccountBalances>(
    'account-balances-latest',
    async () => {
      const [{ data: accountData, error: accountError }, { data: latestData, error: latestError }] = await Promise.all([
        supabase
          .from('accounts')
          .select('connector, account_user, account_name, account_type'),
        supabase
          .from('account_snapshots')
          .select('snapshot_ts')
          .order('snapshot_ts', { ascending: false })
          .limit(1)
          .maybeSingle()
      ])

      if (accountError) throw accountError
      if (latestError) throw latestError

      const accounts = AccountRowsSchema.parse(accountData ?? []).sort(compareAccounts)
      const latestSnapshot = LatestSnapshotRowSchema.nullable().parse(latestData)
      if (!latestSnapshot) {
        return {
          snapshotTs: null,
          balances: accounts.map(account => ({
            ...account,
            snapshot_ts: null,
            total: null,
            assets: []
          }))
        }
      }

      const [{ data: snapshotData, error: snapshotError }, { data: assetData, error: assetError }] = await Promise.all([
        supabase
          .from('account_snapshots')
          .select('snapshot_ts, connector, account_user, account_name, account_type, total')
          .eq('snapshot_ts', latestSnapshot.snapshot_ts),
        supabase
          .from('account_snapshot_assets')
          .select('snapshot_ts, connector, account_user, account_name, asset, balance, quote, value')
          .eq('snapshot_ts', latestSnapshot.snapshot_ts)
      ])

      if (snapshotError) throw snapshotError
      if (assetError) throw assetError

      const snapshots = AccountSnapshotRowsSchema.parse(snapshotData ?? []).sort(compareAccounts)
      const assets = AccountSnapshotAssetRowsSchema.parse(assetData ?? [])
      const snapshotsByAccount = new Map(snapshots.map(snapshot => [accountRefKey(snapshot), snapshot]))
      const assetsByAccount = new Map<string, AccountSnapshotAsset[]>()

      for (const asset of assets) {
        const key = accountRefKey(asset)
        const rows = assetsByAccount.get(key) ?? []
        rows.push(asset)
        assetsByAccount.set(key, rows)
      }

      for (const rows of assetsByAccount.values()) {
        rows.sort(compareSnapshotAssets)
      }

      const balances: AccountBalance[] = accounts.map((account) => {
        const key = accountRefKey(account)
        const snapshot = snapshotsByAccount.get(key)

        return {
          ...account,
          snapshot_ts: snapshot?.snapshot_ts ?? null,
          total: snapshot?.total ?? null,
          assets: assetsByAccount.get(key) ?? []
        }
      })

      return {
        snapshotTs: latestSnapshot.snapshot_ts,
        balances
      }
    },
    { default: () => ({ snapshotTs: null, balances: [] }) }
  )
}

export function useRecentAccountTransfers() {
  const supabase = useSupabaseClient<AccountTransfersDatabase>()

  return useAsyncData<AccountTransfer[]>(
    'account-transfers-recent',
    async () => {
      const { data, error } = await supabase
        .from('account_transfers')
        .select('id, ts, transfer_type, from_connector, from_account_user, from_account_name, to_connector, to_account_user, to_account_name, asset, amount, note')
        .order('ts', { ascending: false })
        .limit(100)

      if (error) throw error

      return AccountTransferRowsSchema.parse(data ?? [])
    },
    { default: () => [] }
  )
}

export function useInsertAccountTransfer() {
  const supabase = useSupabaseClient<AccountTransfersDatabase>()

  return async (input: NewAccountTransferInput) => {
    const payload = NewAccountTransferSchema.parse(input)
    const { error } = await supabase
      .from('account_transfers')
      .insert(payload)

    if (error) throw error
  }
}
