<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { hierarchy, tree } from 'd3-hierarchy'
import {
  ANONYMOUS_REMOTE_USER,
  BOOLEAN_NEURON_TYPE,
  BooleanNeuron,
  ConnectionFactory,
  NEURON_ROOT_ID,
  OBJECT_NEURON_TYPE,
  ObjectNeuron,
  STRING_NEURON_TYPE,
  StringNeuron,
  Template
} from '@minderal/core'
import EditableText from './components/EditableText.vue'
import type {
  Connection,
  Database,
  Neuron,
  NeuronChange,
  InheritedAttribute,
  ResolvedAttribute,
  TemplateAttribute,
  TemplateDefault
} from '@minderal/core'

const MAX_TRAIL_DEPTH = 50
const REFRESH_DEBOUNCE_MS = 200
const NODE_WIDTH = 290
const NODE_HEIGHT = 62
const NODE_GAP_VERTICAL = 88
const NODE_GAP_HORIZONTAL = 390
const GRAPH_PADDING = 32
const DRAFT_NODE_ID = '__draft__'
// The selected node is the editor, so it is wider than a plain node and as
// tall as what it holds. Every part of it has a fixed height in the stylesheet,
// which is what lets the box be measured here, before it is drawn.
const EDITOR_WIDTH = 340
const EDITOR_PADDING = 8
const EDITOR_GAP = 6
const EDITOR_HEAD_HEIGHT = 24
const EDITOR_ID_HEIGHT = 15
const EDITOR_EXTENDS_HEIGHT = 24
const EDITOR_TABLE_HEAD_HEIGHT = 19
const EDITOR_ROW_HEIGHT = 27
const EDITOR_ADD_HEIGHT = 24
const DEFAULT_DATABASE_NAME = 'neurons'
const NEW_DATABASE_CHOICE = '\u0000new'
const ROOT_MENU_HEIGHT = 36
const NODE_DETAIL_BASELINE = 46
// Below the round buttons rather than behind them, and still inside the box.
const NODE_TAG_BASELINE = NODE_HEIGHT - 9
const ROOT_LABEL = '\u{1F9E0}'
const ROOT_DETAIL = 'start creating from here'
const ROOT_TYPES_DETAIL = 'the types you have made'

type ViewMode = 'table' | 'graph'

// What the tree is showing. The word in the interface is always "type": a
// template is what the document is called, not what the user made.
type Subject = 'neurons' | 'types'

// What the picker offers: the built-in types, then every type the user has
// made. A choice is identified by the template's id, which is also how an
// attribute records which type it follows.
interface TypeChoice {
  value: string
  label: string
  templateId: string | null
}

interface GraphSource {
  id: string | null
  label: string
  detail: string
  isCurrent: boolean
  isDraft: boolean
  isRoot: boolean
  neuron: Neuron | null
  template: Template | null
  // Written on the edge that reaches this node, which is how an attribute says
  // what it is to its owner. Null on the ordinary parent/child edges.
  connector: string | null
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

// The URL leaves the root out, so no id means the top of the tree. Everything
// that reads or writes parent_id resolves it here: a neuron under the root is
// in the tree, and parent_id null is one that is not — an attribute's value, or
// one that has not been filed anywhere.
const openParentId = computed(() => currentId.value ?? NEURON_ROOT_ID)

const view = ref<ViewMode>('table')
const subject = ref<Subject>('neurons')

const templates = shallowRef<Template[]>([])
const currentTemplate = shallowRef<Template | null>(null)
// Its own attributes and the ones it takes from the type it extends. Inherited
// ones are shown where they are defined, never copied, so they are read-only
// here: changing one belongs to the type that declares it.
const templateAttributes = shallowRef<InheritedAttribute[]>([])
const templateAttributeDraftOpen = ref(false)
const templateAttributeName = ref('')
const templateAttributeType = ref(STRING_NEURON_TYPE)
const templateAttributeValue = ref('')
const templateAttributeFlag = ref(false)

const value = ref('')
const name = ref('')

// An in-progress child being typed directly on a graph node. null when no
// node is accepting input.
const draft = shallowRef<{ parentId: string | null } | null>(null)
const draftValue = ref('')
// What the neuron will be. Chosen once, when it is made: a neuron's type is
// what it is, and nothing changes it afterwards.
const draftType = ref(OBJECT_NEURON_TYPE)

// The table renames in place, on the name cell itself. The graph renames on the
// node, which is the editor once it is selected.
const editing = shallowRef<{ neuron: Neuron } | null>(null)
const editValue = ref('')

// Attributes of the open neuron only: it is alone in its column, so it can grow
// without pushing anything else around.
const attributes = shallowRef<ResolvedAttribute[]>([])

// Editing the open neuron happens on the node itself: the selected node is the
// editor, so a name, its attributes and the row that adds one all live there.
const attributeDraftOpen = ref(false)
const attributeName = ref('')
const attributeValue = ref('')
const attributeFlag = ref(false)
const attributeType = ref(STRING_NEURON_TYPE)

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

// Open only while there is something to change. A connection that works is one
// line of text, not four fields.
const connectionOpen = ref(false)

const connectionSummary = computed(() => {
  if (!isRemote.value) return 'local database'
  const who = connection.value?.user ?? username.value
  return `${who} @ ${url.value.trim().replace(/^https?:\/\//, '')}`
})
const isRemote = computed(() => url.value.trim().length > 0)
const currentNeuron = computed(() => trail.value.at(-1) ?? null)

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

// What a neuron is called: its name, or failing that whatever it holds.
// The root is where the tree stops, and the URL says that by leaving the id
// out, so it never appears as an ancestor or a parent link.
function parentIdInUrl(neuron: Neuron): string | null {
  return neuron.parentId === NEURON_ROOT_ID ? null : neuron.parentId
}

function labelOf(neuron: Neuron): string {
  if (neuron.name !== null) return neuron.name
  const value = displayValue(neuron)
  return value.length > 0 ? value : neuron.id
}

// A neuron's content as text. An object has none of its own — it is its
// attributes — so it reads as empty here.
function displayValue(neuron: Neuron): string {
  if (neuron instanceof StringNeuron) return neuron.value
  if (neuron instanceof BooleanNeuron) return neuron.value ? 'true' : 'false'
  return ''
}

// The second line carries the neuron's content, not its type: `string` on every
// node says nothing. A named neuron shows what it holds under its name; an
// unnamed one is already showing that as its label.
function detailOf(neuron: Neuron): string {
  return neuron.name === null ? '' : displayValue(neuron)
}

function readIdFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('id')
}

// The view and the subject are read off their refs rather than passed in, so a
// caller only has to say which id it is moving to.
function writeUrl(id: string | null, replace = false): void {
  const next = new URL(window.location.href)
  if (id === null) next.searchParams.delete('id')
  else next.searchParams.set('id', id)
  if (view.value === 'table') next.searchParams.delete('view')
  else next.searchParams.set('view', view.value)
  if (subject.value === 'neurons') next.searchParams.delete('subject')
  else next.searchParams.set('subject', subject.value)
  if (next.href === window.location.href) return
  if (replace) history.replaceState({}, '', next)
  else history.pushState({}, '', next)
}

function readViewFromUrl(): ViewMode {
  return new URL(window.location.href).searchParams.get('view') === 'graph' ? 'graph' : 'table'
}

function readSubjectFromUrl(): Subject {
  return new URL(window.location.href).searchParams.get('subject') === 'types' ? 'types' : 'neurons'
}

function setView(mode: ViewMode): void {
  view.value = mode
  writeUrl(currentId.value)
}

