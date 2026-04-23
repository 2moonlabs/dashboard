declare global {
  interface Window {
    va?: (...args: unknown[]) => void
    vaq?: unknown[][]
  }
}

function toRoutePattern(path: string, params: Record<string, string | string[]>): string {
  let route = path
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const matched = `/${value.join('/')}`
      if (route.includes(matched)) {
        route = route.replace(matched, `/[...${key}]`)
      }
      continue
    }
    const matched = `/${value}`
    if (route.includes(matched)) {
      route = route.replace(matched, `/[${key}]`)
    }
  }
  return route
}

export default defineNuxtPlugin(() => {
  if (import.meta.dev) return

  const router = useRouter()

  const rawBase = import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH as string | undefined
  const basePath = rawBase
    ? (rawBase.startsWith('/') ? rawBase : `/${rawBase}`).replace(/\/$/, '')
    : undefined
  const scriptSrc = basePath ? `${basePath}/insights/script.js` : '/_vercel/insights/script.js'
  const endpoint = basePath ? `${basePath}/insights` : undefined

  window.va = window.va || function (...args: unknown[]) {
    (window.vaq = window.vaq || []).push(args)
  }

  onNuxtReady(() => {
    if (!document.getElementById('vercel-analytics')) {
      const script = document.createElement('script')
      script.id = 'vercel-analytics'
      script.defer = true
      script.src = scriptSrc
      script.dataset.disableAutoTrack = '1'
      if (endpoint) script.dataset.endpoint = endpoint
      document.head.appendChild(script)
    }

    const current = router.currentRoute.value
    window.va!('pageview', {
      route: toRoutePattern(current.path, current.params as Record<string, string | string[]>),
      path: current.path
    })
  })

  router.afterEach((to) => {
    window.va!('pageview', {
      route: toRoutePattern(to.path, to.params as Record<string, string | string[]>),
      path: to.path
    })
  })
})
