<script setup lang="ts" generic="T extends string">
type Option = T | { label: string, value: T }

const props = defineProps<{
  items: Option[]
  placeholder: string
}>()

const model = defineModel<T[]>({ required: true })

// Nuxt UI cannot resolve its model type against a generic value, so the menu is
// bound to plain strings; the options only ever offer T values.
const selected = computed({
  get: () => model.value as string[],
  set: (value: string[]) => {
    model.value = value as T[]
  }
})

const options = computed<{ label: string, value: string }[]>(() => props.items.map(item =>
  typeof item === 'string' ? { label: item, value: item } : item
))

// Drop selections the options no longer offer, so a value that has left the
// list cannot keep filtering the table invisibly.
watch(options, (list) => {
  const offered = new Set(list.map(option => option.value))
  if (model.value.every(value => offered.has(value))) return
  model.value = model.value.filter(value => offered.has(value))
})
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="options"
    value-key="value"
    :placeholder="placeholder"
    multiple
    clear
  />
</template>
