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
const maxVisibleScatterPoints = 300
const dayMs = 24 * 60 * 60 * 1000

type ChartMode = 'rate' | 'cumulative'
type Point = { time: Date, rate: number }

const chartMode = ref<ChartMode>('rate')
const chartModeOptions: { label: string, value: ChartMode }[] = [
  { label: 'Funding Rate', value: 'rate' },
  { label: 'Cumulative Rate', value: 'cumulative' }
]

const points = computed(() =>
  [...props.data]
    .map(d => ({ time: new Date(d.funding_time), rate: d.funding_rate }))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
)

const cumulativePoints = computed<Point[]>(() => {
  let cumulative = 0

  return points.value.map((point) => {
    cumulative += point.rate
    return { time: point.time, rate: cumulative }
  })
})

const chartPoints = computed(() => chartMode.value === 'cumulative' ? cumulativePoints.value : points.value)

const x = (_: Point, i: number) => i
const y = (d: Point) => d.rate
const zeroY = () => 0

const formatPercent = (v: number) => `${(v * 100).toFixed(6)}%`

const formatPercentShort = (v: number) => {
  if (v === 0) return '0%'
  const pct = v * 100
  const abs = Math.abs(pct)
  const decimals = abs >= 1 ? 2 : abs >= 0.1 ? 3 : abs >= 0.01 ? 4 : 5
  return `${pct.toFixed(decimals).replace(/\.?0+$/, '')}%`
}

const formatTickDate = (d: Date) => format(d, 'MM-dd HH:mm')
const formatFullDate = (d: Date) => format(d, 'yyyy-MM-dd HH:mm')

const xTicks = (i: number) => {
  const p = chartPoints.value[i]
  if (!p) return ''
  const len = chartPoints.value.length
  const step = Math.max(1, Math.floor(len / 8))
  if (i === 0 || i === len - 1 || i % step === 0) {
    return formatTickDate(p.time)
  }
  return ''
}

const yTicks = (v: number) => formatPercentShort(v)
const tooltipTemplate = (d: Point) => `${formatFullDate(d.time)}\n${formatPercent(d.rate)}`

const latest = computed(() => points.value[points.value.length - 1])
const annualized = computed(() => {
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const cumulative = cumulativePoints.value[cumulativePoints.value.length - 1]?.rate

  if (!first || !last || cumulative === undefined) return null

  const elapsedDays = (last.time.getTime() - first.time.getTime()) / dayMs
  if (elapsedDays <= 0) return null

  const base = 1 + cumulative
  if (base <= 0) return null

  const value = base ** (365 / elapsedDays) - 1
  return Number.isFinite(value) ? value : null
})

const showScatter = computed(() => chartPoints.value.length <= maxVisibleScatterPoints)
const latestClass = computed(() => {
  const rate = latest.value?.rate ?? 0
  if (rate > 0) return 'text-success'
  if (rate < 0) return 'text-error'
  return 'text-highlighted'
})
const annualizedClass = computed(() => {
  const rate = annualized.value ?? 0
  if (rate > 0) return 'text-success'
  if (rate < 0) return 'text-error'
  return 'text-highlighted'
})
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', header: 'p-4!', body: 'px-0! pt-0! pb-3!' }">
    <template #header>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex w-fit shrink-0 rounded-md border border-default p-0.5">
          <button
            v-for="option in chartModeOptions"
            :key="option.value"
            type="button"
            class="rounded px-2 py-1 text-sm font-medium transition"
            :class="chartMode === option.value ? 'bg-primary/12 text-primary' : 'text-muted hover:text-highlighted'"
            :aria-pressed="chartMode === option.value"
            @click="chartMode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div
          v-if="latest"
          class="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium tabular-nums sm:justify-end"
        >
          <p class="whitespace-nowrap">
            <span class="text-muted">Latest: </span>
            <span :class="latestClass">{{ formatPercent(latest.rate) }}</span>
          </p>
          <p class="whitespace-nowrap">
            <span class="text-muted">Annualized: </span>
            <span :class="annualizedClass">{{ annualized === null ? '--' : formatPercent(annualized) }}</span>
          </p>
        </div>
      </div>
    </template>

    <div class="h-96 relative">
      <ClientOnly>
        <VisXYContainer
          v-if="chartPoints.length"
          :data="chartPoints"
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
            v-if="showScatter"
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
            :x="x"
            :y="y"
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
        v-if="loading && chartPoints.length"
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
  --vis-axis-tick-label-color: var(--ui-text-muted);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
