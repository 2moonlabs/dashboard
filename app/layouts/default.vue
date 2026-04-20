<script setup lang="ts">
const drawerOpen = ref(false)
const route = useRoute()

const closeDrawer = () => {
  drawerOpen.value = false
}

watch(() => route.fullPath, closeDrawer)
</script>

<template>
  <div class="min-h-screen bg-default lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
    <aside class="hidden border-r border-default bg-elevated/25 lg:block">
      <AppSidebarContent class="sticky top-0 h-screen" />
    </aside>

    <div class="min-w-0">
      <header class="border-b border-default bg-default/90 backdrop-blur lg:hidden">
        <div class="flex items-center justify-between px-4 py-3 sm:px-6">
          <NuxtLink
            to="/"
            class="flex items-center gap-2"
          >
            <UIcon
              name="i-simple-icons-nuxtdotjs"
              class="size-5 shrink-0 text-primary"
            />
            <span class="text-sm font-semibold tracking-tight text-highlighted">
              Trading Dashboard
            </span>
          </NuxtLink>

          <USlideover
            v-model:open="drawerOpen"
            side="left"
            title="Navigation"
            :close="false"
            :ui="{
              content: 'p-0 max-w-[85vw] sm:max-w-72',
              body: 'p-0'
            }"
          >
            <template #default>
              <button
                type="button"
                class="flex items-center justify-center rounded-md border border-default p-2 text-muted transition hover:text-highlighted"
                aria-label="Open navigation"
              >
                <UIcon
                  name="i-lucide-menu"
                  class="size-5 shrink-0"
                />
              </button>
            </template>

            <template #content="{ close }">
              <div class="h-[100dvh] w-72 max-w-[85vw] border-r border-default bg-default shadow-xl">
                <AppSidebarContent @navigate="close" />
              </div>
            </template>
          </USlideover>
        </div>
      </header>

      <main class="px-4 py-4 sm:px-6 lg:px-8">
        <div class="mx-auto w-full max-w-7xl">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
