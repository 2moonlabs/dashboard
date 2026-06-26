import { z } from 'zod'
import type { FundingRate, RangePreset } from '~/types'

// ---------------------------------------------------------------------------
// Data-boundary validation.
// Zod schemas parse raw Supabase rows into validated FundingRate objects. If
// a column goes missing, becomes null, or drifts in type, parse() throws and
// the error surfaces in useAsyncData.error → page-level UAlert. UI layer only
// ever sees well-formed FundingRate.
// ---------------------------------------------------------------------------

type FundingRateRow = {
  exchange: string
  symbol: string
  funding_time: string
  funding_rate: number
  funding_interval: number | null
}

interface FundingRatesDatabase {
  public: {
    Tables: {
      funding_rates: {
        Row: FundingRateRow
        Insert: FundingRateRow
        Update: Partial<FundingRateRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      distinct_funding_exchanges: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      distinct_funding_symbols: {
        Args: { p_exchange: string }
        Returns: string[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Strict numeric schema.
// Rejects null / undefined / empty string / non-numeric strings / NaN / Infinity.
// PostgREST serializes Postgres `numeric` as string, so we accept string input
// but require it to parse to a finite number. z.coerce.number() is NOT used
// because it silently turns null and '' into 0.
const StrictNumber = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return undefined
    if (typeof v === 'string') return Number(v)
    return v
  },
  z.number().finite()
)

const StringsSchema = z.array(z.string().min(1))

const FundingRateRowSchema = z.object({
  symbol: z.string().min(1),
  funding_time: z.string().min(1),
  funding_rate: StrictNumber,
  funding_interval: StrictNumber.nullable()
})

function normalizeFundingRateRow(raw: unknown): FundingRate {
  return FundingRateRowSchema.parse(raw)
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

export function useFundingExchanges() {
  const supabase = useSupabaseClient<FundingRatesDatabase>()
  return useAsyncData<{ label: string, value: string }[]>(
    'funding-exchanges',
    async () => {
      const { data, error } = await supabase.rpc('distinct_funding_exchanges')

      if (error) throw error

      return StringsSchema.parse(data ?? []).map(exchange => ({
        label: exchange.toUpperCase(),
        value: exchange
      }))
    },
    { default: () => [] }
  )
}

export function useSymbols(exchange: Ref<string | null | undefined>) {
  const supabase = useSupabaseClient<FundingRatesDatabase>()
  return useAsyncData<string[]>(
    'funding-symbols',
    async () => {
      if (!exchange.value) return []

      const { data, error } = await supabase.rpc('distinct_funding_symbols', {
        p_exchange: exchange.value
      })

      if (error) throw error

      return StringsSchema.parse(data ?? [])
    },
    {
      watch: [exchange],
      default: () => []
    }
  )
}

function rangeCutoff(r: RangePreset): string | null {
  if (r === 'all') return null
  const days = r === 'week' ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export function useFundingHistory(
  exchange: Ref<string | null | undefined>,
  symbol: Ref<string | null | undefined>,
  range: Ref<RangePreset>
) {
  const supabase = useSupabaseClient<FundingRatesDatabase>()
  return useAsyncData<FundingRate[]>(
    'funding-history',
    async () => {
      if (!exchange.value || !symbol.value) return []

      let query = supabase
        .from('funding_rates')
        .select('symbol, funding_time, funding_rate, funding_interval')
        .eq('exchange', exchange.value)
        .eq('symbol', symbol.value)
        .order('funding_time', { ascending: false })

      const cutoff = rangeCutoff(range.value)
      if (cutoff) {
        query = query.gte('funding_time', cutoff)
      } else {
        query = query.limit(1000)
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []).map(normalizeFundingRateRow)
    },
    {
      watch: [exchange, symbol, range],
      default: () => []
    }
  )
}