// Switching subject starts at the top: an id from one side names nothing on
// the other.
async function setSubject(next: Subject): Promise<void> {
  if (subject.value === next) return
  cancelDraft()
  cancelAttributeDraft()
  cancelTemplateAttributeDraft()
  subject.value = next
  currentId.value = null
  writeUrl(null)
  await refresh()
}

async function open(id: string | null): Promise<void> {
  // A half-typed attribute belongs to the neuron it was started on.
  cancelAttributeDraft()
  cancelTemplateAttributeDraft()
  writeUrl(id)
  currentId.value = id
  await refresh()
}

// Back/forward move between neurons, so the URL is the source of truth.
async function onPopState(): Promise<void> {
  currentId.value = readIdFromUrl()
  view.value = readViewFromUrl()
  subject.value = readSubjectFromUrl()
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
    // It worked, so there is nothing left to fill in.
    connectionOpen.value = false
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
  subject.value = readSubjectFromUrl()
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
  let cursor: Neuron | null = await database.value.get(id)
  if (cursor === null) return null

  // Guarded against a parent_id cycle, which would otherwise spin forever.
  while (cursor !== null && !seen.has(cursor.id) && chain.length < MAX_TRAIL_DEPTH) {
    seen.add(cursor.id)
    chain.unshift(cursor)
    // An attribute value hangs off its owner instead of a parent, so that is
    // the way up for it. Without this a value opened from its owner's editor
    // would look like a root neuron with nothing above it. The climb stops at the
    // root, which the breadcrumb draws as 🧠 rather than as an ancestor.
    const above: string | null = cursor.parentId ?? cursor.attributeOf
    cursor = above === null || above === NEURON_ROOT_ID ? null : await database.value.get(above)
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
    change.parentId === openParentId.value ||
    change.previousParentId === openParentId.value ||
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
        if (subject.value === 'neurons' && affectsCurrentLevel(change)) scheduleRefresh()
      },
      // A type can be made while neurons are showing, and the picker has to
      // know about it either way.
      template: () => scheduleRefresh(),
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
  if (subject.value === 'types') return refreshTypes(database.value)

  busy.value = true
  error.value = ''
  try {
    currentTemplate.value = null
    // The picker offers them even here, so they are loaded on both sides.
    templates.value = await database.value.listTemplates()
    const chain = await buildTrail(currentId.value)

    // An id in the URL outlives the neuron it names, and means nothing in
    // another database — switch databases and the one you were in is gone.
    // Neither is the user's mistake, so the page drops to the root level
    // without saying anything, replacing the history entry so Back does not
    // lead to the same dead id.
    if (chain === null) {
      currentId.value = null
      writeUrl(null, true)
    }

    trail.value = chain ?? []
    neurons.value = await database.value.listByParentId(openParentId.value)
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

// Types are a flat list, not a tree: there is no trail to build and nothing
// below one but its own attributes.
async function refreshTypes(db: Database): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    templates.value = await db.listTemplates()
    const open = currentId.value === null ? null : await db.getTemplate(currentId.value)

    // Same rule as a dead neuron id: fall back to the top without complaining.
    if (currentId.value !== null && open === null) {
      currentId.value = null
      writeUrl(null, true)
    }

    currentTemplate.value = open
    templateAttributes.value = open === null ? [] : await db.resolveTemplateAttributes(open)
    // A type's children are the documents made from it.
    neurons.value = open === null ? [] : await db.listByTemplateId(open.id)
    trail.value = []
    attributes.value = []
  } catch (cause) {
    error.value = describe(cause)
    templates.value = []
    currentTemplate.value = null
    templateAttributes.value = []
    neurons.value = []
  } finally {
    busy.value = false
  }
}

const typeChoices = computed<TypeChoice[]>(() => [
  { value: STRING_NEURON_TYPE, label: STRING_NEURON_TYPE, templateId: null },
  { value: BOOLEAN_NEURON_TYPE, label: BOOLEAN_NEURON_TYPE, templateId: null },
  ...templates.value.map((template) => ({
    value: template.id,
    label: template.name ?? template.id,
    templateId: template.id
  }))
])

function templateOf(choice: string): Template | null {
  if (choice.length === 0) return null
  return templates.value.find((template) => template.id === choice) ?? null
}

// A type the user made has a name to ask for instead of a value to type.
function isTemplateChoice(choice: string): boolean {
  return templateOf(choice) !== null
}

// What a node says it is. Nothing for the top level, for a draft, or for a
// plain object — an object is what a neuron is when it is nothing more.
function typeTagOf(source: GraphSource): string {
  if (source.neuron === null) return ''
  const label = typeLabelOf(source.neuron)
  return label === OBJECT_NEURON_TYPE ? '' : label
}

function typeLabelOf(neuron: Neuron): string {
  if (!(neuron instanceof ObjectNeuron) || neuron.templateId === null) return neuron.type
  return templateOf(neuron.templateId)?.name ?? neuron.type
}

function templateAttributeTypeLabel(attribute: TemplateAttribute): string {
  if (attribute.templateId === null) return attribute.type
  return templateOf(attribute.templateId)?.name ?? attribute.type
}

// An object stands for itself: what there is to show is its name.
function attributeValueText(neuron: Neuron): string {
  if (neuron instanceof ObjectNeuron) return neuron.name ?? ''
  return displayValue(neuron)
}

function attributeSummary(template: Template): string {
  const count = template.attributes.length
  const extended = template.extendsId === null ? '' : ` · extends ${extendsLabel(template)}`
  if (count === 0) return `no attributes of its own${extended}`
  return `${count === 1 ? '1 attribute' : `${count} attributes`}${extended}`
}

function extendsLabel(template: Template): string {
  if (template.extendsId === null) return ''
  return templateOf(template.extendsId)?.name ?? template.extendsId
}

// A type can extend anything but itself. Core refuses one that already extends
// it; this list only keeps the obvious case out of the menu.
const extendsChoices = computed(() =>
  templates.value.filter((template) => template.id !== currentTemplate.value?.id)
)

async function setTemplateExtends(event: Event): Promise<void> {
  const select = event.target
  const template = currentTemplate.value
  const db = database.value
  if (!(select instanceof HTMLSelectElement) || template === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.setTemplateExtends(template, select.value.length === 0 ? null : select.value)
    await refresh()
  } catch (cause) {
    error.value = describe(cause)
    await refresh()
  } finally {
    busy.value = false
  }
}

