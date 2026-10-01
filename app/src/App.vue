<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { hierarchy, tree } from 'd3-hierarchy'
import { ANONYMOUS_REMOTE_USER, ConnectionFactory, StringNeuron } from '@minderal/core'
import type {
  Connection,
  Database,
  Neuron,
  NeuronChange,
  ResolvedAttribute
} from '@minderal/core'

const MAX_TRAIL_DEPTH = 50
const REFRESH_DEBOUNCE_MS = 200
const NODE_WIDTH = 230
const NODE_HEIGHT = 48
const NODE_GAP_VERTICAL = 68
const NODE_GAP_HORIZONTAL = 310
const GRAPH_PADDING = 32
const DRAFT_NODE_ID = '__draft__'
const ATTRIBUTE_ROW_HEIGHT = 26
const ATTRIBUTE_PADDING = 8
const DEFAULT_DATABASE_NAME = 'neurons'
const NEW_DATABASE_CHOICE = '\u0000new'
const ROOT_LABEL = '\u{1F9E0}'
const ROOT_DETAIL = 'start creating from here'

type ViewMode = 'table' | 'graph'

interface GraphSource {
  id: string | null
  label: string
  detail: string
  isCurrent: boolean
  isDraft: boolean
  isRoot: boolean
  neuron: Neuron | null
  children?: GraphSource[]
}

// What a reload starts from: the server we last reached and the database we
// last read. A default is fine to put in a field, but not to act on — the
// probe would sit on a host nobody named until fetch gives up, and a reload
// would land in a database the user had moved away from.
const LAST_URL_KEY = 'minderal.last-url'
const LAST_DATABASE_KEY = 'minderal.last-database'

function readRemembered(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === null || stored.length === 0 ? null : stored
  } catch {
    return null
  }
}

function remember(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private windows and blocked site data: the fields keep working, the
    // next visit just starts from the defaults again.
  }
}

// A guess, used to fill the field when nothing better is known: on a phone
// `localhost` is the phone. Taking the hostname from the page also keeps the
// two on the same site — same host, different port — so the session cookie is
// sent. A different scheme or host would not be.
const guessedUrl = `${window.location.protocol}//${window.location.hostname}:5984`

const lastUrl = readRemembered(LAST_URL_KEY)
const url = ref(lastUrl ?? guessedUrl)
const username = ref('admin')
const password = ref('password')
const databaseName = ref(readRemembered(LAST_DATABASE_KEY) ?? DEFAULT_DATABASE_NAME)

const connection = shallowRef<Connection | null>(null)
const database = shallowRef<Database | null>(null)
const databaseNames = ref<string[]>([])
const neurons = shallowRef<Neuron[]>([])

// Ancestors of the open neuron, root first, with the open neuron last. Empty
// at the top level.
const trail = shallowRef<Neuron[]>([])
const currentId = ref<string | null>(null)

const view = ref<ViewMode>('table')

const value = ref('')
const name = ref('')

// An in-progress child being typed directly on a graph node. null when no
// node is accepting input.
const draft = shallowRef<{ parentId: string | null } | null>(null)
const draftValue = ref('')

// Renaming happens in place on the name itself, in either view.
const editing = shallowRef<{ neuron: Neuron } | null>(null)
const editValue = ref('')

// Attributes of the open neuron only: it is alone in its column, so it can grow
// without pushing anything else around.
const attributes = shallowRef<ResolvedAttribute[]>([])
const attributeDraftOpen = ref(false)
const attributeName = ref('')
const attributeValue = ref('')

// Deleting asks first, inline, rather than through a modal dialog. Deletion
// takes the whole subtree, so the prompt has to say when there is one.
const pendingDelete = shallowRef<{ id: string; hasChildren: boolean } | null>(null)

const namingDatabase = ref(false)
const newDatabaseName = ref('')
const newDatabaseInput = ref<HTMLInputElement | null>(null)

const connecting = ref(false)
// True only while the initial session probe is in flight, so the login form
// does not flash before we know whether it is needed. With no remembered
// server there is no probe, so the form shows straight away.
const resuming = ref(lastUrl !== null)
const busy = ref(false)
const error = ref('')

// Updates are driven by database changes, not by the write that caused them.
const isWatching = ref(false)
let unwatch: (() => void) | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const isConnected = computed(() => connection.value !== null)
const isRemote = computed(() => url.value.trim().length > 0)
const currentNeuron = computed(() => trail.value.at(-1) ?? null)

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function labelOf(neuron: Neuron): string {
  if (neuron instanceof StringNeuron) return neuron.name ?? neuron.value
  return neuron.id
}

// The second line carries the neuron's content, not its type: `string` on every
// node says nothing.
function detailOf(neuron: Neuron): string {
  const stringNeuron = asStringNeuron(neuron)
  if (stringNeuron === null) return ''
  return stringNeuron.name === null ? '' : stringNeuron.value
}

function readIdFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('id')
}

