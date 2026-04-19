import { z } from 'zod'
import type { FundingRate, RangePreset } from '~/types'
import { EXCHANGES, type ExchangeId } from '~/types/exchanges'

// ---------------------------------------------------------------------------
// Data-boundary validation.
// Zod schemas parse raw Supabase rows into validated FundingRate objects. If
// a column goes missing, becomes null, or drifts in type, parse() throws and
// the error surfaces in useAsyncData.error → page-level UAlert. UI layer only
// ever sees well-formed FundingRate.
// Add new exchange: define its row schema here and register in `normalizers`.
// ---------------------------------------------------------------------------

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

const CoinbaseFundingRateRowSchema = z.object({
  symbol: z.string().min(1),
  funding_time: z.string().min(1),
  funding_rate: StrictNumber,
  funding_interval: StrictNumber
})

function normalizeCoinbaseRow(raw: unknown): FundingRate {
  return CoinbaseFundingRateRowSchema.parse(raw)
}

const normalizers: Record<ExchangeId, (raw: unknown) => FundingRate> = {
  coinbase: normalizeCoinbaseRow
}

const SymbolsSchema = z.array(z.string())

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

export function useSymbols(exchange: Ref<ExchangeId>) {
  const supabase = useSupabaseClient()
  return useAsyncData(
    'funding-symbols',
    async () => {
      const cfg = EXCHANGES[exchange.value].fundingRates
      const { data, error } = await supabase.rpc(cfg.distinctSymbolsFunction)
      if (error) throw error
      return SymbolsSchema.parse(data ?? [])
    },
    { watch: [exchange] }
  )
}

function rangeCutoff(r: RangePreset): string | null {
  if (r === 'all') return null
  const days = r === 'week' ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export function useFundingHistory(
  exchange: Ref<ExchangeId>,
  symbol: Ref<string | null | undefined>,
  range: Ref<RangePreset>
) {
  const supabase = useSupabaseClient()
  return useAsyncData<FundingRate[]>(
    'funding-history',
    async () => {
      if (!symbol.value) return []
      const cfg = EXCHANGES[exchange.value].fundingRates

      let query = supabase
        .from(cfg.table)
        .select('symbol, funding_time, funding_rate, funding_interval')
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

      const normalize = normalizers[exchange.value]
      return (data ?? []).map(normalize)
    },
    {
      watch: [exchange, symbol, range],
      default: () => []
    }
  )
}
