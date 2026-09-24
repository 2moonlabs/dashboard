import type { AccountRef } from './accounts'
import { accountRefKey } from './accounts'

export interface Strategy {
  id: number
  strategy_name: string
  tags: string[]
  active: boolean
}

export interface StrategyServer {
  id: number
  strategy_id: number
  server: string
  label: string
  url: string
}

export interface StrategyAccount extends AccountRef {
  id: number
  strategy_id: number
  asset: string | null
}

export interface StrategyPeriodPnl {
  value: number
  // Modified Dietz capital base: the baseline total plus each in-period
  // transfer weighted by the share of the period it was invested.
  basis: number
}

export interface StrategySnapshot {
  snapshot_ts: string
  total: number | null
  today: StrategyPeriodPnl | null
  this_week: StrategyPeriodPnl | null
  this_month: StrategyPeriodPnl | null
  this_quarter: StrategyPeriodPnl | null
  this_year: StrategyPeriodPnl | null
  last_order_placed_at: string | null
  last_trade_filled_at: string | null
}

export interface StrategyWithAccounts extends Strategy {
  accounts: StrategyAccount[]
  servers: StrategyServer[]
  snapshot: StrategySnapshot | null
}

export interface NewStrategyAccountInput extends AccountRef {
  assets: string[]
}

export interface NewStrategyServerInput {
  server: string
  label: string
  url: string
}

export interface NewStrategyInput {
  strategy_name: string
  tags: string[]
  active: boolean
  accounts: NewStrategyAccountInput[]
  servers: NewStrategyServerInput[]
}

export interface UpdateStrategyInput {
  id: number
  strategy_name: string
  active: boolean
  tags: string[]
  servers: NewStrategyServerInput[]
}

export function normalizeStrategyTags(tags: string[]) {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]
}

export function normalizeStrategyAssets(assets: string[]) {
  return [...new Set(assets.map(asset => asset.trim().toUpperCase()).filter(Boolean))]
}

export function strategyAccountAssetKey(account: AccountRef, asset: string | null) {
  return `${accountRefKey(account)}:${asset ?? ''}`
}
