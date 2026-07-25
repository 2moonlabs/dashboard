type TableSlot = 'tbody' | 'tr' | 'th' | 'td'

/**
 * Shared UTable look: compact rows, faint dividers, hover highlight.
 * Slot classes are appended, so conflicting utilities are resolved by
 * tailwind-merge with the caller's value winning.
 */
const baseUi: Record<TableSlot, string> = {
  tbody: 'divide-default/40',
  tr: 'transition-colors hover:bg-elevated/40',
  th: 'text-xs whitespace-nowrap py-2.5',
  td: 'align-middle text-xs px-4 py-2'
}

export function tableUi(extra: Partial<Record<TableSlot, string>> = {}) {
  const ui = { ...baseUi }

  for (const [slot, className] of Object.entries(extra) as [TableSlot, string][]) {
    ui[slot] = `${ui[slot]} ${className}`
  }

  return ui
}

/** Denser variant for tables nested inside an expanded row. */
export function nestedTableUi() {
  return {
    th: 'px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted whitespace-nowrap',
    td: 'px-3 py-1.5 text-xs text-highlighted whitespace-nowrap'
  }
}
