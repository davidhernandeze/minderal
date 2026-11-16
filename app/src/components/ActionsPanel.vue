<script setup lang="ts">
import { PartialResultError, type Core } from '@minderal/core'
import { ref } from 'vue'
import { describe } from '../composables/useCore'

const props = defineProps<{ core: Core }>()

const syncing = ref(false)
const syncResult = ref<string>()
const url = ref('https://example.com/')
const fetching = ref(false)
const fetchResult = ref<{ outcome: 'complete' | 'partial' | 'error'; text: string }>()

async function syncNow(): Promise<void> {
  syncing.value = true
  try {
    const report = await props.core.sync()
    syncResult.value = `pushed ${report.pushed}, pulled ${report.pulled}`
  } catch (failure) {
    syncResult.value = describe(failure)
  } finally {
    syncing.value = false
  }
}

/** core.fetch: a browser core delegates it to the best node of its cluster. */
async function fetchThroughCluster(): Promise<void> {
  fetching.value = true
  const startedAt = performance.now()
  try {
    const response = await props.core.fetch(url.value)
    let bytes = 0
    try {
      bytes = (await response.arrayBuffer()).byteLength
    } catch (failure) {
      if (failure instanceof PartialResultError) {
        fetchResult.value = { outcome: 'partial', text: `${response.status}, cut after ${failure.receivedBytes} bytes by ${failure.nodeId.slice(0, 8)}` }
        return
      }
      throw failure
    }
    fetchResult.value = { outcome: 'complete', text: `HTTP ${response.status}, ${bytes} bytes in ${Math.round(performance.now() - startedAt)} ms` }
  } catch (failure) {
    fetchResult.value = { outcome: 'error', text: describe(failure) }
  } finally {
    fetching.value = false
  }
}
</script>

<template>
  <section class="panel">
    <h2>This node</h2>
    <div class="row">
      <button :disabled="syncing" @click="syncNow">{{ syncing ? 'Syncing…' : 'Sync now' }}</button>
      <span class="result">{{ syncResult ?? 'syncs live in the background' }}</span>
    </div>
    <form class="row" @submit.prevent="fetchThroughCluster">
      <input v-model="url" aria-label="URL to fetch through the cluster" />
      <button type="submit" :disabled="fetching">{{ fetching ? 'Fetching…' : 'core.fetch' }}</button>
    </form>
    <p v-if="fetchResult" class="result" :class="fetchResult.outcome">
      <b>{{ fetchResult.outcome }}</b> {{ fetchResult.text }}
    </p>
  </section>
</template>

<style scoped>
h2 {
  font-size: 15px;
  margin: 0 0 10px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.row input {
  flex: 1;
  min-width: 0;
}
.result {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
  overflow-wrap: anywhere;
}
.result.complete b {
  color: var(--ok);
}
.result.partial b {
  color: var(--warn);
}
.result.error b {
  color: var(--danger);
}
</style>
