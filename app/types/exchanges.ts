export type ExchangeId = 'coinbase'

export interface ExchangeConfig {
  id: ExchangeId
  label: string

  fundingRates: {
    table: string
    distinctSymbolsFunction: string
  }
}

export const EXCHANGES: Record<ExchangeId, ExchangeConfig> = {
  coinbase: {
    id: 'coinbase',
    label: 'Coinbase',
    fundingRates: {
      table: 'coinbase_funding_rates',
      distinctSymbolsFunction: 'distinct_coinbase_funding_symbols'
    }
  }
}

export const EXCHANGE_OPTIONS: { label: string, value: ExchangeId }[]
  = Object.values(EXCHANGES).map(e => ({ label: e.label, value: e.id }))
