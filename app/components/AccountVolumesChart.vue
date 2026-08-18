<script setup lang="ts">
import { VisAxis, VisCrosshair, VisLine, VisScatter, VisTooltip, VisXYContainer } from '@unovis/vue'
import type { AccountVolumeHistoryPoint } from '~/types/accounts'

const props = defineProps<{
  data: AccountVolumeHistoryPoint[]
  loading?: boolean
}>()

type ChartPoint = {
  time: Date
  spotVolume: number | null
  futuresVolume: number | null
}

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')
const { width } = useElementSize(cardRef)
const maxVisibleScatterPoints = 300
const spotColor = 'var(--ui-primary)'
const futuresColor = 'var(--ui-success)'
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2
})
const fullNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
})

const points = computed<ChartPoint[]>(() =>
  props.data
    .map(row => ({
      time: new Date(row.snapshot_ts),
      spotVolume: row.spot_volume_30d,
      futuresVolume: row.futures_volume_30d
    }))
    .filter(point => Number.isFinite(point.time.getTime()))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
)

const latest = computed(() => points.value[points.value.length - 1])
const hasChartData = computed(() => points.value.some(
  point => point.spotVolume !== null || point.futuresVolume !== null
))
const showScatter = computed(() => points.value.length <= maxVisibleScatterPoints)
const x = (point: ChartPoint) => point.time.getTime()
const spotY = (point: ChartPoint) => point.spotVolume ?? undefined
const futuresY = (point: ChartPoint) => point.futuresVolume ?? undefined

function formatVolume(value: number | null, compact = false) {
  if (value === null) return '-'
  return (compact ? compactNumberFormatter : fullNumberFormatter).format(value)
}

function formatUtcDateTime(date: Date) {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function formatUtcTick(value: number) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toISOString().slice(5, 16).replace('T', ' ')
}

const yTicks = (value: number) => formatVolume(value, true)
const tooltipTemplate = (point: ChartPoint) => `<div>${formatUtcDateTime(point.time)}</div><div>Spot: ${formatVolume(point.spotVolume)}&nbsp;&nbsp; Futures: ${formatVolume(point.futuresVolume)}</div>`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', header: 'p-4!', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-primary" />
            <span class="text-muted">Spot</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-success" />
            <span class="text-muted">Futures</span>
          </span>
        </div>
        <div v-if="latest" class="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums sm:justify-end">
          <p class="whitespace-nowrap">
            <span class="text-muted">Spot: </span>
            <span class="font-medium text-highlighted">{{ formatVolume(latest.spotVolume) }}</span>
          </p>
          <p class="whitespace-nowrap">
            <span class="text-muted">Futures: </span>
            <span class="font-medium text-highlighted">{{ formatVolume(latest.futuresVolume) }}</span>
          </p>
        </div>
      </div>
    </template>

    <div class="relative h-96">
      <ClientOnly>
        <VisXYContainer
          v-if="hasChartData"
          :data="points"
          :padding="{ top: 24, right: 16, bottom: 8, left: 16 }"
          :width="width"
          aria-label="Rolling 30-day spot and futures volume history"
          class="h-96"
        >
          <VisLine
            :x="x"
            :y="spotY"
            :color="spotColor"
          />
          <VisLine
            :x="x"
            :y="futuresY"
            :color="futuresColor"
          />
          <VisScatter
            v-if="showScatter"
            :x="x"
            :y="spotY"
            :size="4"
            :color="spotColor"
          />
          <VisScatter
            v-if="showScatter"
            :x="x"
            :y="futuresY"
            :size="4"
            :color="futuresColor"
          />
          <VisAxis
            type="x"
            :x="x"
            :tick-format="formatUtcTick"
          />
          <VisAxis
            type="y"
            :tick-format="yTicks"
          />
          <VisCrosshair
            :x="x"
            :y="[spotY, futuresY]"
            :color="[spotColor, futuresColor]"
            :template="tooltipTemplate"
          />
          <VisTooltip />
        </VisXYContainer>
        <div
          v-else-if="loading"
          class="flex h-96 items-center justify-center text-muted"
        >
          <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
        </div>
        <div
          v-else
          class="flex h-96 items-center justify-center text-sm text-muted"
        >
          No volume history for this account and range.
        </div>
        <template #fallback>
          <div class="h-96" />
        </template>
      </ClientOnly>

      <div
        v-if="loading && hasChartData"
        class="pointer-events-none absolute inset-0 flex items-center justify-center bg-default/60"
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
  --vis-axis-tick-label-color: var(--ui-text-muted);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
