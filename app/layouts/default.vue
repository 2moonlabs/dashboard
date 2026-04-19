<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)

const close = () => {
  open.value = false
}

const links = [[
  {
    label: 'Overview',
    icon: 'i-lucide-chart-no-axes-column-increasing',
    to: '/',
    exact: true,
    onSelect: close
  },
  {
    label: 'Accounts',
    icon: 'i-lucide-wallet',
    to: '/accounts',
    onSelect: close
  },
  {
    label: 'Strategies',
    icon: 'i-lucide-layers',
    to: '/strategies',
    onSelect: close
  },
  {
    label: 'Funding Rate',
    icon: 'i-lucide-line-chart',
    defaultOpen: true,
    type: 'trigger',
    children: [
      {
        label: 'History',
        to: '/funding-rate/history',
        onSelect: close
      },
      {
        label: 'Arbitrage',
        to: '/funding-rate/arbitrage',
        onSelect: close
      }
    ]
  }
]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 px-2 py-1.5"
          :class="collapsed ? 'justify-center' : ''"
        >
          <UIcon
            name="i-simple-icons-nuxtdotjs"
            class="size-6 text-primary shrink-0"
          />
          <span
            v-if="!collapsed"
            class="text-base font-semibold text-highlighted tracking-tight"
          >
            Trading Dashboard
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
