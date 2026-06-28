import { z } from 'zod'
import {
  compareAccountFeeTiers,
  type AccountFeeTier
} from '~/types/accounts'

type AccountFeeTierRow = {
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

interface AccountFeeTiersDatabase {
  public: {
    Tables: {
      account_fee_tiers: {
        Row: AccountFeeTierRow
        Insert: AccountFeeTierRow
        Update: Partial<AccountFeeTierRow>
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

const AccountFeeTierRowSchema = z.object({
  connector: z.string().min(1),
  account_user: z.string().min(1),
  account_name: z.string().min(1),
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

const AccountFeeTierRowsSchema = z.array(AccountFeeTierRowSchema)

export function useAccountFeeTiers() {
  const supabase = useSupabaseClient<AccountFeeTiersDatabase>()

  return useAsyncData<AccountFeeTier[]>(
    'account-fee-tiers',
    async () => {
      const { data, error } = await supabase
        .from('account_fee_tiers')
        .select('connector, account_user, account_name, snapshot_ts, spot_volume_30d, spot_maker_fee, spot_taker_fee, spot_tier_volume, spot_next_tier_volume, futures_volume_30d, futures_maker_fee, futures_taker_fee, futures_tier_volume, futures_next_tier_volume')

      if (error) throw error

      return AccountFeeTierRowsSchema.parse(data ?? []).sort(compareAccountFeeTiers)
    },
    { default: () => [] }
  )
}
