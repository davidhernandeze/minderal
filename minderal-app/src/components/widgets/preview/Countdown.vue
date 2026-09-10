<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import moment from 'moment'
import CountdownWidget, { type CountdownContent } from '@/domain/widgets/CountdownWidget'

const { widget } = defineProps<{ widget: CountdownWidget }>()

// Build target date from widget content
const target = computed(() => {
  const c: CountdownContent = widget.getContent()
  if (c && c.year != null && c.month != null && c.day != null) {
    const m = moment().year(c.year).month(c.month).date(c.day)
    if (c.time) {
      const parsed = moment(c.time, 'HH:mm')
      m.hour(parsed.hour()).minute(parsed.minute()).second(0)
    } else {
      m.hour(0).minute(0).second(0)
    }
    return m
  }
  return null
})

const now = ref(moment())
let timer: number | null = null

onMounted(() => {
  // Tick every 1s; using setInterval is enough here
  timer = window.setInterval(() => {
    now.value = moment()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

const diffMs = computed(() => {
  if (!target.value) return null
  const ms = target.value.diff(now.value)
  return ms
})

const isPast = computed(() => (diffMs.value ?? 0) <= 0)

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

const parts = computed(() => {
  if (diffMs.value == null) return null
  let ms = Math.max(0, diffMs.value)
  const sec = Math.floor(ms / 1000)
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return { days, hours, minutes, seconds }
})
</script>

<template>
  <div class="countdown-wrapper">
    <div v-if="!target" class="placeholder">Set a target date in the widget form.</div>

    <div v-else-if="isPast" class="finished">The event has begun!</div>

    <div v-else class="time-grid">
      <div class="time-box">
        <div class="value">{{ parts!.days }}</div>
        <div class="label">Days</div>
      </div>
      <div class="time-box">
        <div class="value">{{ pad(parts!.hours) }}</div>
        <div class="label">Hours</div>
      </div>
      <div class="time-box">
        <div class="value">{{ pad(parts!.minutes) }}</div>
        <div class="label">Minutes</div>
      </div>
      <div class="time-box">
        <div class="value">{{ pad(parts!.seconds) }}</div>
        <div class="label">Seconds</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.countdown-wrapper {
  /* Let the widget panel control padding; make content center and responsive */
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.placeholder,
.finished {
  opacity: 0.8;
  font-size: clamp(0.9rem, 2.8vw, 1.4rem);
  text-align: center;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(0.5rem, 2vw, 1.25rem);
  width: 100%;
  align-items: stretch;
}

@container (max-width: 420px) {
  .time-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Fallback for environments without container queries */
@media (max-width: 460px) {
  .time-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.time-box {
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  align-items: center;
  justify-items: center;
  padding: 0.4rem;
  border-radius: 1rem;
  /* Remove blur to avoid ghosting/overlap artifacts with layered backgrounds */
  border: 1px solid rgba(127, 127, 127, 0.35);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.value {
  font-variant-numeric: tabular-nums;
  line-height: 1;
  /* Auto-scale with container width; keeps big digits without overflow */
  font-size: 1.2rem;
  font-weight: 700;
}

.label {
  margin-top: 0.35rem;
  opacity: 0.8;
  letter-spacing: 0.06em;
  font-size: 0.5rem;
  text-transform: uppercase;
}
</style>