function writeUrl(id: string | null, mode: ViewMode, replace = false): void {
  const next = new URL(window.location.href)
  if (id === null) next.searchParams.delete('id')
  else next.searchParams.set('id', id)
  if (mode === 'table') next.searchParams.delete('view')
  else next.searchParams.set('view', mode)
  if (next.href === window.location.href) return
  if (replace) history.replaceState({}, '', next)
  else history.pushState({}, '', next)
}

function readViewFromUrl(): ViewMode {
  return new URL(window.location.href).searchParams.get('view') === 'graph' ? 'graph' : 'table'
}

function setView(mode: ViewMode): void {
  view.value = mode
  writeUrl(currentId.value, mode)
}

async function open(id: string | null): Promise<void> {
  writeUrl(id, view.value)
  currentId.value = id
  await refresh()
}

// Back/forward move between neurons, so the URL is the source of truth.
async function onPopState(): Promise<void> {
  currentId.value = readIdFromUrl()
  view.value = readViewFromUrl()
  await refresh()
}

// The session cookie is HttpOnly, so it cannot be read — but the server will
// answer GET /_session as the real user when one is live. Connecting with no
// credentials is therefore both the check and the connection.
async function resumeSession(): Promise<void> {
  if (lastUrl === null) return
  try {
    const candidate = await ConnectionFactory.createRemoteConnection({ url: lastUrl })
    if (candidate.user === ANONYMOUS_REMOTE_USER) {
      await candidate.close()
      return
    }
    connection.value = candidate
    username.value = candidate.user
    password.value = ''
    databaseNames.value = await candidate.getDatabaseList()
    await openDatabase()
  } catch {
    // No reachable server, or no session: fall through to the login form.
  } finally {
    resuming.value = false
  }
}

async function connect(): Promise<void> {
  connecting.value = true
  error.value = ''
  try {
    stopWatching()
    await connection.value?.close()
    neurons.value = []
    connection.value = isRemote.value
      ? await ConnectionFactory.createRemoteConnection({
          url: url.value.trim(),
          username: username.value,
          password: password.value
        })
      : ConnectionFactory.createLocalConnection({ adapter: 'idb' })

    databaseNames.value = await connection.value.getDatabaseList()
    remember(LAST_URL_KEY, isRemote.value ? url.value.trim() : null)
    await openDatabase()
  } catch (cause) {
    connection.value = null
    database.value = null
    error.value = describe(cause)
  } finally {
    connecting.value = false
  }
}

async function openDatabase(): Promise<void> {
  if (connection.value === null) return
  const name = databaseName.value.trim()
  stopWatching()
  database.value = connection.value.getDatabase(name)
  currentId.value = readIdFromUrl()
  view.value = readViewFromUrl()
  await refresh()
  remember(LAST_DATABASE_KEY, name)
  await startWatching()
}

// Every database on the server, whatever is in the field — an `<input list>`
// narrows its own suggestions as you type, so the one name already there hid
// all the others. A remembered name the server does not list yet is kept at
// the front so the picker can still show where we are.
const databaseChoices = computed(() => {
  const names = [...databaseNames.value]
  const current = databaseName.value.trim()
  if (current.length > 0 && !names.includes(current)) names.unshift(current)
  return names
})

async function chooseDatabase(event: Event): Promise<void> {
  const choice = (event.target as HTMLSelectElement).value
  if (choice === NEW_DATABASE_CHOICE) {
    newDatabaseName.value = ''
    namingDatabase.value = true
    await nextTick()
    newDatabaseInput.value?.focus()
    return
  }
  databaseName.value = choice
  await openDatabase()
}

// A database comes into being by being opened, so naming one is all it takes.
async function commitNewDatabase(): Promise<void> {
  const name = newDatabaseName.value.trim()
  namingDatabase.value = false
  if (name.length === 0 || name === databaseName.value.trim()) return
  databaseName.value = name
  await openDatabase()
  if (connection.value !== null) databaseNames.value = await connection.value.getDatabaseList()
}

// Null when the id names nothing here, as opposed to an empty trail, which is
// the root level.
async function buildTrail(id: string | null): Promise<Neuron[] | null> {
  if (database.value === null || id === null) return []

  const chain: Neuron[] = []
  const seen = new Set<string>()
  let cursor = await database.value.get(id)
  if (cursor === null) return null

  // Guarded against a parent_id cycle, which would otherwise spin forever.
  while (cursor !== null && !seen.has(cursor.id) && chain.length < MAX_TRAIL_DEPTH) {
    seen.add(cursor.id)
    chain.unshift(cursor)
    cursor = cursor.parentId === null ? null : await database.value.get(cursor.parentId)
  }
  return chain
}

// Replication arrives in bursts, so a refetch per change would thrash. The
// debounce lives here rather than in core, which should not hide changes from
// a listener that wants them all.
function scheduleRefresh(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void refresh()
  }, REFRESH_DEBOUNCE_MS)
}

function affectsCurrentLevel(change: NeuronChange): boolean {
  // The level a neuron left has to refetch too, or it keeps showing a child
  // that moved away.
  return (
    change.parentId === currentId.value ||
    change.previousParentId === currentId.value ||
    change.id === currentId.value ||
    trail.value.some((ancestor) => ancestor.id === change.id)
  )
}

