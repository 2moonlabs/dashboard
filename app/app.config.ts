export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    table: {
      slots: {
        td: 'p-4 text-sm text-highlighted whitespace-nowrap [&:has([role=checkbox])]:pe-0'
      }
    }
  }
})
