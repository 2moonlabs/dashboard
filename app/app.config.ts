export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    table: {
      slots: {
        th: 'px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap',
        td: 'p-4 text-sm text-highlighted whitespace-nowrap [&:has([role=checkbox])]:pe-0'
      }
    }
  }
})