async function startWatching(): Promise<void> {
  stopWatching()
  if (database.value === null) return
  try {
    unwatch = await database.value.watch({
      change: (change) => {
        if (affectsCurrentLevel(change)) scheduleRefresh()
      },
      error: (cause) => {
        error.value = `Live updates stopped: ${cause.message}`
      },
      live: (value) => {
        isWatching.value = value
        if (value) {
          error.value = ''
          // Whatever happened while the feed was down is invisible to it.
          scheduleRefresh()
        }
      }
    })
    isWatching.value = true
  } catch (cause) {
    isWatching.value = false
    error.value = describe(cause)
  }
}

function stopWatching(): void {
  unwatch?.()
  unwatch = null
  isWatching.value = false
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

async function refresh(): Promise<void> {
  if (database.value === null) return
  busy.value = true
  error.value = ''
  try {
    const chain = await buildTrail(currentId.value)

    // An id in the URL outlives the neuron it names, and means nothing in
    // another database — switch databases and the one you were in is gone.
    // Neither is the user's mistake, so the page drops to the root level
    // without saying anything, replacing the history entry so Back does not
    // lead to the same dead id.
    if (chain === null) {
      currentId.value = null
      writeUrl(null, view.value, true)
    }

    trail.value = chain ?? []
    neurons.value = await database.value.listByParentId(currentId.value)
    const open = trail.value.at(-1) ?? null
    attributes.value = open === null ? [] : await database.value.listAttributes(open)
  } catch (cause) {
    error.value = describe(cause)
    // A stale or bad id in the URL should not leave the page stuck.
    trail.value = []
    neurons.value = []
  } finally {
    busy.value = false
  }
}

async function createNeuronIn(
  parentId: string | null,
  neuronName: string,
  neuronValue: string
): Promise<boolean> {
  if (database.value === null || neuronName.trim().length === 0) return false
  busy.value = true
  error.value = ''
  try {
    await database.value.create(
      StringNeuron.create({ name: neuronName, value: neuronValue, parentId })
    )
    // No refetch here: the change feed drives that. Adding to a neuron other
    // than the open one still opens it, so the new child is visible instead of
    // landing somewhere off-screen.
    if (parentId !== currentId.value) await open(parentId)
    return true
  } catch (cause) {
    error.value = describe(cause)
    return false
  } finally {
    busy.value = false
  }
}

async function createNeuron(): Promise<void> {
  const created = await createNeuronIn(currentId.value, name.value, value.value)
  if (!created) return
  value.value = ''
  name.value = ''
}

async function openDraft(parentId: string | null): Promise<void> {
  pendingDelete.value = null
  draft.value = { parentId }
  draftValue.value = ''
  // Only ever one draft input exists, and it has to be in the document before
  // it can take focus.
  await nextTick()
  document.querySelector<HTMLInputElement>('.draft-input')?.focus()
}


function cancelDraft(): void {
  draft.value = null
  draftValue.value = ''
}

// The open neuron carries its attribute rows plus the add row, so it is taller
// than the rest. Nothing else in its column, so nothing has to move.
function nodeHeightOf(source: GraphSource): number {
  if (!source.isCurrent || source.neuron === null) return NODE_HEIGHT
  const rows = attributes.value.length + 1
  return NODE_HEIGHT + rows * ATTRIBUTE_ROW_HEIGHT + ATTRIBUTE_PADDING
}

function openAttributeDraft(): void {
  attributeDraftOpen.value = true
  attributeName.value = ''
  attributeValue.value = ''
  void nextTick(() => document.querySelector<HTMLInputElement>('.attribute-name')?.focus())
}

function cancelAttributeDraft(): void {
  attributeDraftOpen.value = false
  attributeName.value = ''
  attributeValue.value = ''
}

async function commitAttributeDraft(): Promise<void> {
  const owner = currentNeuron.value
  if (owner === null || database.value === null) return
  if (attributeName.value.trim().length === 0) return

  busy.value = true
  error.value = ''
  try {
    await database.value.setAttribute(
      owner,
      attributeName.value,
      StringNeuron.create({ value: attributeValue.value })
    )
    // The owner's own change comes back through the feed and reloads these.
    cancelAttributeDraft()
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function removeAttribute(name: string): Promise<void> {
  const owner = currentNeuron.value
  if (owner === null || database.value === null) return
  busy.value = true
  error.value = ''
  try {
    await database.value.removeAttribute(owner, name)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function isEditing(id: string | null): boolean {
  return id !== null && editing.value?.neuron.id === id
}

async function startEditing(neuron: Neuron): Promise<void> {
  cancelDraft()
  pendingDelete.value = null
  editing.value = { neuron }
  editValue.value = neuron.name ?? ''
  await nextTick()
  const input = document.querySelector<HTMLInputElement>('.edit-input')
  input?.focus()
  input?.select()
}

function cancelEditing(): void {
  editing.value = null
  editValue.value = ''
}

// Same rule as the draft: clicking away from an untouched editor closes it,
// but an edit in progress is not thrown away.
function cancelUnchangedEditing(): void {
  const pending = editing.value
  if (pending === null) return
  if (editValue.value.trim() === (pending.neuron.name ?? '')) cancelEditing()
}

async function commitEditing(): Promise<void> {
  const pending = editing.value
  if (pending === null || database.value === null) return
  if (editValue.value.trim() === (pending.neuron.name ?? '')) {
    cancelEditing()
    return
  }

  busy.value = true
  error.value = ''
  try {
    await database.value.rename(pending.neuron, editValue.value)
    // No refetch here either: the change feed brings the new name back.
    cancelEditing()
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

// Clicking away from an untouched draft discards it; one with text typed into
// it stays, because losing what someone wrote is worse than a stray node.
function cancelEmptyDraft(): void {
  if (draftValue.value.trim().length === 0) cancelDraft()
}

function isPendingDelete(id: string | null): boolean {
  return id !== null && pendingDelete.value?.id === id
}

async function askDelete(id: string): Promise<void> {
  cancelDraft()
  pendingDelete.value = { id, hasChildren: false }
  if (database.value === null) return
  try {
    const children = await database.value.listByParentId(id)
    if (pendingDelete.value?.id === id) {
      pendingDelete.value = { id, hasChildren: children.length > 0 }
    }
  } catch (cause) {
    error.value = describe(cause)
  }
}

function cancelDelete(): void {
  pendingDelete.value = null
}

async function deleteNeuron(neuron: Neuron): Promise<void> {
  if (database.value === null) return
  busy.value = true
  error.value = ''
  try {
    await database.value.delete(neuron)
    pendingDelete.value = null
    // Deleting the neuron you are inside leaves nowhere to stand, so step up to
    // its parent. Anything else is picked up by the change feed.
    if (neuron.id === currentId.value) await open(neuron.parentId)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function commitDraft(): Promise<void> {
  const pending = draft.value
  if (pending === null) return
  if (await createNeuronIn(pending.parentId, draftValue.value, '')) cancelDraft()
}

// d3-hierarchy only computes positions; Vue renders the SVG, so nodes stay
// ordinary elements with normal click handlers and theme tokens.
// The neuron being typed is laid out as the first child of its parent, so d3
// gives it room instead of it landing on top of an existing child. It comes
// from `draft`, which a refetch never touches.
function withDraft(parentId: string | null, children: GraphSource[]): GraphSource[] {
  if (draft.value === null || draft.value.parentId !== parentId) return children
  return [
    {
      id: DRAFT_NODE_ID,
      label: '',
      detail: '',
      isCurrent: false,
      isDraft: true,
      isRoot: false,
      neuron: null
    },
    ...children
  ]
}

const graph = computed(() => {
  const openSource: GraphSource = {
    id: currentId.value,
    label: currentNeuron.value === null ? ROOT_LABEL : labelOf(currentNeuron.value),
    detail: currentNeuron.value === null ? ROOT_DETAIL : detailOf(currentNeuron.value),
    isCurrent: true,
    isDraft: false,
    isRoot: currentNeuron.value === null,
    neuron: currentNeuron.value,
    children: withDraft(
      currentId.value,
      neurons.value.map((neuron) => ({
        id: neuron.id,
        label: labelOf(neuron),
        detail: detailOf(neuron),
        isCurrent: false,
        isDraft: false,
        isRoot: false,
        neuron,
        children: withDraft(neuron.id, [])
      }))
    )
  }

  // The trail is root-first with the open neuron last, so its parent is the
  // entry before it; a root neuron falls back to the synthetic root node.
  const parentNeuron = trail.value.at(-2) ?? null
  const parentId = parentNeuron?.id ?? null
  const source: GraphSource =
    currentNeuron.value === null
      ? openSource
      : {
          id: parentId,
          label: parentNeuron === null ? ROOT_LABEL : labelOf(parentNeuron),
          detail: parentNeuron === null ? ROOT_DETAIL : detailOf(parentNeuron),
          isCurrent: false,
          isDraft: false,
          isRoot: parentNeuron === null,
          neuron: parentNeuron,
          children: withDraft(parentId, [openSource])
        }

  const layout = tree<GraphSource>().nodeSize([NODE_GAP_VERTICAL, NODE_GAP_HORIZONTAL])
  const root = layout(hierarchy(source))
  const nodes = root.descendants()

  // d3 puts depth in y and sibling offset in x; swapping them lays the tree
  // out left to right, which suits long text labels.
  const horizontals = nodes.map((node) => node.y)
  const tops = nodes.map((node) => node.x - nodeHeightOf(node.data) / 2)
  const bottoms = nodes.map((node) => node.x + nodeHeightOf(node.data) / 2)
  const minVertical = Math.min(...tops) - NODE_HEIGHT / 2
  const maxVertical = Math.max(...bottoms) + NODE_HEIGHT / 2
  const minHorizontal = Math.min(...horizontals) - NODE_WIDTH / 2
  const maxHorizontal = Math.max(...horizontals) + NODE_WIDTH / 2

  const width = maxHorizontal - minHorizontal + GRAPH_PADDING * 2
  const height = maxVertical - minVertical + GRAPH_PADDING * 2

  // Width and height are set in pixels to match the viewBox 1:1. Letting the
  // SVG stretch to the container instead would scale the whole drawing up,
  // and 11px label text with it.
  return {
    nodes,
    links: root.links(),
    width,
    height,
    viewBox: [minHorizontal - GRAPH_PADDING, minVertical - GRAPH_PADDING, width, height].join(' ')
  }
})

function linkPath(link: { source: { x: number; y: number }; target: { x: number; y: number } }): string {
  const startX = link.source.y + NODE_WIDTH / 2
  const endX = link.target.y - NODE_WIDTH / 2
  const midX = (startX + endX) / 2
  return `M${startX},${link.source.x}C${midX},${link.source.x} ${midX},${link.target.x} ${endX},${link.target.x}`
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}\u2026` : text
}

function asStringNeuron(neuron: Neuron): StringNeuron | null {
  return neuron instanceof StringNeuron ? neuron : null
}

function valueOf(neuron: Neuron): string {
  const stringNeuron = asStringNeuron(neuron)
  return stringNeuron === null ? '' : stringNeuron.value
}

function shorten(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}\u2026` : id
}

function formatTime(timestamp: string | null): string {
  if (timestamp === null) return '\u2014'
  return new Date(timestamp).toLocaleString()
}

onMounted(() => {
  window.addEventListener('popstate', onPopState)
  void resumeSession()
})
onUnmounted(() => {
  window.removeEventListener('popstate', onPopState)
  stopWatching()
})
</script>

<template>
  <header>
    <strong class="brand">minderal<span>/core</span></strong>

    <template v-if="resuming">
      <span class="resuming">Checking for a session…</span>
    </template>

    <template v-else>
      <input v-model="url" placeholder="CouchDB URL (blank = local)" size="30" />
      <input v-model="username" placeholder="user" size="10" :disabled="!isRemote" />
      <input
        v-model="password"
        type="password"
        :placeholder="isConnected ? 'signed in' : 'password'"
        size="12"
        :disabled="!isRemote"
      />

      <button :disabled="connecting" @click="connect">
        {{ connecting ? 'Connecting…' : isConnected ? 'Reconnect' : 'Connect' }}
      </button>
    </template>

    <span class="status" :class="isConnected ? 'ok' : 'off'">
      {{ isConnected ? (isRemote ? 'remote' : 'local') : 'disconnected' }}
    </span>
    <span class="status">
      v5.0
    </span>
    <span v-if="isConnected" class="status" :class="isWatching ? 'ok' : 'stale'">
      {{ isWatching ? 'live' : 'not live' }}
    </span>
  </header>

  <p v-if="error" class="error">{{ error }}</p>

  <main v-if="isConnected">
    <div class="bar">
      <label>
        database
        <input
          v-if="namingDatabase"
          ref="newDatabaseInput"
          v-model="newDatabaseName"
          placeholder="new database name"
          size="18"
          @keyup.enter="commitNewDatabase"
          @keyup.esc="namingDatabase = false"
          @blur="commitNewDatabase"
        />
        <select v-else :value="databaseName" @change="chooseDatabase">
          <option v-for="candidate in databaseChoices" :key="candidate" :value="candidate">
            {{ candidate }}
          </option>
          <option :value="NEW_DATABASE_CHOICE">+ new database…</option>
        </select>
      </label>

      <template v-if="view === 'table'">
        <input
          v-model="name"
          :placeholder="currentNeuron ? 'name (child of open neuron)' : 'name'"
          size="26"
          @keyup.enter="createNeuron"
        />
        <input v-model="value" placeholder="value (optional)" size="18" @keyup.enter="createNeuron" />
        <button :disabled="busy || name.trim().length === 0" @click="createNeuron">
          Create text neuron
        </button>
      </template>

      <button class="secondary" :disabled="busy" @click="refresh">Refresh</button>

      <span class="toggle">
        <button :class="{ active: view === 'table' }" @click="setView('table')">Table</button>
        <button :class="{ active: view === 'graph' }" @click="setView('graph')">Graph</button>
      </span>

      <span class="count">{{ neurons.length }} child{{ neurons.length === 1 ? '' : 'ren' }}</span>
    </div>

    <nav class="trail">
      <button
        class="crumb root"
        :class="{ current: trail.length === 0 }"
        title="Top level"
        @click="open(null)"
      >
        {{ ROOT_LABEL }}
      </button>
      <template v-for="(ancestor, index) in trail" :key="ancestor.id">
        <span class="sep">/</span>
        <button
          class="crumb"
          :class="{ current: index === trail.length - 1 }"
          @click="open(ancestor.id)"
        >
          {{ labelOf(ancestor) }}
        </button>
      </template>
    </nav>

    <section v-if="currentNeuron && view === 'table'" class="details">
      <h2>
        {{ labelOf(currentNeuron) }}
        <span class="kind"><code>{{ currentNeuron.type }}</code></span>
      </h2>

      <dl>
        <div class="wide">
          <dt>id</dt>
          <dd><code>{{ currentNeuron.id }}</code></dd>
        </div>
        <div class="wide">
          <dt>parent</dt>
          <dd>
            <button
              v-if="currentNeuron.parentId !== null"
              class="open"
              @click="open(currentNeuron.parentId)"
            >
              {{ currentNeuron.parentId }}
            </button>
            <button v-else class="open root" title="Top level" @click="open(null)">
              {{ ROOT_LABEL }}
            </button>
          </dd>
        </div>
        <div>
          <dt>created by</dt>
          <dd>{{ currentNeuron.createdBy ?? '—' }}</dd>
        </div>
        <div>
          <dt>created at</dt>
          <dd>{{ formatTime(currentNeuron.createdAt) }}</dd>
        </div>
      </dl>
    </section>

    <table v-if="view === 'table'">
      <thead>
        <tr>
          <th>id</th>
          <th>value</th>
          <th>name</th>
          <th>type</th>
          <th>revision</th>
          <th>parent</th>
          <th>created by</th>
          <th>created at</th>
          <th>updated at</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="neuron in neurons" :key="neuron.id">
          <td>
            <button class="open" :title="`Open ${neuron.id}`" @click="open(neuron.id)">
              {{ shorten(neuron.id) }}
            </button>
          </td>
          <td class="value">{{ asStringNeuron(neuron)?.value ?? '—' }}</td>
          <td class="name-cell">
            <input
              v-if="isEditing(neuron.id)"
              v-model="editValue"
              class="edit-input inline"
              @keyup.enter="commitEditing"
              @keyup.esc="cancelEditing"
              @blur="cancelUnchangedEditing"
            />
            <button v-else class="name-button" title="Rename" @click="startEditing(neuron)">
              {{ neuron.name ?? '—' }}
            </button>
          </td>
          <td><code>{{ neuron.type }}</code></td>
          <td><code>{{ neuron.revision ?? '—' }}</code></td>
          <td>
            <span v-if="neuron.parentId === null" class="root" title="Top level">
              {{ ROOT_LABEL }}
            </span>
            <code v-else>{{ neuron.parentId }}</code>
          </td>
          <td>{{ neuron.createdBy ?? '—' }}</td>
          <td class="time">{{ formatTime(neuron.createdAt) }}</td>
          <td class="time">{{ formatTime(neuron.updatedAt) }}</td>
          <td class="actions">
            <template v-if="isPendingDelete(neuron.id)">
              <span class="confirm-label">
                {{ pendingDelete?.hasChildren ? 'Delete, and everything inside?' : 'Delete?' }}
              </span>
              <button class="confirm yes" :disabled="busy" @click="deleteNeuron(neuron)">Yes</button>
              <button class="confirm no" :disabled="busy" @click="cancelDelete">No</button>
            </template>
            <button
              v-else
              class="trash"
              :disabled="busy"
              title="Delete neuron"
              @click="askDelete(neuron.id)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M2.5 4h11M6 4V2.6a.6.6 0 0 1 .6-.6h2.8a.6.6 0 0 1 .6.6V4M4 4l.55 9.1a1 1 0 0 0 1 .9h4.9a1 1 0 0 0 1-.9L12 4M6.6 6.6v5M9.4 6.6v5"
                />
              </svg>
            </button>
          </td>
        </tr>
        <tr v-if="neurons.length === 0">
          <td colspan="10" class="empty">
            <template v-if="currentNeuron">
              <code>{{ labelOf(currentNeuron) }}</code> has no children yet.
            </template>
            <template v-else>
              No neurons in <code>{{ databaseName }}</code> yet.
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="graph">
      <svg
        :viewBox="graph.viewBox"
        :width="graph.width"
        :height="graph.height"
        role="img"
        aria-label="Neuron tree"
      >
        <path v-for="(link, index) in graph.links" :key="index" class="edge" :d="linkPath(link)" />

        <g
          v-for="node in graph.nodes"
          :key="node.data.id ?? 'root'"
          class="node"
          :class="{
            current: node.data.isCurrent,
            draft: node.data.isDraft,
            editing: isEditing(node.data.id),
            clickable: !node.data.isCurrent && !node.data.isDraft && !isEditing(node.data.id)
          }"
          :transform="`translate(${node.y - NODE_WIDTH / 2}, ${node.x - nodeHeightOf(node.data) / 2})`"
          @click="
            node.data.isCurrent || node.data.isDraft || isEditing(node.data.id)
              ? undefined
              : open(node.data.id)
          "
        >
          <rect :width="NODE_WIDTH" :height="nodeHeightOf(node.data)" rx="7" />

          <foreignObject
            v-if="node.data.isDraft"
            :x="0"
            :y="0"
            :width="NODE_WIDTH"
            :height="NODE_HEIGHT"
            @click.stop
          >
            <div class="node-draft">
              <input
                v-model="draftValue"
                class="draft-input"
                placeholder="name, Enter to create"
                @keyup.enter="commitDraft"
                @keyup.esc="cancelDraft"
                @blur="cancelEmptyDraft"
              />
            </div>
          </foreignObject>

          <!-- Confirming covers the node itself. Anywhere beside it collides
               with the children drawn in that space, which paint over it. -->
          <foreignObject
            v-else-if="isPendingDelete(node.data.id) && node.data.neuron !== null"
            :x="0"
            :y="0"
            :width="NODE_WIDTH"
            :height="NODE_HEIGHT"
            @click.stop
          >
            <div class="node-confirm">
              <span class="node-confirm-label">
                <span class="node-confirm-title">Delete {{ truncate(node.data.label, 14) }}?</span>
                <span v-if="pendingDelete?.hasChildren" class="node-confirm-note">
                  and everything inside
                </span>
              </span>
              <button class="confirm yes" :disabled="busy" @click="deleteNeuron(node.data.neuron)">
                Yes
              </button>
              <button class="confirm no" :disabled="busy" @click="cancelDelete">No</button>
            </div>
          </foreignObject>

          <foreignObject
            v-else-if="isEditing(node.data.id)"
            :x="0"
            :y="0"
            :width="NODE_WIDTH"
            :height="NODE_HEIGHT"
            @click.stop
          >
            <div class="node-draft">
              <input
                v-model="editValue"
                class="draft-input edit-input"
                placeholder="name, Enter to save"
                @keyup.enter="commitEditing"
                @keyup.esc="cancelEditing"
                @blur="cancelUnchangedEditing"
              />
            </div>
          </foreignObject>

          <template v-else-if="!node.data.isDraft">
            <text
              :class="node.data.isRoot ? 'root-mark' : 'name'"
              :x="14"
              :y="node.data.detail === '' ? 29 : 20"
              @click.stop="node.data.neuron && startEditing(node.data.neuron)"
            >
              {{ truncate(node.data.label, 22) }}
            </text>
            <text v-if="node.data.detail !== ''" :x="14" :y="36" class="detail">
              {{ truncate(node.data.detail, 26) }}
            </text>
            <title>{{ node.data.id ?? 'Top level' }}</title>

            <foreignObject
              v-if="node.data.isCurrent && node.data.neuron !== null"
              :x="0"
              :y="NODE_HEIGHT - 6"
              :width="NODE_WIDTH"
              :height="nodeHeightOf(node.data) - NODE_HEIGHT + 6"
              @click.stop
            >
              <div class="attributes">
                <div v-for="attribute in attributes" :key="attribute.name" class="attribute">
                  <span class="attribute-name-label">{{ attribute.name }}</span>
                  <span class="attribute-value">{{ valueOf(attribute.neuron) }}</span>
                  <button
                    class="attribute-remove"
                    :disabled="busy"
                    title="Remove attribute"
                    @click="removeAttribute(attribute.name)"
                  >
                    ×
                  </button>
                </div>

                <div v-if="attributeDraftOpen" class="attribute draft">
                  <input
                    v-model="attributeName"
                    class="attribute-name"
                    placeholder="name"
                    @keyup.enter="commitAttributeDraft"
                    @keyup.esc="cancelAttributeDraft"
                  />
                  <input
                    v-model="attributeValue"
                    class="attribute-input"
                    placeholder="value"
                    @keyup.enter="commitAttributeDraft"
                    @keyup.esc="cancelAttributeDraft"
                  />
                </div>

                <button v-else class="attribute-add" :disabled="busy" @click="openAttributeDraft">
                  + Add attribute
                </button>
              </div>
            </foreignObject>

            <g
              class="add"
              :class="{ disabled: busy }"
              :transform="`translate(${NODE_WIDTH - 21}, ${NODE_HEIGHT / 2})`"
              @click.stop="openDraft(node.data.id)"
            >
              <circle r="10" />
              <path d="M-4.5,0 H4.5 M0,-4.5 V4.5" />
              <title>Create inside {{ node.data.label }}</title>
            </g>

            <g
              v-if="node.data.neuron !== null"
              class="remove"
              :class="{ disabled: busy }"
              :transform="`translate(${NODE_WIDTH - 46}, ${NODE_HEIGHT / 2})`"
              @click.stop="askDelete(node.data.id!)"
            >
              <circle r="10" />
              <path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" />
              <title>Delete {{ node.data.label }}</title>
            </g>
          </template>

        </g>
      </svg>

      <p v-if="neurons.length === 0" class="empty">
        Nothing below <code>{{ currentNeuron ? labelOf(currentNeuron) : databaseName }}</code> yet.
      </p>
    </div>
  </main>

  <p v-else-if="!resuming" class="empty hint">
    Connect to a CouchDB server, or leave the URL blank for a local database.
  </p>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.brand { margin-right: 6px; }
.brand span { color: var(--muted); font-weight: 400; }

.status {
  margin-left: auto;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.status.ok { color: var(--ok); }
.status.off { color: var(--muted); }
.status.stale { color: var(--danger); }
.resuming { color: var(--muted); }

.error {
  margin: 0;
  padding: 8px 14px;
  color: var(--danger);
  border-bottom: 1px solid var(--border);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

main { padding: 14px; }

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.bar label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.count { color: var(--muted); font-size: 12px; }

.trail {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}

.crumb {
  background: transparent;
  border: none;
  padding: 2px 4px;
  color: var(--accent);
  cursor: pointer;
  border-radius: 4px;
}
.crumb:hover { background: var(--panel); }
.crumb.current { color: var(--text); font-weight: 600; cursor: default; }

/* The mark carries its own colour, so the link tint would only muddy it. */
.root { color: inherit; font-size: 14px; line-height: 1; }
.sep { color: var(--muted); }

.open {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--accent);
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.open:hover { color: var(--text); }

.details {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.details h2 {
  margin: 0 0 10px;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.details .kind { color: var(--muted); font-weight: 400; }

.details dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px 20px;
}

.details dl > div { min-width: 0; }
.details dl > div.wide { grid-column: span 2; }

.details dt {
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 2px;
}

.details dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.toggle button {
  background: transparent;
  color: var(--muted);
  border: none;
  border-radius: 0;
  padding: 6px 12px;
}

.toggle button.active { background: var(--accent); color: #fff; }

.graph {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  overflow: auto;
  min-height: 260px;
  max-height: 70vh;
}

.graph svg { display: block; max-width: 100%; height: auto; }

.edge {
  fill: none;
  stroke: var(--border);
  stroke-width: 1.5;
}

.node rect {
  fill: var(--bg);
  stroke: var(--border);
}

.node text {
  fill: var(--text);
  font-size: 13px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.node text.detail { fill: var(--muted); font-size: 11px; }
.node text.name { cursor: text; }
.node text.root-mark { font-size: 17px; }
.node text.name:hover { text-decoration: underline; text-underline-offset: 2px; }

.node.current rect { stroke: var(--accent); stroke-width: 2; }

.node.clickable { cursor: pointer; }
.node.clickable:hover > rect { stroke: var(--accent); }

.add { cursor: pointer; opacity: 0.45; }
.add:hover { opacity: 1; }
.add.disabled { opacity: 0.15; pointer-events: none; }
.add circle { fill: var(--panel); stroke: var(--border); }
.add:hover circle { fill: var(--accent); stroke: var(--accent); }
.add path { stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round; }
.add:hover path { stroke: #fff; }

.remove { cursor: pointer; opacity: 0.45; }
.remove:hover { opacity: 1; }
.remove.disabled { opacity: 0.15; pointer-events: none; }
.remove circle { fill: var(--panel); stroke: var(--border); }
.remove:hover circle { fill: var(--danger); stroke: var(--danger); }
.remove path { stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round; }
.remove:hover path { stroke: #fff; }

.node-confirm {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  border: 1px solid var(--danger);
  border-radius: 7px;
  background: var(--bg);
  color: var(--text);
  font: 12px ui-sans-serif, system-ui, sans-serif;
}

.node-confirm-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}

.node-confirm-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-confirm-note {
  color: var(--danger);
  font-size: 10px;
  white-space: nowrap;
}

td.actions { white-space: nowrap; text-align: right; }

.trash {
  background: transparent;
  border: none;
  padding: 2px 4px;
  color: var(--muted);
  cursor: pointer;
  line-height: 0;
}

.trash svg { fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.trash:hover { color: var(--danger); }

.confirm-label { color: var(--muted); font-size: 12px; margin-right: 4px; }

td.name-cell { padding: 3px 10px; }

.name-button {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  padding: 3px 6px;
  cursor: text;
  text-align: left;
}

.name-button:hover { border-color: var(--border); }

.edit-input.inline {
  width: 100%;
  border: 1px solid var(--accent);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  padding: 3px 6px;
  font: inherit;
}

.confirm {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 12px;
}

.confirm.yes { border-color: var(--danger); color: var(--danger); }
.confirm.yes:hover { background: var(--danger); color: #fff; }
.confirm.no:hover { background: var(--panel); }

.node.draft rect { stroke: var(--accent); stroke-dasharray: 4 3; fill: var(--bg); }

/* The editor sits inside the node with a borderless input, so the node itself
   has to show that it is being edited. */
.node.editing rect { stroke: var(--accent); stroke-width: 2; }

.attributes {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  font: 11px ui-sans-serif, system-ui, sans-serif;
}

.attribute {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  min-width: 0;
}

.attribute-name-label {
  color: var(--muted);
  flex: 0 0 auto;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-value {
  color: var(--text);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attribute-remove {
  flex: 0 0 auto;
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  opacity: 0;
}

.attribute:hover .attribute-remove { opacity: 1; }
.attribute-remove:hover { color: var(--danger); }

.attribute-name,
.attribute-input {
  min-width: 0;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  padding: 2px 6px;
  font: inherit;
}

.attribute-name { flex: 0 0 40%; }
.attribute-input { flex: 1 1 auto; }

.attribute-add {
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 5px;
  color: var(--muted);
  cursor: pointer;
  height: 22px;
  padding: 0 8px;
  text-align: left;
  font: inherit;
}

.attribute-add:hover { border-color: var(--accent); color: var(--accent); }

.node-draft {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 8px;
}

.draft-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  padding: 0;
  font: 13px ui-sans-serif, system-ui, sans-serif;
}

.graph .empty { margin: 8px 0 4px; text-align: center; }

table { width: 100%; border-collapse: collapse; }

th, td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

th {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

td.value { white-space: normal; font-weight: 500; }
td.time { color: var(--muted); font-size: 12px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.empty { color: var(--muted); }
.hint { padding: 14px; }
</style>
