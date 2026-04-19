import type { FundingRate, RangePreset } from '~/types'

export async function useSymbols() {
  const supabase = useSupabaseClient()
  return useAsyncData('funding-symbols', async () => {
    const { data, error } = await supabase.rpc('distinct_coinbase_funding_symbols')
    if (error) throw error
    return (data ?? []) as string[]
  })
}

function rangeCutoff(r: RangePreset): string | null {
  if (r === 'all') return null
  const days = r === 'week' ? 7 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export function useFundingHistory(
  symbol: Ref<string | null | undefined>,
  range: Ref<RangePreset>
) {
  const supabase = useSupabaseClient()
  return useAsyncData<FundingRate[]>(
    'funding-history',
    async () => {
      if (!symbol.value) return []
      let query = supabase
        .from('coinbase_funding_rates')
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
      return (data ?? []) as FundingRate[]
    },
    {
      watch: [symbol, range],
      default: () => []
    }
  )
}
