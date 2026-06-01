import type { AccountRef } from './accounts'
import { accountRefKey } from './accounts'

export interface Strategy {
  id: number
  strategy_name: string
  server: string | null
  url: string | null
  tags: string[]
  active: boolean
}

export interface StrategyAccount extends AccountRef {
  id: number
  strategy_id: number
  asset: string | null
}

export interface StrategySnapshot {
  snapshot_ts: string
  total: number
  today: number | null
  this_week: number | null
  this_month: number | null
  last_order_placed_at: string | null
  last_trade_filled_at: string | null
}

export interface StrategyWithAccounts extends Strategy {
  accounts: StrategyAccount[]
  snapshot: StrategySnapshot | null
}

export interface NewStrategyAccountInput extends AccountRef {
  assets: string[]
}

export interface NewStrategyInput {
  strategy_name: string
  server: string | null
  url: string | null
  tags: string[]
  active: boolean
  accounts: NewStrategyAccountInput[]
}

export interface UpdateStrategyInput {
  id: number
  active: boolean
  tags: string[]
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