async function createNeuronIn(
  parentId: string | null,
  neuronName: string,
  neuronValue: string,
  type: string = OBJECT_NEURON_TYPE
): Promise<boolean> {
  const db = database.value
  if (db === null || neuronName.trim().length === 0) return false
  busy.value = true
  error.value = ''
  try {
    // A name with nothing in it is a thing, not a piece of text: the tree is
    // made of objects, and a string neuron is one that actually holds a value.
    // Creating here always files the neuron somewhere, so no parent means the
    // top of the tree rather than nowhere.
    const parent = parentId ?? NEURON_ROOT_ID
    const template = templateOf(type)

    if (template !== null) {
      await db.createFromTemplate(template, { name: neuronName, parentId: parent })
    } else {
      const neuron =
        neuronValue.length === 0
          ? ObjectNeuron.create({ name: neuronName, parentId: parent })
          : StringNeuron.create({ name: neuronName, value: neuronValue, parentId: parent })
      await db.create(neuron)
    }
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
  draftType.value = OBJECT_NEURON_TYPE
  // Only ever one draft input exists, and it has to be in the document before
  // it can take focus.
  await nextTick()
  document.querySelector<HTMLInputElement>('.draft-input')?.focus()
}


function cancelDraft(): void {
  draft.value = null
  draftValue.value = ''
}

// The selected node is the editor. The top level is not a neuron and a draft is
// not one yet, so neither becomes one: the root keeps the database menu, and a
// draft keeps its single input.
function isEditorNode(source: GraphSource): boolean {
  if (source.isDraft || !source.isCurrent) return false
  return source.neuron !== null || source.template !== null
}

// The editor carries a table, so it is wider than a plain node. The gap d3
// leaves between columns is wide enough to take the difference.
function nodeWidthOf(source: GraphSource): number {
  return isEditorNode(source) ? EDITOR_WIDTH : NODE_WIDTH
}

// The editor grows with its rows. Nothing else shares its column, so nothing
// has to move out of the way.
function nodeHeightOf(source: GraphSource): number {
  // The root node carries the menu wherever it is drawn, open or as a parent.
  if (source.isRoot && !source.isDraft) return NODE_HEIGHT + ROOT_MENU_HEIGHT
  if (!isEditorNode(source)) return NODE_HEIGHT
  return editorHeight(source)
}

// An empty table still shows a row — "No attributes yet" — so the box never
// collapses onto its own heading.
function editorRowCount(source: GraphSource): number {
  const rows =
    source.template === null
      ? attributes.value.length + (attributeDraftOpen.value ? 1 : 0)
      : templateAttributes.value.length + (templateAttributeDraftOpen.value ? 1 : 0)
  return Math.max(rows, 1)
}

// Adding the parts up rather than measuring them: a foreignObject clips at the
// height it is given, so the height has to be known before the box is drawn.
function editorHeight(source: GraphSource): number {
  // Name, id, table and the add button — and for a type, what it extends.
  const blocks = source.template === null ? 4 : 5
  return (
    EDITOR_PADDING * 2 +
    EDITOR_GAP * (blocks - 1) +
    EDITOR_HEAD_HEIGHT +
    EDITOR_ID_HEIGHT +
    (source.template === null ? 0 : EDITOR_EXTENDS_HEIGHT) +
    EDITOR_TABLE_HEAD_HEIGHT +
    editorRowCount(source) * EDITOR_ROW_HEIGHT +
    EDITOR_ADD_HEIGHT
  )
}

async function renameCurrentNeuron(name: string): Promise<void> {
  const owner = currentNeuron.value
  const db = database.value
  if (owner === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.rename(owner, name)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function focusAttributeName(): void {
  document.querySelector<HTMLInputElement>('.attribute-name-input')?.focus()
}

function openAttributeDraft(): void {
  attributeDraftOpen.value = true
  attributeName.value = ''
  attributeValue.value = ''
  attributeFlag.value = false
  attributeType.value = STRING_NEURON_TYPE
  void nextTick(() => focusAttributeName())
}

function cancelAttributeDraft(): void {
  attributeDraftOpen.value = false
  attributeName.value = ''
  attributeValue.value = ''
  attributeFlag.value = false
}

function draftedValue(): Neuron {
  const template = templateOf(attributeType.value)
  if (template !== null) {
    // The typed text is the new neuron's name, not a value: a type says what
    // the neuron holds, and that is filled in from the type itself.
    return ObjectNeuron.create({ name: attributeValue.value, templateId: template.id })
  }
  if (attributeType.value === BOOLEAN_NEURON_TYPE) {
    return BooleanNeuron.create({ value: attributeFlag.value })
  }
  return StringNeuron.create({ value: attributeValue.value })
}

async function commitAttributeDraft(): Promise<void> {
  const owner = currentNeuron.value
  if (owner === null || database.value === null) return
  if (attributeName.value.trim().length === 0) return

  busy.value = true
  error.value = ''
  try {
    const value = draftedValue()
    await database.value.setAttribute(owner, attributeName.value, value)

    // Saved first, so the attributes the type brings with it hang off a neuron
    // that already exists.
    const template = templateOf(attributeType.value)
    if (template !== null) await database.value.applyTemplate(value, template)
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

// One value per name, so writing a new value replaces the neuron that held the
// old one. Core soft deletes it, which keeps the change in the history. The
// replacement is built by the caller, which is what keeps the type from
// drifting to whatever the editor happened to produce.
async function setAttributeValue(attribute: ResolvedAttribute, value: Neuron): Promise<void> {
  const owner = currentNeuron.value
  const db = database.value
  if (owner === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.setAttribute(owner, attribute.name, value)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function setStringValue(attribute: ResolvedAttribute, value: string): void {
  void setAttributeValue(attribute, StringNeuron.create({ value }))
}

// An object is not replaced when its text changes: the text is its name, and
// everything it holds is still its own.
async function setObjectName(attribute: ResolvedAttribute, name: string): Promise<void> {
  const db = database.value
  if (db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.rename(attribute.neuron, name)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function isObject(neuron: Neuron): boolean {
  return neuron instanceof ObjectNeuron
}

function setBooleanValue(attribute: ResolvedAttribute, value: boolean): void {
  void setAttributeValue(attribute, BooleanNeuron.create({ value }))
}

// Only the owner's entry moves, so the value keeps its id and its type. Core
// refuses a name that is already taken; the check here exists only to say so in
// words that name the neuron.
async function renameAttribute(attribute: ResolvedAttribute, name: string): Promise<void> {
  const owner = currentNeuron.value
  const db = database.value
  if (owner === null || db === null) return

  const next = name.trim()
  if (next.length === 0 || next === attribute.name) return
  if (attributes.value.some((entry) => entry.name === next)) {
    error.value = `${labelOf(owner)} already has an attribute named ${next}`
    return
  }

  busy.value = true
  error.value = ''
  try {
    await db.renameAttribute(owner, attribute.name, next)
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
// Clicking the type picker moves focus out of the name, which must not be read
// as clicking away from an empty draft.
function cancelEmptyDraft(event: FocusEvent): void {
  const next = event.relatedTarget
  if (next instanceof HTMLElement && next.closest('.node-draft') !== null) return
  if (draftValue.value.trim().length === 0) cancelDraft()
}

function isPendingDelete(id: string | null): boolean {
  return id !== null && pendingDelete.value?.id === id
}

function confirmDelete(source: GraphSource): void {
  if (source.template !== null) {
    void deleteTemplate(source.template)
    return
  }
  if (source.neuron !== null) void deleteNeuron(source.neuron)
}

async function askDelete(id: string): Promise<void> {
  cancelDraft()
  pendingDelete.value = { id, hasChildren: false }
  // A type owns no tree, so there is nothing to warn about.
  if (database.value === null || subject.value === 'types') return
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
    if (neuron.id === currentId.value) await open(parentIdInUrl(neuron))
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function commitDraft(): Promise<void> {
  const pending = draft.value
  if (pending === null) return
  if (subject.value === 'types') {
    if (await createTemplate(draftValue.value)) cancelDraft()
    return
  }
  if (await createNeuronIn(pending.parentId, draftValue.value, '', draftType.value)) cancelDraft()
}

async function createTemplate(name: string): Promise<boolean> {
  const db = database.value
  if (db === null || name.trim().length === 0) return false
  busy.value = true
  error.value = ''
  try {
    const template = await db.createTemplate(Template.create({ name }))
    // Straight into the new type, the way creating a neuron opens its parent:
    // a type with no attributes is not finished, and opening it is what puts
    // the editor on it.
    await open(template.id)
    return true
  } catch (cause) {
    error.value = describe(cause)
    return false
  } finally {
    busy.value = false
  }
}

// "Create Type" is the root node's own create button, so it leaves the types
// tree showing and puts the draft where a first-level child would go.
async function createTypeFromBar(): Promise<void> {
  if (await createTemplate(draftValue.value)) draftValue.value = ''
}

// Opening a type from the table goes straight to its editor, which is the only
// thing there is to see of one.
// A document listed under its type is a neuron, so following one crosses back
// rather than pretending a neuron lives on the types side.
async function openNeuron(id: string | null): Promise<void> {
  if (subject.value !== 'types') {
    await open(id)
    return
  }
  cancelDraft()
  cancelAttributeDraft()
  cancelTemplateAttributeDraft()
  subject.value = 'neurons'
  currentId.value = id
  writeUrl(id)
  await refresh()
}

async function openNode(source: GraphSource): Promise<void> {
  if (source.isCurrent || source.isDraft) return
  if (source.neuron !== null) {
    await openNeuron(source.id)
    return
  }
  await open(source.id)
}

async function openType(template: Template): Promise<void> {
  await open(template.id)
  // The editor is the node itself, so opening a type goes to the drawing.
  setView('graph')
}

async function startTemplateDraft(): Promise<void> {
  if (subject.value !== 'types') await setSubject('types')
  openDraft(null)
}

async function renameCurrentTemplate(name: string): Promise<void> {
  const template = currentTemplate.value
  const db = database.value
  if (template === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.renameTemplate(template, name)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function deleteTemplate(template: Template): Promise<void> {
  const db = database.value
  if (db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.deleteTemplate(template)
    pendingDelete.value = null
    if (currentId.value === template.id) await open(null)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function openTemplateAttributeDraft(): void {
  templateAttributeDraftOpen.value = true
  templateAttributeName.value = ''
  templateAttributeType.value = STRING_NEURON_TYPE
  templateAttributeValue.value = ''
  templateAttributeFlag.value = false
  void nextTick(() => focusAttributeName())
}

function cancelTemplateAttributeDraft(): void {
  templateAttributeDraftOpen.value = false
  templateAttributeName.value = ''
  templateAttributeValue.value = ''
  templateAttributeFlag.value = false
}

// The default is optional: an empty text box means the attribute starts with
// nothing, which is not the same as starting with an empty string.
function draftedDefault(): TemplateDefault {
  if (templateAttributeType.value === BOOLEAN_NEURON_TYPE) return templateAttributeFlag.value
  return templateAttributeValue.value.length === 0 ? null : templateAttributeValue.value
}

async function writeTemplateAttribute(attribute: TemplateAttribute): Promise<void> {
  const template = currentTemplate.value
  const db = database.value
  if (template === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.setTemplateAttribute(template, attribute)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function commitTemplateAttributeDraft(): Promise<void> {
  if (templateAttributeName.value.trim().length === 0) return
  const template = templateOf(templateAttributeType.value)

  // An attribute of a user-defined type is an object that names the type. It
  // has no default to carry: the neuron is built when one is made.
  await writeTemplateAttribute(
    template === null
      ? {
          name: templateAttributeName.value,
          type: templateAttributeType.value,
          templateId: null,
          defaultValue: draftedDefault()
        }
      : {
          name: templateAttributeName.value,
          type: OBJECT_NEURON_TYPE,
          templateId: template.id,
          defaultValue: null
        }
  )
  cancelTemplateAttributeDraft()
}

function setTemplateAttributeDefault(attribute: TemplateAttribute, value: string): void {
  void writeTemplateAttribute({ ...attribute, defaultValue: value.length === 0 ? null : value })
}

function onTemplateFlagChange(attribute: TemplateAttribute, event: Event): void {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  void writeTemplateAttribute({ ...attribute, defaultValue: input.checked })
}

async function renameTemplateAttribute(
  attribute: TemplateAttribute,
  name: string
): Promise<void> {
  const template = currentTemplate.value
  const db = database.value
  if (template === null || db === null) return

  const next = name.trim()
  if (next.length === 0 || next === attribute.name) return

  busy.value = true
  error.value = ''
  try {
    await db.renameTemplateAttribute(template, attribute.name, next)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

async function removeTemplateAttribute(name: string): Promise<void> {
  const template = currentTemplate.value
  const db = database.value
  if (template === null || db === null) return

  busy.value = true
  error.value = ''
  try {
    await db.removeTemplateAttribute(template, name)
  } catch (cause) {
    error.value = describe(cause)
  } finally {
    busy.value = false
  }
}

function templateDefaultText(attribute: TemplateAttribute): string {
  return typeof attribute.defaultValue === 'string' ? attribute.defaultValue : ''
}

function templateDefaultFlag(attribute: TemplateAttribute): boolean {
  return attribute.defaultValue === true
}

function definedByLabel(entry: InheritedAttribute): string {
  return templateOf(entry.definedBy)?.name ?? entry.definedBy
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
      neuron: null,
      template: null,
      connector: null
    },
    ...children
  ]
}

// At the top the types sit under the root; open one and it takes the middle,
// with the documents made from it below — the same shape the neuron tree has.
function typeGraphSource(): GraphSource {
  const open = currentTemplate.value
  const children: GraphSource[] =
    open === null
      ? templates.value.map((template) => typeSource(template, false, []))
      : [
          typeSource(
            open,
            true,
            neurons.value.map((neuron) => ({
              id: neuron.id,
              label: labelOf(neuron),
              detail: detailOf(neuron),
              isCurrent: false,
              isDraft: false,
              isRoot: false,
              neuron,
              template: null,
              connector: null,
              children: []
            }))
          )
        ]

  // What a type extends is drawn where a parent is drawn, so the slot the tree
  // already has carries the hierarchy and the documents stay the children.
  const extended = open === null ? null : (templateOf(open.extendsId ?? '') ?? null)
  if (extended !== null) {
    return typeSource(extended, false, children)
  }

  return {
    id: null,
    label: ROOT_LABEL,
    detail: ROOT_TYPES_DETAIL,
    isCurrent: open === null && currentId.value === null,
    isDraft: false,
    isRoot: true,
    neuron: null,
    template: null,
    connector: null,
    children: withDraft(null, children)
  }
}

function typeSource(
  template: Template,
  isCurrent: boolean,
  children: GraphSource[]
): GraphSource {
  return {
    id: template.id,
    label: template.name ?? template.id,
    detail: attributeSummary(template),
    isCurrent,
    isDraft: false,
    isRoot: false,
    neuron: null,
    template,
    connector: null,
    children
  }
}

const graph = computed(() => {
  // The trail is root-first with the open neuron last, so its parent is the
  // entry before it; a root neuron falls back to the synthetic root node.
  const parentNeuron = trail.value.at(-2) ?? null
  const parentId = parentNeuron?.id ?? null

  // The open neuron reaches its parent either as a child or as one of its
  // attributes, and only the second has something to say about itself.
  const openId = currentNeuron.value?.id ?? null
  const connector =
    parentNeuron === null || openId === null
      ? null
      : (parentNeuron.attributes.find((attribute) => attribute.id === openId)?.name ?? null)

  const openSource: GraphSource = {
    id: currentId.value,
    label: currentNeuron.value === null ? ROOT_LABEL : labelOf(currentNeuron.value),
    detail: currentNeuron.value === null ? ROOT_DETAIL : detailOf(currentNeuron.value),
    isCurrent: true,
    isDraft: false,
    isRoot: currentNeuron.value === null,
    neuron: currentNeuron.value,
    template: null,
    connector,
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
        template: null,
        connector: null,
        children: withDraft(neuron.id, [])
      }))
    )
  }

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
          template: null,
          connector: null,
          children: withDraft(parentId, [openSource])
        }

  const layout = tree<GraphSource>().nodeSize([NODE_GAP_VERTICAL, NODE_GAP_HORIZONTAL])
  const root = layout(hierarchy(subject.value === 'types' ? typeGraphSource() : source))
  const nodes = root.descendants()

  // d3 puts depth in y and sibling offset in x; swapping them lays the tree
  // out left to right, which suits long text labels.
  const lefts = nodes.map((node) => node.y - nodeWidthOf(node.data) / 2)
  const rights = nodes.map((node) => node.y + nodeWidthOf(node.data) / 2)
  const tops = nodes.map((node) => node.x - nodeHeightOf(node.data) / 2)
  const bottoms = nodes.map((node) => node.x + nodeHeightOf(node.data) / 2)
  const minVertical = Math.min(...tops) - NODE_HEIGHT / 2
  const maxVertical = Math.max(...bottoms) + NODE_HEIGHT / 2
  const minHorizontal = Math.min(...lefts)
  const maxHorizontal = Math.max(...rights)

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

// The curve is symmetric, so its halfway point is the midpoint of the two ends.
function linkMidpoint(link: {
  source: { x: number; y: number }
  target: { x: number; y: number }
}): { x: number; y: number } {
  return {
    x: (link.source.y + link.target.y) / 2,
    y: (link.source.x + link.target.x) / 2
  }
}

// The editor is wider than the rest, so each end of the curve leaves from the
// edge of the node it is attached to rather than from a shared half-width.
function linkPath(link: {
  source: { x: number; y: number; data: GraphSource }
  target: { x: number; y: number; data: GraphSource }
}): string {
  const startX = link.source.y + nodeWidthOf(link.source.data) / 2
  const endX = link.target.y - nodeWidthOf(link.target.data) / 2
  const midX = (startX + endX) / 2
  return `M${startX},${link.source.x}C${midX},${link.source.x} ${midX},${link.target.x} ${endX},${link.target.x}`
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}\u2026` : text
}

function isBoolean(neuron: Neuron): boolean {
  return neuron instanceof BooleanNeuron
}

function flagOf(neuron: Neuron): boolean {
  return neuron instanceof BooleanNeuron && neuron.value
}

// The checkbox carries the write, so it reads the new state off the event
// rather than holding a copy the change feed would have to agree with.
function onFlagChange(attribute: ResolvedAttribute, event: Event): void {
  const input = event.target
  if (input instanceof HTMLInputElement) setBooleanValue(attribute, input.checked)
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
      <!-- Once it is connected the form has nothing left to say, so it folds
           into what it connected to. Disconnected, there is nothing to fold. -->
      <button
        v-if="isConnected"
        class="connection-toggle"
        :class="{ on: connectionOpen }"
        :title="connectionOpen ? 'Hide the connection' : 'Change the connection'"
        @click="connectionOpen = !connectionOpen"
      >
        {{ connectionSummary }}
        <span class="caret">{{ connectionOpen ? '\u25B4' : '\u25BE' }}</span>
      </button>

      <template v-if="connectionOpen || !isConnected">
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
    </template>

    <span class="status" :class="isConnected ? 'ok' : 'off'">
      {{ isConnected ? (isRemote ? 'remote' : 'local') : 'disconnected' }}
    </span>
    <span class="status">
      v5.1
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

      <template v-if="view === 'table' && subject === 'types' && currentTemplate === null">
        <input
          v-model="draftValue"
          placeholder="type name"
          size="26"
          @keyup.enter="createTypeFromBar"
        />
        <button :disabled="busy || draftValue.trim().length === 0" @click="createTypeFromBar">
          Create Type
        </button>
      </template>

      <!-- Creating a neuron here would hang it off whatever is open, and on the
           types side that is a type, not a parent. -->
      <template v-else-if="view === 'table' && subject === 'neurons'">
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

      <span class="toggle subject">
        <button :class="{ active: subject === 'neurons' }" @click="setSubject('neurons')">
          Neurons
        </button>
        <button :class="{ active: subject === 'types' }" @click="setSubject('types')">Types</button>
      </span>

      <span v-if="subject === 'types' && currentTemplate" class="count">
        {{ neurons.length }} document{{ neurons.length === 1 ? '' : 's' }}
      </span>
      <span v-else-if="subject === 'types'" class="count">
        {{ templates.length }} type{{ templates.length === 1 ? '' : 's' }}
      </span>
      <span v-else class="count">
        {{ neurons.length }} child{{ neurons.length === 1 ? '' : 'ren' }}
      </span>
    </div>

    <nav v-if="subject === 'types'" class="trail">
      <button class="crumb root" :class="{ current: currentTemplate === null }" @click="open(null)">
        {{ ROOT_LABEL }}
      </button>
      <template v-if="currentTemplate">
        <span class="sep">/</span>
        <button class="crumb current">{{ currentTemplate.name ?? currentTemplate.id }}</button>
      </template>
    </nav>

    <nav v-else class="trail">
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

    <section v-if="currentNeuron && view === 'table' && subject === 'neurons'" class="details">
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
              v-if="parentIdInUrl(currentNeuron) !== null"
              class="open"
              @click="open(parentIdInUrl(currentNeuron))"
            >
              {{ parentIdInUrl(currentNeuron) }}
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

    <div
      v-if="view === 'table' && subject === 'types' && currentTemplate === null"
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>attributes</th>
            <th>created by</th>
            <th>created at</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="template in templates" :key="template.id">
            <td>
              <button class="open" :title="`Open ${template.id}`" @click="openType(template)">
                {{ shorten(template.id) }}
              </button>
            </td>
            <td class="name-cell">{{ template.name ?? '—' }}</td>
            <td>{{ attributeSummary(template) }}</td>
            <td>{{ template.createdBy ?? '—' }}</td>
            <td class="time">{{ formatTime(template.createdAt) }}</td>
            <td class="actions">
              <template v-if="isPendingDelete(template.id)">
                <span class="confirm-label">Delete?</span>
                <button class="confirm yes" :disabled="busy" @click="deleteTemplate(template)">
                  Yes
                </button>
                <button class="confirm no" :disabled="busy" @click="cancelDelete">No</button>
              </template>
              <button
                v-else
                class="trash"
                :disabled="busy"
                title="Delete type"
                @click="askDelete(template.id)"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M2.5 4h11M6 4V2.6a.6.6 0 0 1 .6-.6h2.8a.6.6 0 0 1 .6.6V4M4 4l.55 9.1a1 1 0 0 0 1 .9h4.9a1 1 0 0 0 1-.9L12 4M6.6 6.6v5M9.4 6.6v5"
                  />
                </svg>
              </button>
            </td>
          </tr>
          <tr v-if="templates.length === 0">
            <td colspan="6" class="empty">
              No types yet. Use <strong>Create Type</strong> to make one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="view === 'table'" class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>created by</th>
            <th>created at</th>
            <th>updated at</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="neuron in neurons" :key="neuron.id">
            <td>
              <button class="open" :title="`Open ${neuron.id}`" @click="openNeuron(neuron.id)">
                {{ shorten(neuron.id) }}
              </button>
            </td>
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
            <td colspan="6" class="empty">
              <template v-if="currentTemplate">
                Nothing has been made from
                <code>{{ currentTemplate.name ?? currentTemplate.id }}</code> yet.
              </template>
              <template v-else-if="currentNeuron">
                <code>{{ labelOf(currentNeuron) }}</code> has no children yet.
              </template>
              <template v-else>
                No neurons in <code>{{ databaseName }}</code> yet.
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="graph">
      <div class="canvas">
        <svg
          :viewBox="graph.viewBox"
          :width="graph.width"
          :height="graph.height"
          role="img"
          aria-label="Neuron tree"
        >
          <template v-for="(link, index) in graph.links" :key="index">
          <path class="edge" :d="linkPath(link)" />
          <text
            v-if="link.target.data.connector !== null"
            class="connector"
            :x="linkMidpoint(link).x"
            :y="linkMidpoint(link).y - 5"
          >
            {{ truncate(link.target.data.connector, 18) }}
          </text>
        </template>

          <g
            v-for="node in graph.nodes"
            :key="node.data.id ?? 'root'"
            class="node"
            :class="{
              current: node.data.isCurrent,
              draft: node.data.isDraft,
              clickable: !node.data.isCurrent && !node.data.isDraft
            }"
            :transform="`translate(${node.y - nodeWidthOf(node.data) / 2}, ${node.x - nodeHeightOf(node.data) / 2})`"
            @click="openNode(node.data)"
          >
            <rect :width="nodeWidthOf(node.data)" :height="nodeHeightOf(node.data)" rx="7" />

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
                  placeholder="name"
                  @keyup.enter="commitDraft"
                  @keyup.esc="cancelDraft"
                  @blur="cancelEmptyDraft"
                />
                <!-- A type is picked once, here. There is nowhere to change it
                     afterwards, because a neuron's type is what it is. -->
                <select
                  v-if="subject === 'neurons'"
                  v-model="draftType"
                  class="draft-type"
                  title="What it will be"
                  @keyup.enter="commitDraft"
                  @keyup.esc="cancelDraft"
                  @blur="cancelEmptyDraft"
                >
                  <option :value="OBJECT_NEURON_TYPE">object</option>
                  <option v-for="candidate in templates" :key="candidate.id" :value="candidate.id">
                    {{ candidate.name ?? candidate.id }}
                  </option>
                </select>

                <!-- Takes mousedown rather than focus, so the name never blurs
                     and the draft cannot close out from under the click. -->
                <button
                  class="draft-done"
                  title="Create"
                  :disabled="busy || draftValue.trim().length === 0"
                  @mousedown.prevent
                  @click="commitDraft"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.2 8.6 L6.4 11.8 L12.8 4.6" />
                  </svg>
                </button>
              </div>
            </foreignObject>

            <!-- Confirming covers the node itself. Anywhere beside it collides
                 with the children drawn in that space, which paint over it. -->
            <foreignObject
              v-else-if="
                isPendingDelete(node.data.id) &&
                !isEditorNode(node.data) &&
                (node.data.neuron !== null || node.data.template !== null)
              "
              :x="0"
              :y="0"
              :width="NODE_WIDTH"
              :height="NODE_HEIGHT"
              @click.stop
            >
              <div class="node-confirm">
                <span class="node-confirm-label">
                  <span class="node-confirm-title">Delete {{ truncate(node.data.label, 18) }}?</span>
                  <span v-if="pendingDelete?.hasChildren" class="node-confirm-note">
                    and everything inside
                  </span>
                </span>
                <button class="confirm yes" :disabled="busy" @click="confirmDelete(node.data)">
                  Yes
                </button>
                <button class="confirm no" :disabled="busy" @click="cancelDelete">No</button>
              </div>
            </foreignObject>

            <!-- The selected node is the editor: there is no second box
                 beside the drawing, so the node carries the name, what it is,
                 and its attributes. A type's rows hold the default a new
                 neuron starts with, which is all that differs between them. -->
            <foreignObject
              v-else-if="isEditorNode(node.data)"
              :x="0"
              :y="0"
              :width="nodeWidthOf(node.data)"
              :height="nodeHeightOf(node.data)"
              @click.stop
            >
              <div class="node-editor">
                <div class="editor-head">
                  <!-- Deletion takes the whole subtree, so it asks first, in
                       the row the name was in. -->
                  <template v-if="isPendingDelete(node.data.id)">
                    <span class="editor-confirm">
                      Delete {{ truncate(node.data.label, 14) }}<template
                        v-if="pendingDelete?.hasChildren"
                      >, and everything inside</template>?
                    </span>
                    <button class="confirm yes" :disabled="busy" @click="confirmDelete(node.data)">
                      Yes
                    </button>
                    <button class="confirm no" :disabled="busy" @click="cancelDelete">No</button>
                  </template>

                  <template v-else>
                    <EditableText
                      v-if="node.data.template !== null"
                      class="editor-name"
                      :value="currentTemplate?.name ?? ''"
                      empty="unnamed type"
                      placeholder="type name"
                      title="Rename"
                      :disabled="busy"
                      @submit="renameCurrentTemplate"
                    />
                    <EditableText
                      v-else
                      class="editor-name"
                      :value="currentNeuron?.name ?? ''"
                      empty="unnamed"
                      placeholder="name"
                      title="Rename"
                      :disabled="busy"
                      @submit="renameCurrentNeuron"
                    />

                    <!-- The round buttons the other nodes carry: on this one
                         they would be behind the editor, so they sit in its
                         own row instead. -->
                    <button
                      v-if="subject === 'neurons'"
                      class="editor-button"
                      :title="`Create inside ${node.data.label}`"
                      :disabled="busy"
                      @click="openDraft(node.data.id)"
                    >
                      +
                    </button>
                    <button
                      class="editor-button delete"
                      :title="`Delete ${node.data.label}`"
                      :disabled="busy"
                      @click="askDelete(node.data.id!)"
                    >
                      ×
                    </button>
                  </template>
                </div>

                <div class="editor-id">
                  <span v-if="typeTagOf(node.data) !== ''">{{ typeTagOf(node.data) }}</span>
                  <code>{{ node.data.id }}</code>
                </div>

                <template v-if="node.data.template !== null">
                  <label class="editor-extends">
                    extends
                    <select
                      :value="currentTemplate?.extendsId ?? ''"
                      :disabled="busy"
                      @change="setTemplateExtends"
                    >
                      <option value="">nothing</option>
                      <option
                        v-for="candidate in extendsChoices"
                        :key="candidate.id"
                        :value="candidate.id"
                      >
                        {{ candidate.name ?? candidate.id }}
                      </option>
                    </select>
                  </label>

                  <table class="editor-attributes">
                    <thead>
                      <tr>
                        <th>type</th>
                        <th>name</th>
                        <th>default</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- An inherited row belongs to the type that declares
                           it, so it is shown here and changed there. -->
                      <tr
                        v-for="entry in templateAttributes"
                        :key="entry.attribute.name"
                        :class="{ inherited: entry.inherited }"
                      >
                        <td class="type">
                          <code>{{ templateAttributeTypeLabel(entry.attribute) }}</code>
                        </td>
                        <td>
                          <span v-if="entry.inherited" :title="`from ${definedByLabel(entry)}`">
                            {{ entry.attribute.name }}
                          </span>
                          <EditableText
                            v-else
                            :value="entry.attribute.name"
                            placeholder="name"
                            title="Rename attribute"
                            :disabled="busy"
                            @submit="(name) => renameTemplateAttribute(entry.attribute, name)"
                          />
                        </td>
                        <td>
                          <span v-if="entry.attribute.templateId !== null" class="empty">
                            built then
                          </span>
                          <input
                            v-else-if="entry.attribute.type === BOOLEAN_NEURON_TYPE"
                            type="checkbox"
                            :checked="templateDefaultFlag(entry.attribute)"
                            :disabled="busy || entry.inherited"
                            @change="(event) => onTemplateFlagChange(entry.attribute, event)"
                          />
                          <span v-else-if="entry.inherited" class="empty">
                            {{ templateDefaultText(entry.attribute) || 'none' }}
                          </span>
                          <EditableText
                            v-else
                            :value="templateDefaultText(entry.attribute)"
                            placeholder="default"
                            empty="none"
                            title="Edit the default"
                            :disabled="busy"
                            @submit="(value) => setTemplateAttributeDefault(entry.attribute, value)"
                          />
                        </td>
                        <td class="actions">
                          <span
                            v-if="entry.inherited"
                            class="from"
                            :title="`from ${definedByLabel(entry)}`"
                          >
                            ↑
                          </span>
                          <button
                            v-else
                            class="attribute-remove"
                            :disabled="busy"
                            title="Remove attribute"
                            @click="removeTemplateAttribute(entry.attribute.name)"
                          >
                            ×
                          </button>
                        </td>
                      </tr>

                      <tr v-if="templateAttributeDraftOpen" class="draft">
                        <td class="type">
                          <select v-model="templateAttributeType" class="editor-input">
                            <option
                              v-for="choice in typeChoices"
                              :key="choice.value"
                              :value="choice.value"
                            >
                              {{ choice.label }}
                            </option>
                          </select>
                        </td>
                        <td>
                          <input
                            v-model="templateAttributeName"
                            class="editor-input attribute-name-input"
                            placeholder="name"
                            @keyup.enter="commitTemplateAttributeDraft"
                            @keyup.esc="cancelTemplateAttributeDraft"
                          />
                        </td>
                        <td>
                          <!-- A type is built when a neuron is made from it, so
                               there is nothing here to default to. -->
                          <span v-if="isTemplateChoice(templateAttributeType)" class="empty">
                            built then
                          </span>
                          <input
                            v-else-if="templateAttributeType === BOOLEAN_NEURON_TYPE"
                            v-model="templateAttributeFlag"
                            type="checkbox"
                            @keyup.enter="commitTemplateAttributeDraft"
                            @keyup.esc="cancelTemplateAttributeDraft"
                          />
                          <input
                            v-else
                            v-model="templateAttributeValue"
                            class="editor-input"
                            placeholder="default (optional)"
                            @keyup.enter="commitTemplateAttributeDraft"
                            @keyup.esc="cancelTemplateAttributeDraft"
                          />
                        </td>
                        <td class="actions">
                          <button
                            class="attribute-done"
                            title="Done"
                            @click="commitTemplateAttributeDraft"
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M3.2 8.6 L6.4 11.8 L12.8 4.6" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      <tr v-if="templateAttributes.length === 0 && !templateAttributeDraftOpen">
                        <td colspan="4" class="empty">No attributes yet.</td>
                      </tr>
                    </tbody>
                  </table>

                  <button
                    class="attribute-add"
                    :disabled="busy || templateAttributeDraftOpen"
                    @click="openTemplateAttributeDraft"
                  >
                    + Add attribute
                  </button>
                </template>

                <template v-else>
                  <table class="editor-attributes">
                    <thead>
                      <tr>
                        <th>type</th>
                        <th>name</th>
                        <th>value</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="attribute in attributes" :key="attribute.name">
                        <td class="type"><code>{{ typeLabelOf(attribute.neuron) }}</code></td>
                        <td>
                          <EditableText
                            :value="attribute.name"
                            placeholder="name"
                            title="Rename attribute"
                            :disabled="busy"
                            @submit="(name) => renameAttribute(attribute, name)"
                          />
                        </td>
                        <td>
                          <span v-if="isBoolean(attribute.neuron)" class="attribute-flag">
                            <input
                              type="checkbox"
                              :checked="flagOf(attribute.neuron)"
                              :disabled="busy"
                              @change="(event) => onFlagChange(attribute, event)"
                            />
                            <button
                              class="attribute-open"
                              title="Open this neuron"
                              @click="open(attribute.neuron.id)"
                            >
                              ↗
                            </button>
                          </span>

                          <EditableText
                            v-else-if="isObject(attribute.neuron)"
                            :value="attributeValueText(attribute.neuron)"
                            placeholder="name"
                            empty="unnamed"
                            title="Open this neuron"
                            link
                            :disabled="busy"
                            @follow="open(attribute.neuron.id)"
                            @submit="(name) => setObjectName(attribute, name)"
                          />

                          <EditableText
                            v-else
                            :value="displayValue(attribute.neuron)"
                            placeholder="value"
                            empty="empty"
                            title="Open this neuron"
                            link
                            :disabled="busy"
                            @follow="open(attribute.neuron.id)"
                            @submit="(value) => setStringValue(attribute, value)"
                          />
                        </td>
                        <td class="actions">
                          <button
                            class="attribute-remove"
                            :disabled="busy"
                            title="Remove attribute"
                            @click="removeAttribute(attribute.name)"
                          >
                            ×
                          </button>
                        </td>
                      </tr>

                      <tr v-if="attributeDraftOpen" class="draft">
                        <td class="type">
                          <select v-model="attributeType" class="editor-input">
                            <option
                              v-for="choice in typeChoices"
                              :key="choice.value"
                              :value="choice.value"
                            >
                              {{ choice.label }}
                            </option>
                          </select>
                        </td>
                        <td>
                          <input
                            v-model="attributeName"
                            class="editor-input attribute-name-input"
                            placeholder="name"
                            @keyup.enter="commitAttributeDraft"
                            @keyup.esc="cancelAttributeDraft"
                          />
                        </td>
                        <td>
                          <input
                            v-if="attributeType === BOOLEAN_NEURON_TYPE"
                            v-model="attributeFlag"
                            type="checkbox"
                            @keyup.enter="commitAttributeDraft"
                            @keyup.esc="cancelAttributeDraft"
                          />
                          <input
                            v-else
                            v-model="attributeValue"
                            class="editor-input"
                            :placeholder="isTemplateChoice(attributeType) ? 'name' : 'value'"
                            @keyup.enter="commitAttributeDraft"
                            @keyup.esc="cancelAttributeDraft"
                          />
                        </td>
                        <td class="actions">
                          <button class="attribute-done" title="Done" @click="commitAttributeDraft">
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M3.2 8.6 L6.4 11.8 L12.8 4.6" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      <tr v-if="attributes.length === 0 && !attributeDraftOpen">
                        <td colspan="4" class="empty">No attributes yet.</td>
                      </tr>
                    </tbody>
                  </table>

                  <button
                    class="attribute-add"
                    :disabled="busy || attributeDraftOpen"
                    @click="openAttributeDraft"
                  >
                    + Add attribute
                  </button>
                </template>
              </div>
            </foreignObject>

            <template v-else-if="!node.data.isDraft">
              <text
                :class="[node.data.isRoot ? 'root-mark' : 'name', { linked: node.data.neuron !== null }]"
                :x="18"
                :y="node.data.detail === '' ? 37 : 26"
              >
                {{ truncate(node.data.label, 24) }}
              </text>
              <text v-if="node.data.detail !== ''" :x="18" :y="NODE_DETAIL_BASELINE" class="detail">
                {{ truncate(node.data.detail, 24) }}
              </text>

              <!-- Barely there on purpose: it answers a question you only
                   sometimes have. A plain object says nothing, since that is
                   what a neuron is when it is not anything else. -->
              <text
                v-if="typeTagOf(node.data) !== ''"
                class="type-tag"
                :x="NODE_WIDTH - 16"
                :y="NODE_TAG_BASELINE"
                text-anchor="end"
              >
                {{ truncate(typeTagOf(node.data), 14) }}
              </text>
              <title>{{ node.data.id ?? 'Top level' }}</title>

              <!-- Everything that is about the whole database rather than one
                   neuron lives here, inside the node that stands for it. -->
              <foreignObject
                v-if="node.data.isRoot"
                :x="0"
                :y="NODE_HEIGHT - 8"
                :width="NODE_WIDTH"
                :height="ROOT_MENU_HEIGHT + 8"
                @click.stop
              >
                <div class="root-menu">
                  <span class="switch">
                    <button :class="{ on: subject === 'neurons' }" @click="setSubject('neurons')">
                      neurons
                    </button>
                    <button :class="{ on: subject === 'types' }" @click="setSubject('types')">
                      types
                    </button>
                  </span>
                  <button class="menu-action" :disabled="busy" @click="startTemplateDraft">
                    Create Type
                  </button>
                </div>
              </foreignObject>

              <g
                v-if="subject === 'neurons'"
                class="add"
                :class="{ disabled: busy }"
                :transform="`translate(${NODE_WIDTH - 26}, ${NODE_HEIGHT / 2})`"
                @click.stop="openDraft(node.data.id)"
              >
                <circle r="12" />
                <path d="M-5.5,0 H5.5 M0,-5.5 V5.5" />
                <title>Create inside {{ node.data.label }}</title>
              </g>

              <g
                v-if="node.data.neuron !== null || node.data.template !== null"
                class="remove"
                :class="{ disabled: busy }"
                :transform="`translate(${NODE_WIDTH - 56}, ${NODE_HEIGHT / 2})`"
                @click.stop="askDelete(node.data.id!)"
              >
                <circle r="12" />
                <path d="M-4,-4 L4,4 M4,-4 L-4,4" />
                <title>Delete {{ node.data.label }}</title>
              </g>
            </template>

          </g>
        </svg>

        <p v-if="subject === 'neurons' && neurons.length === 0" class="empty">
          Nothing below <code>{{ currentNeuron ? labelOf(currentNeuron) : databaseName }}</code> yet.
        </p>
      </div>

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

.connection-toggle {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 3px 10px;
  font-size: 12px;
}

.connection-toggle:hover,
.connection-toggle.on { color: var(--text); border-color: var(--accent); }
.connection-toggle .caret { margin-left: 4px; opacity: 0.7; }

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
  align-items: stretch;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  overflow: hidden;
  min-height: 260px;
  max-height: 70vh;
}

/* The tree scrolls on its own inside the box. Centring is `safe`, because a
   drawing wider than the box would otherwise be centred with its left edge
   spilling out of reach of the scrollbar. */
.canvas {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: safe center;
  justify-content: safe center;
  overflow: auto;
}

/* Inside the node, so it takes the whole box the layout gave it. Every part
   has a height fixed here, because `editorHeight` adds those heights up to
   decide how big the node is — a foreignObject clips what overflows it. The
   node's own rect draws the frame, so there is no border here. */
.node-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 8px 10px;
  overflow: hidden;
  color: var(--text);
  font: 12px ui-sans-serif, system-ui, sans-serif;
}

.editor-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.editor-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
}

/* The same two actions every other node carries as circles in its corner.
   Here the editor is in that corner, so they come inside it. */
.editor-button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel);
  color: var(--muted);
  font-size: 13px;
  line-height: 1;
}

.editor-button:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.editor-button.delete:hover:not(:disabled) {
  border-color: var(--danger);
  background: var(--danger);
}

.editor-confirm {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--danger);
}

.editor-id {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  gap: 6px;
  height: 15px;
  overflow: hidden;
  white-space: nowrap;
  color: var(--muted);
}

.editor-id code { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

.editor-extends {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  color: var(--muted);
}

.editor-extends select { flex: 1 1 auto; min-width: 0; padding: 1px 4px; font-size: 12px; }

/* Fixed layout, so a long value takes an ellipsis instead of squeezing the
   other two columns down to a letter each. */
.editor-attributes { flex: 0 0 auto; table-layout: fixed; }

.editor-attributes th,
.editor-attributes td {
  height: 27px;
  padding: 0 6px;
  font-size: 12px;
  overflow: hidden;
}

.editor-attributes th { height: 19px; font-size: 10px; }
.editor-attributes th:first-child,
.editor-attributes td.type { width: 72px; padding-left: 0; color: var(--muted); }
.editor-attributes td.type select { width: 100%; }

.editor-attributes tr.inherited td { color: var(--muted); }
.editor-attributes .from { color: var(--muted); cursor: help; }

/* The menu belongs to the whole database, so it lives in the node that stands
   for it rather than in the toolbar above the drawing. */
.root-menu {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 0 12px;
  font: 12px ui-sans-serif, system-ui, sans-serif;
}

.switch {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
}

.switch button {
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 9px;
  font: inherit;
}

.switch button.on { background: var(--accent); color: #fff; }

.menu-action {
  margin-left: auto;
  border: 1px dashed var(--border);
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 8px;
  font: inherit;
}

.menu-action:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }

.attribute-flag { display: flex; align-items: center; gap: 6px; }
.attribute-flag input { margin: 0; accent-color: var(--accent); }

.attribute-open {
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  line-height: 1;
}
.editor-attributes th:last-child,
.editor-attributes td.actions { width: 20px; padding: 0; }
.editor-attributes tr:last-child td { border-bottom: none; }
.editor-attributes .empty { text-align: center; }

.editor-input {
  width: 100%;
  min-width: 0;
  padding: 2px 4px;
  border: none;
  border-bottom: 1px solid var(--accent);
  border-radius: 0;
  background: transparent;
  outline: none;
  font-size: 12px;
}

.attribute-done {
  display: inline-flex;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  line-height: 0;
}

.attribute-done svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.attribute-done:hover { color: var(--ok); }

/* The drawing keeps the size it was laid out at. Letting it shrink to the box
   would undo the node size at exactly the moment there is a lot to look at —
   the canvas scrolls instead. */
.graph svg { display: block; }

.edge {
  fill: none;
  stroke: var(--border);
  stroke-width: 1.5;
}

/* Painted over the curve, so it is stroked with the background first. */
.connector {
  fill: var(--muted);
  font-size: 10px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  text-anchor: middle;
  paint-order: stroke;
  stroke: var(--panel);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.node rect {
  fill: var(--bg);
  stroke: var(--border);
}

.node text {
  fill: var(--text);
  font-size: 15px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.node text.detail { fill: var(--muted); font-size: 12px; }
.node text.type-tag { fill: var(--muted); font-size: 10px; opacity: 0.55; }
.node text.root-mark { font-size: 20px; }

/* A name with a neuron behind it selects it; the top level has none. */
.node text.linked { cursor: pointer; }
.node text.linked:hover { text-decoration: underline; text-underline-offset: 2px; }

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
  padding: 0 10px;
  border: 1px solid var(--danger);
  border-radius: 7px;
  background: var(--bg);
  color: var(--text);
  font: 13px ui-sans-serif, system-ui, sans-serif;
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

.attribute-remove {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.attribute-remove:hover { color: var(--danger); }

.attribute-add {
  flex: 0 0 auto;
  align-self: flex-start;
  height: 24px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 5px;
  color: var(--muted);
  cursor: pointer;
  padding: 0 8px;
  text-align: left;
  font-size: 12px;
}

.attribute-add:hover { border-color: var(--accent); color: var(--accent); }

.node-draft {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 0 10px;
}

.draft-done {
  flex: 0 0 auto;
  display: inline-flex;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  line-height: 0;
}

.draft-done svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.draft-done:hover:not(:disabled) { color: var(--ok); }
.draft-done:disabled { color: var(--muted); opacity: 0.4; cursor: default; }

.draft-type {
  flex: 0 0 auto;
  max-width: 40%;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--muted);
  padding: 2px 4px;
  font: 12px ui-sans-serif, system-ui, sans-serif;
}

.draft-type:hover { color: var(--text); }

.draft-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  padding: 0;
  font: 15px ui-sans-serif, system-ui, sans-serif;
}

.graph .empty { margin: 8px 0 4px; text-align: center; }

/* Cells do not wrap, so on a narrow screen the table scrolls inside its own
   box instead of pushing the whole page sideways. max-content lets it take the
   width its content needs; min-width keeps it filling a wide screen. */
.table-scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.table-scroll > table {
  width: max-content;
  min-width: 100%;
}

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

td.time { color: var(--muted); font-size: 12px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.empty { color: var(--muted); }
.hint { padding: 14px; }
</style>
