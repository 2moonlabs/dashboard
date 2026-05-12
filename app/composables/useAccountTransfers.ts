import { z } from 'zod'
import {
  TRANSFER_TYPES,
  compareAccounts,
  type Account,
  type AccountTransfer,
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
