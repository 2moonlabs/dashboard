export const CONNECTORS = ['bitstamp', 'coinbase', 'kraken', 'gemini', 'gate', 'woox'] as const

export type ConnectorId = typeof CONNECTORS[number]

export const TRANSFER_TYPES = ['deposit', 'withdraw', 'internal_transfer'] as const

export type TransferType = typeof TRANSFER_TYPES[number]

export interface AccountRef {
  connector: string
  account_user: string
  account_name: string
}

export interface Account extends AccountRef {
  account_type: string
}

export interface AccountTransfer {
  id: number
  ts: string
  transfer_type: TransferType
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

export interface NewAccountTransferInput {
  ts: string
  transfer_type: TransferType
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

export const CONNECTOR_OPTIONS = CONNECTORS.map(connector => ({
  label: connector,
  value: connector
}))

export const TRANSFER_TYPE_OPTIONS: { label: string, value: TransferType }[] = [
  { label: 'Deposit', value: 'deposit' },
  { label: 'Withdraw', value: 'withdraw' },
  { label: 'Internal transfer', value: 'internal_transfer' }
]

const CONNECTOR_ORDER: Record<string, number> = Object.fromEntries(
  CONNECTORS.map((connector, index) => [connector, index])
)

export function compareConnectors(a: string, b: string) {
  const rankA = CONNECTOR_ORDER[a] ?? Number.MAX_SAFE_INTEGER
  const rankB = CONNECTOR_ORDER[b] ?? Number.MAX_SAFE_INTEGER
  return rankA - rankB || a.localeCompare(b)
}

export function compareAccounts(a: Account, b: Account) {
  return compareConnectors(a.connector, b.connector)
    || a.account_user.localeCompare(b.account_user)
    || a.account_name.localeCompare(b.account_name)
}

export function accountRefKey(ref: AccountRef) {
  return JSON.stringify([ref.connector, ref.account_user, ref.account_name])
}

export function accountRefLabel(ref: AccountRef) {
  return `${ref.connector}.${ref.account_user}.${ref.account_name}`
}

export function transferSideLabel(transfer: AccountTransfer, side: 'from' | 'to') {
  const connector = transfer[`${side}_connector`]
  const accountUser = transfer[`${side}_account_user`]
  const accountName = transfer[`${side}_account_name`]

  if (!connector || !accountUser || !accountName) {
    return 'External'
  }

  return `${connector}.${accountUser}.${accountName}`
}

export function uniqueSortedConnectors(connectors: string[]) {
  return [...new Set(connectors)].sort(compareConnectors)
}
