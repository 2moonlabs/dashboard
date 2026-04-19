import type { FundingRate, RangePreset } from '~/types'
import { EXCHANGES, type ExchangeId } from '~/types/exchanges'

export function useSymbols(exchange: Ref<ExchangeId>) {
  const supabase = useSupabaseClient()
  return useAsyncData(
    'funding-symbols',
    async () => {
      const cfg = EXCHANGES[exchange.value].fundingRates
      const { data, error } = await supabase.rpc(cfg.distinctSymbolsFunction)
      if (error) throw error
      return (data ?? []) as string[]
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
      return (data ?? []) as unknown as FundingRate[]
    },
    {
      watch: [exchange, symbol, range],
      default: () => []
    }
  )
}
