<script setup lang="ts">
import { ref, watch } from 'vue'
import ActionsPanel from './components/ActionsPanel.vue'
import ClusterDiagram from './components/ClusterDiagram.vue'
import DocumentsPanel from './components/DocumentsPanel.vue'
import { useCore } from './composables/useCore'

const { core, phase, error, devCluster, nodes, quality, isOnline, onlineSince, join, leave } = useCore()
const endpoint = ref('')
const name = ref('')

watch(devCluster, (cluster) => {
  if (cluster !== undefined && endpoint.value === '') endpoint.value = cluster.endpoint
})
</script>

<template>
  <header class="top">
    <h1>Minderal <span>cluster</span></h1>
    <template v-if="core">
      <span class="dataset mono" :title="core.datasetId">dataset {{ core.datasetId.slice(0, 8) }}</span>
      <button class="quiet" @click="leave">Forget this dataset</button>
    </template>
  </header>

  <main v-if="phase === 'starting'" class="center muted">Opening…</main>

  <main v-else-if="!core" class="center">
    <form class="join" @submit.prevent="join(endpoint, name)">
      <h2>Join a cluster</h2>
      <p class="muted">
        This browser becomes a member node: it copies the dataset into IndexedDB, keeps it in sync, and delegates what it
        cannot do itself.
      </p>
      <label>
        Endpoint
        <input v-model="endpoint" placeholder="http://127.0.0.1:5985/minderal-…" required />
      </label>
      <p v-if="devCluster" class="muted small">The dev cluster is running; its endpoint is filled in.</p>
      <p v-else class="muted small">No dev cluster found: run <code>npm run cluster</code> in app/.</p>
      <label>
        Node name
        <input v-model="name" placeholder="defaults to browser and OS" />
      </label>
      <button type="submit" :disabled="phase === 'joining'">{{ phase === 'joining' ? 'Joining…' : 'Join' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>

  <main v-else class="layout">
    <ClusterDiagram
      :nodes="nodes"
      :self-id="core.nodeId"
      :quality="quality"
      :is-online="isOnline"
      :online-since="onlineSince"
    />
    <aside>
      <ActionsPanel :core="core" />
      <DocumentsPanel :core="core" />
    </aside>
  </main>
</template>

<style scoped>
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
h1 {
  font-size: 17px;
  margin: 0;
  white-space: nowrap;
}
h1 span {
  color: var(--muted);
  font-weight: normal;
}
.dataset {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}
.center {
  display: grid;
  place-items: center;
  min-height: 70vh;
  padding: 16px;
}
.join {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(460px, 100%);
}
.join h2 {
  margin: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  padding: 16px 20px;
}
aside {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.error {
  color: var(--danger);
  font-size: 13px;
}
.small {
  font-size: 12px;
  margin: 0;
}
@media (max-width: 1080px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }
}
</style>
