<script setup lang="ts">
import type { Core, StoredDocument } from '@minderal/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { describe } from '../composables/useCore'

const props = defineProps<{ core: Core }>()

const documents = ref<StoredDocument[]>([])
const filter = ref<string>('all')
const title = ref('')
const error = ref<string>()
const flashed = ref(new Set<string>())
let stopWatching: (() => void) | undefined
let reloading: ReturnType<typeof setTimeout> | undefined

async function reload(): Promise<void> {
  try {
    documents.value = (await props.core.documents.list()).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  } catch (failure) {
    error.value = describe(failure)
  }
}

watch(
  () => props.core,
  (core) => {
    stopWatching?.()
    void reload()
    stopWatching = core.documents.watch((change) => {
      flashed.value = new Set([...flashed.value, change.id])
      setTimeout(() => {
        const next = new Set(flashed.value)
        next.delete(change.id)
        flashed.value = next
      }, 1500)
      clearTimeout(reloading)
      reloading = setTimeout(() => void reload(), 100)
    })
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  stopWatching?.()
  clearTimeout(reloading)
})

const types = computed(() => ['all', ...new Set(documents.value.map((document) => String(document.type ?? 'untyped')))])
const shown = computed(() =>
  filter.value === 'all' ? documents.value : documents.value.filter((document) => String(document.type ?? 'untyped') === filter.value),
)

async function addNote(): Promise<void> {
  const text = title.value.trim()
  if (text === '') return
  error.value = undefined
  try {
    await props.core.documents.put({
      _id: `note:${crypto.randomUUID()}`,
      type: 'note',
      title: text,
      body: `Written in ${props.core.cluster.self?.name ?? 'the browser'}.`,
      tags: ['browser'],
      createdAt: new Date().toISOString(),
    })
    title.value = ''
  } catch (failure) {
    error.value = describe(failure)
  }
}

async function toggle(document: StoredDocument): Promise<void> {
  try {
    await props.core.documents.put({ ...document, done: document.done !== true })
  } catch (failure) {
    error.value = describe(failure)
  }
}
</script>

<template>
  <section class="panel">
    <header>
      <h2>Documents <span class="count">{{ documents.length }}</span></h2>
      <select v-model="filter" aria-label="Filter by type">
        <option v-for="type in types" :key="type" :value="type">{{ type }}</option>
      </select>
    </header>
    <form @submit.prevent="addNote">
      <input v-model="title" placeholder="New note title" aria-label="New note title" />
      <button type="submit">Add</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <ul>
      <li v-for="document in shown" :key="document._id" :class="{ flash: flashed.has(document._id) }">
        <input v-if="document.type === 'task'" type="checkbox" :checked="document.done === true" @change="toggle(document)" />
        <div>
          <strong>{{ document.title ?? document._id }}</strong>
          <small>{{ document._id }} · rev {{ document._rev.split('-')[0] }}</small>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  font-size: 15px;
  margin: 0;
}
.count {
  color: var(--muted);
  font-weight: normal;
}
form {
  display: flex;
  gap: 6px;
  margin: 10px 0;
}
form input {
  flex: 1;
  min-width: 0;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  max-height: 520px;
  border-top: 1px solid var(--border);
}
li {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 7px 4px;
  border-bottom: 1px solid var(--border);
  transition: background 0.6s;
}
li.flash {
  background: var(--flash);
  transition: none;
}
li div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
strong {
  font-weight: 500;
  font-size: 13px;
}
small {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error {
  color: var(--danger);
  font-size: 12px;
}
</style>
