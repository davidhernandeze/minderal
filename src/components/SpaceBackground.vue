<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'

interface Props {
  enabled?: boolean
  speed?: number // pixels per second base speed
  density?: number // stars per pixel (area scaled)
  opacity?: number // overall opacity of the layer
  color?: string // star color
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  speed: 0.05,
  density: 0.00008,
  opacity: 0.15,
  color: '#ffffff'
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let stars: { x: number; y: number; z: number; r: number }[] = []
let lastTs = 0
let width = 0
let height = 0

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const isTabHidden = ref(document.hidden)

const effectiveEnabled = computed(() => props.enabled && !prefersReducedMotion.matches)

function resize() {
  if (!canvasRef.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = canvasRef.value.clientWidth
  height = canvasRef.value.clientHeight
  canvasRef.value.width = Math.floor(width * dpr)
  canvasRef.value.height = Math.floor(height * dpr)
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seedStars()
}

function seedStars() {
  const area = width * height
  const count = Math.max(10, Math.floor(area * props.density))
  const cx = width / 2
  const cy = height / 2
  // z is depth factor: 0..1, closer to 0 = far, 1 = near
  stars = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * Math.max(width, height) * 0.5
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const z = Math.random() // depth
    const r = Math.max(0.3, 1.2 * z) // radius based on depth
    return { x, y, z, r }
  })
}

function step(ts: number) {
  if (!ctx || !canvasRef.value) return

  const dt = lastTs ? (ts - lastTs) / 1000 : 0
  lastTs = ts

  ctx.clearRect(0, 0, width, height)
  ctx.globalAlpha = props.opacity
  ctx.fillStyle = props.color

  const cx = width / 2
  const cy = height / 2
  const base = props.speed

  for (let s of stars) {
    // direction from center to star
    const dx = s.x - cx
    const dy = s.y - cy
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len

    // speed scales subtly with depth
    const v = base * (0.3 + s.z * 1.7)
    s.x += ux * v * dt * 60 // normalized for ~60fps
    s.y += uy * v * dt * 60

    // wrap around when out of bounds to keep density stable
    if (s.x < -20 || s.x > width + 20 || s.y < -20 || s.y > height + 20) {
      // respawn near center with small random offset to simulate continuous warp
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 10
      s.x = cx + Math.cos(a) * r
      s.y = cy + Math.sin(a) * r
      s.z = Math.random()
      s.r = Math.max(0.3, 1.2 * s.z)
    }

    // draw
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  rafId = requestAnimationFrame(step)
}

function start() {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  lastTs = 0
  resize()
  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(step)
}

function stop() {
  cancelAnimationFrame(rafId)
  rafId = 0
}

function handleVisibility() {
  isTabHidden.value = document.hidden
  if (document.hidden) {
    stop()
  } else if (effectiveEnabled.value) {
    start()
  }
}

onMounted(() => {
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', handleVisibility)

  if (effectiveEnabled.value && !isTabHidden.value) {
    start()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibility)
  stop()
})

watch(effectiveEnabled, (en) => {
  if (en && !isTabHidden.value) {
    start()
  } else {
    stop()
  }
})
</script>

<template>
  <!-- Full-screen, non-interactive canvas layer -->
  <canvas ref="canvasRef" class="fixed inset-0 w-screen h-screen pointer-events-none select-none" aria-hidden="true"></canvas>
</template>

<style scoped>
/************
 Subtle starfield layer
 - fixed so it stays as background
 - pointer-events: none so it never blocks clicks
************/
</style>
