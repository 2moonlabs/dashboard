/** An empty selection is no filter; otherwise any of `values` must be selected. */
export function matchesFilter(selected: readonly string[], ...values: (string | null)[]) {
  return !selected.length || values.some(value => value !== null && selected.includes(value))
}
