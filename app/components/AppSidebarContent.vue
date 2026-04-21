<script setup lang="ts">
const emit = defineEmits<{
  navigate: []
}>()

const route = useRoute()
const colorMode = useColorMode()
const supabase = useSupabaseClient()
const toast = useToast()
const colorModeReady = ref(false)

const primaryLinks = [
  {
    label: 'Overview',
    icon: 'i-lucide-chart-no-axes-column-increasing',
    to: '/'
  },
  {
    label: 'Accounts',
    icon: 'i-lucide-wallet',
    to: '/accounts'
  },
  {
    label: 'Strategies',
    icon: 'i-lucide-layers',
    to: '/strategies'
  }
]

const fundingLinks = [
  { label: 'History', to: '/funding-rate/history' },
  { label: 'Arbitrage', to: '/funding-rate/arbitrage' }
]

const fundingOpen = ref(route.path.startsWith('/funding-rate/'))

watch(() => route.path, (path) => {
  if (path.startsWith('/funding-rate/')) {
    fundingOpen.value = true
  }
})

onMounted(() => {
  colorModeReady.value = true
})

function isActive(path: string) {
  return route.path === path
}

function isFundingActive() {
  return route.path.startsWith('/funding-rate/')
}

function linkClass(path: string) {
  return isActive(path)
    ? 'bg-elevated text-primary'
    : 'text-muted hover:bg-elevated hover:text-highlighted'
}

function navigate() {
  emit('navigate')
}

function setColorMode(mode: 'light' | 'dark') {
  colorMode.preference = mode
}

async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    toast.add({ title: 'Logout failed', description: error.message, color: 'error' })
    return
  }

  emit('navigate')
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-b border-default px-4 py-4">
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
        @click="navigate"
      >
        <UIcon
          name="i-simple-icons-nuxtdotjs"
          class="size-6 shrink-0 text-primary"
        />
        <div class="min-w-0">
          <p class="truncate text-base font-semibold tracking-tight text-highlighted">
            Trading Dashboard
          </p>
        </div>
      </NuxtLink>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4">
      <div class="space-y-1">
        <NuxtLink
          v-for="link in primaryLinks"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition"
          :class="linkClass(link.to)"
          @click="navigate"
        >
          <UIcon
            :name="link.icon"
            class="size-4 shrink-0"
          />
          <span>{{ link.label }}</span>
        </NuxtLink>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition"
          :class="isFundingActive() ? 'text-primary' : 'text-muted hover:bg-elevated hover:text-highlighted'"
          @click="fundingOpen = !fundingOpen"
        >
          <UIcon
            name="i-lucide-trending-up-down"
            class="size-4 shrink-0"
          />
          <span class="flex-1">Funding Rate</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 shrink-0 transition"
            :class="fundingOpen ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-show="fundingOpen"
          class="space-y-1"
        >
          <NuxtLink
            v-for="link in fundingLinks"
            :key="link.to"
            :to="link.to"
            class="ml-7 flex items-center rounded-md px-3 py-2 text-sm transition"
            :class="linkClass(link.to)"
            @click="navigate"
          >
            <span>{{ link.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <div class="border-t border-default px-4 py-4">
      <div class="flex items-center gap-2">
        <div class="relative flex shrink-0 rounded-md border border-default p-0.5">
          <div
            class="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded bg-primary/12 transition-transform duration-200 ease-out"
            :class="colorModeReady && colorMode.value === 'dark' ? 'translate-x-full' : ''"
          />
          <button
            type="button"
            class="relative z-10 flex size-8 items-center justify-center rounded transition"
            :class="colorModeReady && colorMode.value === 'light' ? 'text-primary' : 'text-muted hover:text-highlighted'"
            aria-label="Switch to light mode"
            title="Light mode"
            @click="setColorMode('light')"
          >
            <UIcon
              name="i-lucide-sun"
              class="size-4 shrink-0"
            />
          </button>
          <button
            type="button"
            class="relative z-10 flex size-8 items-center justify-center rounded transition"
            :class="colorModeReady && colorMode.value === 'dark' ? 'text-primary' : 'text-muted hover:text-highlighted'"
            aria-label="Switch to dark mode"
            title="Dark mode"
            @click="setColorMode('dark')"
          >
            <UIcon
              name="i-lucide-moon"
              class="size-4 shrink-0"
            />
          </button>
        </div>

        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-md border border-default px-3 py-2 text-sm text-muted transition hover:text-highlighted"
          @click="logout"
        >
          <UIcon
            name="i-lucide-log-out"
            class="size-4 shrink-0"
          />
          <span>Log out</span>
        </button>
      </div>
    </div>
  </div>
</template>
