<script setup lang="ts">
import { format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisCrosshair, VisTooltip, VisScatter } from '@unovis/vue'
import type { FundingRate } from '~/types'

const props = defineProps<{
  data: FundingRate[]
  loading?: boolean
}>()

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)

const points = computed(() =>
  [...props.data]
    .map(d => ({ time: new Date(d.funding_time), rate: d.funding_rate }))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
)

type Point = { time: Date, rate: number }

const x = (_: Point, i: number) => i
const y = (d: Point) => d.rate
const zeroY = () => 0

const formatPercent = (v: number) => `${(v * 100).toFixed(6)}%`
const formatShortDate = (d: Date) => format(d, 'MM-dd')
const formatFullDate = (d: Date) => format(d, 'yyyy-MM-dd HH:mm')

const xTicks = (i: number) => {
  const p = points.value[i]
  if (!p) return ''
  const len = points.value.length
  const step = Math.max(1, Math.floor(len / 8))
  if (i === 0 || i === len - 1 || i % step === 0) {
    return formatShortDate(p.time)
  }
  return ''
}

const yTicks = (v: number) => formatPercent(v)
const tooltipTemplate = (d: Point) => `${formatFullDate(d.time)}\n${formatPercent(d.rate)}`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex items-baseline justify-between">
        <p class="text-xs text-muted uppercase">
          Funding Rate
        </p>
        <p
          v-if="points.length"
          class="text-sm text-highlighted font-medium"
        >
          Latest: {{ formatPercent(points[points.length - 1]!.rate) }}
        </p>
      </div>
    </template>

    <div class="h-96 relative">
      <ClientOnly>
        <VisXYContainer
          v-if="points.length"
          :data="points"
          :padding="{ top: 24, right: 16, bottom: 8, left: 16 }"
          class="h-96"
          :width="width"
        >
          <VisLine
            :x="x"
            :y="zeroY"
            color="var(--ui-text-dimmed)"
            :line-width="1"
            :line-dash-array="[4, 4]"
          />
          <VisLine
            :x="x"
            :y="y"
            color="var(--ui-primary)"
          />
          <VisScatter
            :x="x"
            :y="y"
            :size="4"
            color="var(--ui-primary)"
          />
          <VisAxis
            type="x"
            :x="x"
            :tick-format="xTicks"
          />
          <VisAxis
            type="y"
            :tick-format="yTicks"
          />
          <VisCrosshair
            color="var(--ui-primary)"
            :template="tooltipTemplate"
          />
          <VisTooltip />
        </VisXYContainer>
        <div
          v-else-if="loading"
          class="h-96 flex items-center justify-center text-muted"
        >
          <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
        </div>
        <div
          v-else
          class="h-96 flex items-center justify-center text-muted text-sm"
        >
          No data for this symbol.
        </div>
        <template #fallback>
          <div class="h-96" />
        </template>
      </ClientOnly>

      <div
        v-if="loading && points.length"
        class="absolute inset-0 flex items-center justify-center bg-default/60 pointer-events-none"
      >
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
      </div>
    </div>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
