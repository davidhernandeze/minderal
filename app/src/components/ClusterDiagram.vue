<script setup lang="ts">
import type { ClusterNode, LinkQuality } from '@minderal/core'
import { computed } from 'vue'
import NodeCard from './NodeCard.vue'

const props = defineProps<{
  nodes: readonly ClusterNode[]
  selfId: string
  quality: (nodeId: string) => LinkQuality | undefined
  isOnline: (nodeId: string) => boolean
  onlineSince: (nodeId: string) => string | undefined
}>()

interface Placed {
  readonly node: ClusterNode
  readonly x: number
  readonly y: number
}

/** The orchestrator in the middle, everyone else around it, this node first so it sits at the bottom. */
const placed = computed<Placed[]>(() => {
  const center = props.nodes.find((node) => node.role === 'orchestrator')
  const around = props.nodes
    .filter((node) => node !== center)
    .sort((a, b) => Number(b.id === props.selfId) - Number(a.id === props.selfId))
  const result: Placed[] = center === undefined ? [] : [{ node: center, x: 50, y: 50 }]
  around.forEach((node, index) => {
    const angle = Math.PI / 2 + (2 * Math.PI * index) / Math.max(around.length, 1)
    result.push({ node, x: 50 + 36 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) })
  })
  return result
})

const center = computed(() => placed.value.find(({ node }) => node.role === 'orchestrator'))
const self = computed(() => placed.value.find(({ node }) => node.id === props.selfId))

/** Members sync with the orchestrator. */
const syncLinks = computed(() =>
  center.value === undefined ? [] : placed.value.filter((entry) => entry !== center.value).map((entry) => ({ from: entry, to: center.value! })),
)

/** What this node has measured, talking to other nodes. */
const measured = computed(() =>
  self.value === undefined
    ? []
    : placed.value
        .filter((entry) => entry !== self.value)
        .map((entry) => ({ to: entry, quality: props.quality(entry.node.id) }))
        .filter((link): link is { to: Placed; quality: LinkQuality } => link.quality !== undefined),
)

function failing(quality: LinkQuality): boolean {
  return quality.lastFailureAt !== undefined && (quality.lastSuccessAt === undefined || quality.lastFailureAt > quality.lastSuccessAt)
}
</script>

<template>
  <section class="diagram" :style="{ minHeight: `${Math.max(680, 260 + nodes.length * 100)}px` }">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line
        v-for="link in syncLinks"
        :key="`sync-${link.from.node.id}`"
        class="sync"
        :class="{ live: isOnline(link.from.node.id) && isOnline(link.to.node.id) }"
        :x1="link.from.x"
        :y1="link.from.y"
        :x2="link.to.x"
        :y2="link.to.y"
      />
      <line
        v-for="link in measured"
        :key="`measured-${link.to.node.id}`"
        class="measured"
        :class="{ failing: failing(link.quality) }"
        :x1="self!.x"
        :y1="self!.y"
        :x2="link.to.x"
        :y2="link.to.y"
      />
    </svg>
    <span
      v-for="link in measured"
      :key="`label-${link.to.node.id}`"
      class="label"
      :class="{ failing: failing(link.quality) }"
      :style="{ left: `${(self!.x + link.to.x) / 2}%`, top: `${(self!.y + link.to.y) / 2}%` }"
    >
      {{ failing(link.quality) ? 'failing' : `${Math.round(link.quality.latencyMs ?? 0)} ms` }}
    </span>
    <div v-for="entry in placed" :key="entry.node.id" class="slot" :style="{ left: `${entry.x}%`, top: `${entry.y}%` }">
      <NodeCard
        :node="entry.node"
        :is-self="entry.node.id === selfId"
        :quality="quality(entry.node.id)"
        :online="isOnline(entry.node.id)"
        :since="onlineSince(entry.node.id)"
      />
    </div>
    <p class="legend">
      <span><i class="sync" /> channel to the orchestrator (darker while both are online)</span>
      <span><i class="measured" /> link this node measured</span>
    </p>
  </section>
</template>

<style scoped>
.diagram {
  position: relative;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--canvas);
  overflow: hidden;
}
svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
line {
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
}
line.sync {
  stroke: var(--border);
  stroke-width: 1.5;
  stroke-dasharray: 6 6;
}
line.sync.live {
  stroke: var(--border-strong);
}
line.measured {
  stroke: var(--accent);
  stroke-width: 2.5;
}
line.measured.failing {
  stroke: var(--danger);
}
.slot {
  position: absolute;
  transform: translate(-50%, -50%);
}
.label {
  position: absolute;
  transform: translate(-50%, -50%);
  background: var(--surface);
  border: 1px solid var(--accent);
  color: var(--accent);
  border-radius: 999px;
  padding: 1px 8px;
  font: 11px var(--mono);
}
.label.failing {
  border-color: var(--danger);
  color: var(--danger);
}
.legend {
  position: absolute;
  left: 12px;
  top: 10px;
  margin: 0;
  display: flex;
  gap: 16px;
  color: var(--muted);
  font-size: 11px;
}
.legend i {
  display: inline-block;
  width: 22px;
  vertical-align: middle;
  border-top: 2px dashed var(--border-strong);
}
.legend i.measured {
  border-top: 2px solid var(--accent);
}
@media (max-width: 760px) {
  .diagram {
    min-height: 0 !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 12px;
  }
  svg,
  .label,
  .legend {
    display: none;
  }
  .slot {
    position: static;
    transform: none;
  }
}
</style>
