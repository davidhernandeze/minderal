<script setup lang="ts">
import type { ClusterNode, LinkQuality, NodeSeq } from '@minderal/core'
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  node: ClusterNode
  isSelf: boolean
  quality: LinkQuality | undefined
  online: boolean
  since: string | undefined
  seq: NodeSeq | undefined
}>()

const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => clearInterval(clock))

/** CouchDB seqs are long opaque strings starting with the change count; local ones are plain numbers. */
const seqLabel = computed(() => {
  const seq = props.seq?.seq
  if (seq === undefined) return undefined
  return typeof seq === 'number' ? String(seq) : (seq.split('-')[0] ?? seq)
})
const changedAgo = computed(() => {
  const changedAt = props.seq?.changedAt
  if (changedAt === undefined) return undefined
  const seconds = Math.max(0, Math.floor((now.value - Date.parse(changedAt)) / 1000))
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`
})

const holdsData = computed(() => props.node.capabilities.includes('database@1'))
const onlineFor = computed(() => {
  if (!props.online || props.since === undefined) return undefined
  const minutes = Math.floor((Date.now() - Date.parse(props.since)) / 60_000)
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`
})

const agent = computed(() => {
  const value = props.node.userAgent
  if (value === undefined) return undefined
  return value.length > 60 ? `${value.slice(0, 57)}…` : value
})

const host = computed(() => {
  const endpoint = props.node.endpoint
  if (endpoint === undefined) return undefined
  try {
    return new URL(endpoint).host
  } catch {
    return endpoint
  }
})

const health = computed(() => {
  const quality = props.quality
  if (props.isSelf || quality === undefined) return undefined
  const failing = quality.lastFailureAt !== undefined && (quality.lastSuccessAt === undefined || quality.lastFailureAt > quality.lastSuccessAt)
  return failing ? 'failing' : 'healthy'
})
</script>

<template>
  <article class="node" :class="[node.role, { self: isSelf, offline: !online }, health]">
    <header>
      <span class="dot" :class="{ on: online }" :title="online ? `online since ${since}` : 'offline'" />
      <span class="runtime" :title="node.runtime">{{ node.runtime === 'nodejs' ? 'Node.js' : 'Browser' }}</span>
      <span class="role">{{ node.role }}</span>
      <span v-if="isSelf" class="you">you</span>
    </header>
    <h3 :title="node.id">{{ node.name }}</h3>
    <dl>
      <dt>core</dt>
      <dd>v{{ node.coreVersion }}</dd>
      <template v-if="node.os">
        <dt>os</dt>
        <dd>{{ node.os }}</dd>
      </template>
      <template v-if="agent">
        <dt>agent</dt>
        <dd :title="node.userAgent">{{ agent }}</dd>
      </template>
      <template v-if="node.endpoint">
        <dt>endpoint</dt>
        <dd class="mono" :title="node.endpoint">{{ host }}</dd>
      </template>
      <dt>status</dt>
      <dd>{{ online ? `online · ${onlineFor}` : 'offline' }}</dd>
      <dt>data</dt>
      <dd>{{ holdsData ? 'holds a copy' : node.role === 'orchestrator' ? 'none, relays to members' : 'none, client mode' }}</dd>
      <template v-if="holdsData">
        <dt>seq</dt>
        <dd class="seq" :title="seq ? `changes feed at ${seq.seq}` : 'not heard from while online'">
          <template v-if="seqLabel">
            <span class="mono">{{ seqLabel }}</span>
            <span v-if="changedAgo" class="ago"> · changed {{ changedAgo }}</span>
          </template>
          <template v-else>—</template>
        </dd>
      </template>
      <dt>id</dt>
      <dd class="mono" :title="node.id">{{ node.id.slice(0, 8) }}</dd>
    </dl>
    <ul class="capabilities" aria-label="capabilities">
      <li v-for="capability in node.capabilities" :key="capability">{{ capability }}</li>
      <li v-if="node.capabilities.length === 0" class="none">no capabilities</li>
    </ul>
    <p v-if="quality && !isSelf" class="quality">
      <span v-if="quality.latencyMs !== undefined">{{ Math.round(quality.latencyMs) }} ms</span>
      <span>✓ {{ quality.successes }}</span>
      <span>✗ {{ quality.failures }}</span>
      <span v-if="health === 'failing'" class="reason" :title="quality.lastFailure">{{ quality.lastFailure }}</span>
    </p>
  </article>
</template>

<style scoped>
.node {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  width: 220px;
  box-shadow: var(--shadow);
  font-size: 12px;
}
.node.orchestrator {
  border-color: var(--accent);
}
.node.self {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.node.failing {
  border-color: var(--danger);
}
.node.offline {
  opacity: 0.55;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
}
.dot.on {
  background: var(--ok);
}
header {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
}
.role {
  margin-left: auto;
}
.you {
  background: var(--accent);
  color: var(--on-accent);
  border-radius: 4px;
  padding: 1px 5px;
}
h3 {
  margin: 4px 0 6px;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 8px;
  margin: 0;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: var(--mono);
}
.ago {
  color: var(--muted);
}
.capabilities {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0;
  margin: 8px 0 0;
}
.capabilities li {
  font-family: var(--mono);
  font-size: 11px;
  background: var(--chip);
  border-radius: 4px;
  padding: 1px 6px;
}
.capabilities .none {
  background: none;
  color: var(--muted);
  padding: 0;
  font-family: inherit;
}
.quality {
  display: flex;
  gap: 8px;
  margin: 8px 0 0;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  font-family: var(--mono);
}
.reason {
  color: var(--danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
