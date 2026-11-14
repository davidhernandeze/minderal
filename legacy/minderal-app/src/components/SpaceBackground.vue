<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue'

interface Props {
  enabled?: boolean
  speed?: number
  density?: number
  opacity?: number
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true,
  speed: 0.05,
  density: 0.00008,
  opacity: 1
})

interface Star {
  x: number
  y: number
  px: number // previous x for trail
  py: number // previous y for trail
  z: number // depth 0=far/blue, 1=near/white
  r: number
  twinkle: number // twinkle phase offset
  twinkleSpeed: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  life: number // remaining life 0..1
  len: number // trail length in px
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let stars: Star[] = []
let shootingStars: ShootingStar[] = []
let lastTs = 0
let width = 0
let height = 0
let shootingStarTimer = 0
const SHOOTING_STAR_INTERVAL = 5 // seconds between spawns

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const isTabHidden = ref(document.hidden)
const effectiveEnabled = computed(() => props.enabled && !prefersReducedMotion.matches)

// Depth-based color: far=cold blue, mid=white, near=warm white-yellow
function starRgb(z: number): [number, number, number] {
  if (z < 0.35) return [120, 160, 255] // cold blue
  if (z < 0.65) return [200, 215, 255] // cool white
  return [255, 250, 220] // warm white-yellow
}

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
  // Max distance from center to corner — stars born here are about to leave
  const maxDist = Math.hypot(cx, cy)

  stars = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    // Bias toward center so the tunnel feels deep: sqrt gives denser center
    const radius = Math.pow(Math.random(), 0.6) * maxDist
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    // z mirrors how far the star has already "traveled" outward —
    // this matches the steady-state the animation converges to, eliminating the initial burst
    const z = Math.min(1, radius / (maxDist * 0.85))
    return {
      x, y,
      px: x, py: y,
      z,
      r: Math.max(0.2, 1.4 * z),
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 1.5
    }
  })
}

function spawnShootingStar() {
  // Enter from a random edge
  const edge = Math.floor(Math.random() * 4)
  let x = 0, y = 0
  if (edge === 0) { x = Math.random() * width; y = -10 }
  else if (edge === 1) { x = width + 10; y = Math.random() * height }
  else if (edge === 2) { x = Math.random() * width; y = height + 10 }
  else { x = -10; y = Math.random() * height }

  const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.25 + (edge * Math.PI * 0.5)
  const speed = 350 + Math.random() * 250
  shootingStars.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1,
    len: 80 + Math.random() * 120
  })
}

function step(ts: number) {
  if (!ctx || !canvasRef.value) return

  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.032) : 0.016
  lastTs = ts

  ctx.clearRect(0, 0, width, height)

  const cx = width / 2
  const cy = height / 2
  const base = props.speed
  const now = ts / 1000

  // ── Warp stars ──────────────────────────────────────────────
  for (const s of stars) {
    const dx = s.x - cx
    const dy = s.y - cy
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len

    const v = base * (0.3 + s.z * 1.7)
    const move = v * dt * 60

    // Store previous position for trail
    s.px = s.x
    s.py = s.y
    s.x += ux * move
    s.y += uy * move

    // Respawn from center when out of bounds
    if (s.x < -20 || s.x > width + 20 || s.y < -20 || s.y > height + 20) {
      const a = Math.random() * Math.PI * 2
      const offset = Math.random() * 8
      s.x = cx + Math.cos(a) * offset
      s.y = cy + Math.sin(a) * offset
      s.px = s.x
      s.py = s.y
      s.z = Math.random()
      s.r = Math.max(0.3, 1.4 * s.z)
      s.twinkle = Math.random() * Math.PI * 2
    }

    const [r, g, b] = starRgb(s.z)

    // Twinkle: only near stars twinkle noticeably
    const twinkleFactor = s.z > 0.6 ? 0.15 * Math.sin(now * s.twinkleSpeed * Math.PI * 2 + s.twinkle) : 0
    const baseAlpha = 0.25 + s.z * 0.65
    const alpha = Math.max(0.05, Math.min(1, baseAlpha + twinkleFactor)) * props.opacity

    // Trail — length proportional to speed and depth
    const trailLen = Math.hypot(s.x - s.px, s.y - s.py)
    if (trailLen > 0.5 && s.z > 0.15) {
      const grad = ctx.createLinearGradient(s.px, s.py, s.x, s.y)
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`)
      grad.addColorStop(1, `rgba(${r},${g},${b},${alpha * 0.6})`)
      ctx.beginPath()
      ctx.moveTo(s.px, s.py)
      ctx.lineTo(s.x, s.y)
      ctx.strokeStyle = grad
      ctx.lineWidth = s.r * 0.9
      ctx.stroke()
    }

    // Star head dot
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
    ctx.fill()

    // Glow for bright near stars
    if (s.z > 0.75) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.08})`
      ctx.fill()
    }
  }

  // ── Shooting stars ────────────────────────────────────────────
  shootingStarTimer += dt
  if (shootingStarTimer >= SHOOTING_STAR_INTERVAL + Math.random() * 3) {
    shootingStarTimer = 0
    spawnShootingStar()
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const ss = shootingStars[i]
    ss.x += ss.vx * dt
    ss.y += ss.vy * dt
    ss.life -= dt * 1.2

    if (ss.life <= 0 || ss.x < -200 || ss.x > width + 200 || ss.y < -200 || ss.y > height + 200) {
      shootingStars.splice(i, 1)
      continue
    }

    const alpha = ss.life * 0.9 * props.opacity
    const tailX = ss.x - (ss.vx / Math.hypot(ss.vx, ss.vy)) * ss.len
    const tailY = ss.y - (ss.vy / Math.hypot(ss.vx, ss.vy)) * ss.len

    const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y)
    grad.addColorStop(0, `rgba(200,220,255,0)`)
    grad.addColorStop(0.6, `rgba(220,235,255,${alpha * 0.4})`)
    grad.addColorStop(1, `rgba(255,255,255,${alpha})`)

    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(ss.x, ss.y)
    ctx.strokeStyle = grad
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Bright head
    ctx.beginPath()
    ctx.arc(ss.x, ss.y, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    ctx.fill()
  }

  rafId = requestAnimationFrame(step)
}

function start() {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  if (!ctx) return
  lastTs = 0
  shootingStarTimer = SHOOTING_STAR_INTERVAL * 0.6 // first one comes sooner
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
  if (document.hidden) stop()
  else if (effectiveEnabled.value) start()
}

onMounted(() => {
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', handleVisibility)
  if (effectiveEnabled.value && !isTabHidden.value) start()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibility)
  stop()
})

watch(effectiveEnabled, (en) => {
  if (en && !isTabHidden.value) start()
  else stop()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="fixed inset-0 w-screen h-screen pointer-events-none select-none"
    aria-hidden="true"
  />
</template>
