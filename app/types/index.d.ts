export interface FundingRate {
  symbol: string
  funding_time: string
  funding_rate: number
  funding_interval: number | null
}

export type RangePreset = 'week' | 'month' | 'all'
