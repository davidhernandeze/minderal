import PouchDB from 'pouchdb'
import findPlugin from 'pouchdb-find'
import { ConnectionError } from './ConnectionError.js'
import { NeuronError } from './NeuronError.js'
import { NeuronFactory } from './NeuronFactory.js'
import { Replication } from './Replication.js'
import { BOOLEAN_NEURON_TYPE, BooleanNeuron } from './BooleanNeuron.js'
import { OBJECT_NEURON_TYPE, ObjectNeuron } from './ObjectNeuron.js'
import { STRING_NEURON_TYPE, StringNeuron } from './StringNeuron.js'
import { NEURON_ID_PREFIX, isNeuronId } from './Neuron.js'
import { TEMPLATE_ID_PREFIX, Template, isTemplateId } from './Template.js'
import type { Neuron, NeuronAttribute, NeuronDocument } from './Neuron.js'
import type { NeuronChange, TemplateChange, WatchHandlers } from './NeuronChange.js'
import type { TemplateAttribute, TemplateDocument } from './Template.js'
import type { ReplicationOptions } from './Replication.js'

PouchDB.plugin(findPlugin)

// Both PouchDB and CouchDB cap find() at 25 documents when no limit is given,
// so every query pages explicitly.
const FIND_PAGE_SIZE = 200
const FEED_REOPEN_DELAY = 2000

type NeuronClient = PouchDB.Database<NeuronDocument>
type ChangedDocument = PouchDB.Core.ExistingDocument<NeuronDocument & PouchDB.Core.ChangesMeta>
type ChangeFeed = PouchDB.Core.Changes<NeuronDocument>

export interface NeuronQueryOptions {
  includeDeleted?: boolean
  /** Attribute value neurons are hidden from listings unless asked for. */
  includeAttributes?: boolean
}

export interface ResolvedAttribute {
  name: string
  neuron: Neuron
}

export class Database {
  private readonly location: string
  private readonly username: string
  private readonly pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  private client: NeuronClient | null
  private initialization: Promise<void> | null
  private readonly watchers: Set<WatchHandlers>
  private feed: ChangeFeed | null
  private feedReopen: ReturnType<typeof setTimeout> | null
  private readonly replications: Set<Replication>

  private constructor(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration
  ) {
    this.location = location
    this.username = username
    this.pouchOptions = pouchOptions
    this.client = null
    this.initialization = null
    this.watchers = new Set()
    this.feed = null
    this.feedReopen = null
    this.replications = new Set()
  }

  static open(
    location: string,
    username: string,
    pouchOptions: PouchDB.Configuration.DatabaseConfiguration = {}
  ): Database {
    return new Database(location, username, pouchOptions)
  }

  async initialize(): Promise<void> {
    this.initialization ??= this.setUp()
    try {
      await this.initialization
    } catch (cause) {
      this.initialization = null
      throw cause
    }
  }

  async create<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    await this.initialize()
    const timestamp = new Date().toISOString()
    neuron.createdAt = timestamp
    neuron.updatedAt = timestamp
    neuron.createdBy = this.username

    try {
      const response = await this.openClient().put(neuron.toDocument())
      neuron.revision = response.rev
      return neuron
    } catch (cause) {
      throw this.failure(`Creating neuron ${neuron.id}`, cause)
    }
  }

  // Writes an existing neuron back. The caller mutates the object, this stamps
  // updated_at and carries the new revision; a stale revision fails loudly
  // rather than silently forking the document.
  async update<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    await this.initialize()
    if (neuron.revision === null) {
      throw new NeuronError(`Neuron ${neuron.id} has never been saved, so it cannot be updated`)
    }
    neuron.updatedAt = new Date().toISOString()

    try {
      const response = await this.openClient().put(neuron.toDocument())
      neuron.revision = response.rev
      return neuron
    } catch (cause) {
      throw this.failure(`Updating neuron ${neuron.id}`, cause)
    }
  }

  async rename<NeuronType extends Neuron>(
    neuron: NeuronType,
    name: string | null
  ): Promise<NeuronType> {
    const trimmed = name === null ? null : name.trim()
    neuron.name = trimmed === null || trimmed.length === 0 ? null : trimmed
    return this.update(neuron)
  }

  async delete<NeuronType extends Neuron>(neuron: NeuronType): Promise<NeuronType> {
    await this.initialize()
    const timestamp = new Date().toISOString()

    try {
      const client = this.openClient()
      const descendants = await collectDescendants(client, neuron.id)
      const documents = [neuron, ...descendants].map((target) => {
        target.deletedAt = timestamp
        target.updatedAt = timestamp
        return target.toDocument()
      })

      const results = await client.bulkDocs(documents)
      const failure = results.find((result) => !isWriteSuccess(result))
      if (failure !== undefined) throw failure

      for (const result of results) {
        if (isWriteSuccess(result) && result.id === neuron.id) neuron.revision = result.rev
      }
      return neuron
    } catch (cause) {
      throw this.failure(`Deleting neuron ${neuron.id}`, cause)
    }
  }

  // Sets a 1-to-1 relation. The value lives in its own neuron, so it carries
  // its own created_at, created_by, revision history and soft delete; the owner
  // holds only the name and the id.
  async setAttribute<NeuronType extends Neuron>(
    owner: Neuron,
    name: string,
    value: NeuronType
  ): Promise<NeuronType> {
    await this.initialize()
    const attributeName = name.trim()
    if (attributeName.length === 0) {
      throw new NeuronError('An attribute needs a name')
    }
    if (owner.revision === null) {
      throw new NeuronError(`Neuron ${owner.id} must be saved before it can hold attributes`)
    }

    value.attributeOf = owner.id
    value.parentId = null
    await this.create(value)

    // One value per name: replacing an attribute soft deletes the neuron that
    // held the old value rather than orphaning it, so the change stays in the
    // document history.
    const replaced = owner.attributes.find((attribute) => attribute.name === attributeName)
    owner.attributes = [
      ...owner.attributes.filter((attribute) => attribute.name !== attributeName),
      { name: attributeName, id: value.id }
    ]
    await this.update(owner)
    if (replaced !== undefined) await this.deleteById(replaced.id)

    return value
  }

  async getAttribute(owner: Neuron, name: string): Promise<Neuron | null> {
    const attribute = owner.attributes.find((entry) => entry.name === name.trim())
    if (attribute === undefined) return null
    return this.get(attribute.id, { includeAttributes: true })
  }

  async listAttributes(owner: Neuron): Promise<ResolvedAttribute[]> {
    await this.initialize()
    if (owner.attributes.length === 0) return []

    try {
      // One read for the whole set rather than one per attribute.
      const response = await this.openClient().allDocs({
        keys: owner.attributes.map((attribute) => attribute.id),
        include_docs: true
      })
      const byId = new Map<string, Neuron>()
      for (const row of response.rows) {
        // A key that matches nothing comes back as a row with no doc.
        const document = 'doc' in row ? (row.doc ?? undefined) : undefined
        if (document === undefined || isDeleted(document)) continue
        byId.set(document._id, NeuronFactory.fromDocument(document))
      }
      return owner.attributes.flatMap((attribute) => {
        const neuron = byId.get(attribute.id)
        return neuron === undefined ? [] : [{ name: attribute.name, neuron }]
      })
    } catch (cause) {
      throw this.failure(`Reading attributes of ${owner.id}`, cause)
    }
  }

  // Only the owner's entry moves: the value neuron, and so its type and its own
  // attributes, stays exactly where it is. Rebuilding the value instead would
  // quietly turn a boolean into whatever the caller happened to rebuild it as.
  async renameAttribute(owner: Neuron, name: string, newName: string): Promise<boolean> {
    await this.initialize()
    const from = name.trim()
    const to = newName.trim()
    if (to.length === 0) {
      throw new NeuronError('An attribute needs a name')
    }

    const attribute = owner.attributes.find((entry) => entry.name === from)
    if (attribute === undefined) return false
    if (from === to) return true
    if (owner.attributes.some((entry) => entry.name === to)) {
      throw new NeuronError(`Neuron ${owner.id} already has an attribute named ${to}`)
    }

    owner.attributes = owner.attributes.map((entry) =>
      entry.name === from ? { name: to, id: entry.id } : entry
    )
    await this.update(owner)
    return true
  }

  async removeAttribute(owner: Neuron, name: string): Promise<boolean> {
    const attributeName = name.trim()
    const attribute = owner.attributes.find((entry) => entry.name === attributeName)
    if (attribute === undefined) return false

    owner.attributes = owner.attributes.filter((entry) => entry.name !== attributeName)
    await this.update(owner)
    await this.deleteById(attribute.id)
    return true
  }

  private async deleteById(id: string): Promise<void> {
    const neuron = await this.get(id, { includeAttributes: true })
    if (neuron !== null) await this.delete(neuron)
  }

  async get(id: string, options: NeuronQueryOptions = {}): Promise<Neuron | null> {
    await this.initialize()
    try {
      const document = await this.openClient().get(id)
      if (isDeleted(document) && options.includeDeleted !== true) return null
      return NeuronFactory.fromDocument(document)
    } catch (cause) {
      if (isNotFound(cause)) return null
      throw this.failure(`Reading neuron ${id}`, cause)
    }
  }

  async list(options: NeuronQueryOptions = {}): Promise<Neuron[]> {
    await this.initialize()
    try {
      const response = await this.openClient().allDocs({
        include_docs: true,
        startkey: NEURON_ID_PREFIX,
        endkey: `${NEURON_ID_PREFIX}\uffff`
      })
      return toNeurons(
        response.rows.map((row) => row.doc),
        options
      )
    } catch (cause) {
      throw this.failure('Listing neurons', cause)
    }
  }

  async listByParentId(
    parentId: string | null,
    options: NeuronQueryOptions = {}
  ): Promise<Neuron[]> {
    await this.initialize()
    try {
      const selector =
        options.includeDeleted === true
          ? { parent_id: parentId }
          : { parent_id: parentId, deleted_at: null }
      return toNeurons(await findAll(this.openClient(), selector), options)
    } catch (cause) {
      throw this.failure(`Listing neurons under parent ${String(parentId)}`, cause)
    }
  }

  async createTemplate(template: Template): Promise<Template> {
    await this.initialize()
    const timestamp = new Date().toISOString()
    template.createdAt = timestamp
    template.updatedAt = timestamp
    template.createdBy = this.username

    try {
      const response = await this.openClient().put(template.toDocument())
      template.revision = response.rev
      return template
    } catch (cause) {
      throw this.failure(`Creating template ${template.id}`, cause)
    }
  }

  async updateTemplate(template: Template): Promise<Template> {
    await this.initialize()
    if (template.revision === null) {
      throw new NeuronError(`Template ${template.id} has never been saved, so it cannot be updated`)
    }
    template.updatedAt = new Date().toISOString()

    try {
      const response = await this.openClient().put(template.toDocument())
      template.revision = response.rev
      return template
    } catch (cause) {
      throw this.failure(`Updating template ${template.id}`, cause)
    }
  }

  async getTemplate(id: string, options: NeuronQueryOptions = {}): Promise<Template | null> {
    await this.initialize()
    if (!isTemplateId(id)) return null
    try {
      const document = await this.openClient().get(id)
      if (!isTemplateDocument(document)) return null
      if (isDeleted(document) && options.includeDeleted !== true) return null
      return Template.fromDocument(document)
    } catch (cause) {
      if (isNotFound(cause)) return null
      throw this.failure(`Reading template ${id}`, cause)
    }
  }

  async listTemplates(options: NeuronQueryOptions = {}): Promise<Template[]> {
    await this.initialize()
    try {
      const response = await this.openClient().allDocs({
        include_docs: true,
        startkey: TEMPLATE_ID_PREFIX,
        endkey: `${TEMPLATE_ID_PREFIX}\uffff`
      })
      const templates: Template[] = []
      for (const row of response.rows) {
        const document = row.doc
        if (document === undefined || document === null) continue
        if (!isTemplateDocument(document)) continue
        if (options.includeDeleted !== true && isDeleted(document)) continue
        templates.push(Template.fromDocument(document))
      }
      return templates.sort(byName)
    } catch (cause) {
      throw this.failure('Listing templates', cause)
    }
  }

  async renameTemplate(template: Template, name: string | null): Promise<Template> {
    const trimmed = name === null ? null : name.trim()
    template.name = trimmed === null || trimmed.length === 0 ? null : trimmed
    return this.updateTemplate(template)
  }

  // Soft deleted like a neuron, and alone: a template owns nothing, and the
  // neurons that follow it keep working from the attributes they already have.
  async deleteTemplate(template: Template): Promise<Template> {
    template.deletedAt = new Date().toISOString()
    return this.updateTemplate(template)
  }

  // One entry per name, so writing an attribute that is already there replaces
  // it in place rather than adding a second.
  async setTemplateAttribute(
    template: Template,
    attribute: TemplateAttribute
  ): Promise<Template> {
    const name = attribute.name.trim()
    if (name.length === 0) {
      throw new NeuronError('A template attribute needs a name')
    }

    const next = { ...attribute, name }
    const existing = template.attributes.findIndex((entry) => entry.name === name)
    template.attributes =
      existing === -1
        ? [...template.attributes, next]
        : template.attributes.map((entry, index) => (index === existing ? next : entry))
    return this.updateTemplate(template)
  }

  async renameTemplateAttribute(
    template: Template,
    name: string,
    newName: string
  ): Promise<boolean> {
    const from = name.trim()
    const to = newName.trim()
    if (to.length === 0) {
      throw new NeuronError('A template attribute needs a name')
    }

    const attribute = template.attributes.find((entry) => entry.name === from)
    if (attribute === undefined) return false
    if (from === to) return true
    if (template.attributes.some((entry) => entry.name === to)) {
      throw new NeuronError(`Template ${template.id} already has an attribute named ${to}`)
    }

    template.attributes = template.attributes.map((entry) =>
      entry.name === from ? { ...entry, name: to } : entry
    )
    await this.updateTemplate(template)
    return true
  }

  async removeTemplateAttribute(template: Template, name: string): Promise<boolean> {
    const target = name.trim()
    if (!template.attributes.some((entry) => entry.name === target)) return false

    template.attributes = template.attributes.filter((entry) => entry.name !== target)
    await this.updateTemplate(template)
    return true
  }

  // A neuron made from a type: an object that names the template it follows,
  // carrying one attribute per attribute the template defines.
  async createFromTemplate(
    template: Template,
    properties: { name?: string | null; parentId?: string | null } = {}
  ): Promise<ObjectNeuron> {
    const neuron = ObjectNeuron.create({
      name: properties.name ?? null,
      parentId: properties.parentId ?? null,
      templateId: template.id
    })
    await this.create(neuron)
    await this.applyTemplate(neuron, template)
    return neuron
  }

  // Attributes the neuron already has are left alone, so applying a template to
  // something that has been filled in adds what is missing and changes nothing.
  async applyTemplate<NeuronType extends Neuron>(
    neuron: NeuronType,
    template: Template
  ): Promise<NeuronType> {
    await this.initialize()
    await this.fillFromTemplate(neuron, template, new Set([template.id]))
    return neuron
  }

  private async fillFromTemplate(
    neuron: Neuron,
    template: Template,
    seen: Set<string>
  ): Promise<void> {
    for (const attribute of template.attributes) {
      if (neuron.attributes.some((entry) => entry.name === attribute.name)) continue

      const value = neuronForTemplateAttribute(attribute)
      if (value === null) continue
      await this.setAttribute(neuron, attribute.name, value)

      // A type that reaches itself, directly or round a ring of others, stops
      // here: the neuron is still made, it just is not filled in again.
      if (attribute.templateId === null || seen.has(attribute.templateId)) continue
      const nested = await this.getTemplate(attribute.templateId)
      if (nested === null) continue
      await this.fillFromTemplate(value, nested, new Set([...seen, attribute.templateId]))
    }
  }

  async watch(handlers: WatchHandlers): Promise<() => void> {
    await this.initialize()
    this.watchers.add(handlers)
    this.openFeed()

    return () => {
      this.watchers.delete(handlers)
      if (this.watchers.size === 0) this.closeFeed()
    }
  }

  async syncWith(other: Database, options: ReplicationOptions = {}): Promise<Replication> {
    await this.initialize()
    await other.initialize()

    const handle = this.openClient().sync(other.openClient(), {
      live: options.live ?? true,
      retry: options.retry ?? true
    })
    const replication = Replication.start(handle)
    this.replications.add(replication)
    return replication
  }

  async close(): Promise<void> {
    for (const replication of this.replications) replication.stop()
    this.replications.clear()
    this.closeFeed()
    this.watchers.clear()

    const client = this.client
    if (client === null) return
    this.client = null
    this.initialization = null
    await client.close()
  }

  private openFeed(): void {
    if (this.feed !== null) return

    // include_docs because parent_id is not in a raw changes entry, and
    // conflicts so a collision can be resolved the moment it is seen.
    const feed = this.openClient().changes({
      live: true,
      since: 'now',
      include_docs: true,
      conflicts: true
    })
    feed.on('change', (change) => {
      void this.handleChange(change)
    })
    feed.on('error', (cause) => {
      this.announceError(this.failure('Watching', cause))
      this.announceLive(false)
      this.closeFeed()
      this.scheduleFeedReopen()
    })
    this.feed = feed
  }

  // The retry belongs to a watch the caller started, not to core acting on its
  // own: with writes no longer driving refetches, a dead feed means a silently
  // stale reader.
  private scheduleFeedReopen(): void {
    if (this.watchers.size === 0 || this.feedReopen !== null) return
    this.feedReopen = setTimeout(() => {
      this.feedReopen = null
      void this.reopenFeed()
    }, FEED_REOPEN_DELAY)
  }

  // Probed rather than assumed: reopening a feed against a server that is
  // still down would report live, fail, and report not-live again every cycle.
  private async reopenFeed(): Promise<void> {
    if (this.watchers.size === 0) return
    try {
      await this.openClient().info()
    } catch {
      this.scheduleFeedReopen()
      return
    }
    this.openFeed()
    this.announceLive(true)
  }

  private closeFeed(): void {
    if (this.feedReopen !== null) {
      clearTimeout(this.feedReopen)
      this.feedReopen = null
    }
    this.feed?.cancel()
    this.feed = null
  }

  private async handleChange(
    change: PouchDB.Core.ChangesResponseChange<NeuronDocument>
  ): Promise<void> {
    const document = change.doc
    if (document === undefined) return
    if (!isNeuronId(change.id) && !isTemplateId(change.id)) return

    let winner: ChangedDocument = document
    try {
      winner = await this.resolveConflicts(document)
    } catch (cause) {
      this.announceError(this.failure(`Resolving conflicts on ${change.id}`, cause))
      return
    }

    if (isTemplateId(winner._id)) {
      if (!isTemplateDocument(winner)) return
      this.announceTemplate({
        id: winner._id,
        deletedAt: winner.deleted_at ?? null,
        revision: winner._rev,
        template: change.deleted === true ? null : Template.fromDocument(winner)
      })
      return
    }

    this.announce({
      id: winner._id,
      parentId: winner.parent_id,
      previousParentId: winner.previous_parent_id ?? null,
      deletedAt: winner.deleted_at ?? null,
      revision: winner._rev,
      neuron: change.deleted === true ? null : NeuronFactory.fromDocument(winner)
    })
  }

  // Last write wins by updated_at. Resolution writes a new revision, which
  // comes back as another change with no conflicts, so this does not recurse.
  // Two peers resolving at once converge because the rule is deterministic.
  private async resolveConflicts(document: ChangedDocument): Promise<ChangedDocument> {
    const conflictingRevisions = document._conflicts ?? []
    if (conflictingRevisions.length === 0) return document

    const client = this.openClient()
    const winningRevision = document._rev
    const rivals = await Promise.all(
      conflictingRevisions.map(async (revision) => client.get(document._id, { rev: revision }))
    )
    const winner = [document, ...rivals].reduce(pickLatest)

    if (winner._rev !== winningRevision) {
      await client.put(toPlainDocument(winner, winningRevision))
    }
    for (const rival of rivals) {
      if (rival._rev === winningRevision) continue
      await client.remove(document._id, rival._rev)
    }

    return client.get(document._id, { conflicts: true })
  }

  private announce(change: NeuronChange): void {
    for (const watcher of this.watchers) watcher.change(change)
  }

  private announceTemplate(change: TemplateChange): void {
    for (const watcher of this.watchers) watcher.template?.(change)
  }

  private announceError(error: Error): void {
    for (const watcher of this.watchers) watcher.error?.(error)
  }

  private announceLive(isLive: boolean): void {
    for (const watcher of this.watchers) watcher.live?.(isLive)
  }

  private async setUp(): Promise<void> {
    const client = this.openClient()
    try {
      await client.createIndex({ index: { fields: ['parent_id', 'deleted_at'] } })
      await client.createIndex({ index: { fields: ['deleted_at'] } })
      await client.createIndex({ index: { fields: ['attribute_of'] } })
    } catch (cause) {
      throw this.failure('Initializing', cause)
    }
  }

  private openClient(): NeuronClient {
    if (this.client === null) {
      this.client = new PouchDB<NeuronDocument>(this.location, this.pouchOptions)
    }
    return this.client
  }

  private failure(action: string, cause: unknown): Error {
    if (cause instanceof NeuronError) return cause
    return new ConnectionError(`${action} in ${this.location} failed: ${describeCause(cause)}`)
  }
}

async function findAll(
  client: NeuronClient,
  selector: PouchDB.Find.Selector
): Promise<NeuronDocument[]> {
  const documents: NeuronDocument[] = []
  for (;;) {
    const response = await client.find({
      selector,
      limit: FIND_PAGE_SIZE,
      skip: documents.length
    })
    documents.push(...response.docs)
    if (response.docs.length < FIND_PAGE_SIZE) return documents
  }
}

// Breadth-first down the parent_id chain, one query per level. The seen set
// guards against a parent_id cycle, which would otherwise never terminate.
async function collectDescendants(client: NeuronClient, rootId: string): Promise<Neuron[]> {
  const descendants: Neuron[] = []
  const seen = new Set<string>([rootId])
  let frontier = [rootId]

  while (frontier.length > 0) {
    const [children, attributeValues] = await Promise.all([
      findAll(client, { parent_id: { $in: frontier }, deleted_at: null }),
      findAll(client, { attribute_of: { $in: frontier }, deleted_at: null })
    ])
    const nextFrontier: string[] = []
    for (const document of [...children, ...attributeValues]) {
      if (seen.has(document._id)) continue
      seen.add(document._id)
      descendants.push(NeuronFactory.fromDocument(document))
      nextFrontier.push(document._id)
    }
    frontier = nextFrontier
  }
  return descendants
}

// Every field is carried over, not just the ones on NeuronDocument: naming
// them individually drops whatever the subclass added, so promoting a conflict
// winner would quietly erase a StringNeuron's value and name.
function toPlainDocument(document: ChangedDocument, revision: string): NeuronDocument {
  const { _conflicts, _deleted, ...fields } = document
  return { ...fields, _rev: revision }
}

function pickLatest(left: ChangedDocument, right: ChangedDocument): ChangedDocument {
  const leftStamp = left.updated_at ?? ''
  const rightStamp = right.updated_at ?? ''
  if (leftStamp !== rightStamp) return leftStamp > rightStamp ? left : right
  // Equal timestamps still have to resolve the same way on every peer.
  return left._rev > right._rev ? left : right
}

function isWriteSuccess(
  result: PouchDB.Core.Response | PouchDB.Core.Error
): result is PouchDB.Core.Response {
  return 'ok' in result && result.ok === true
}

// Newest first. Sorted here rather than through a Mango sort because findAll
// already pages the whole result set in, and an indexed sort would need the
// sort field in the index and the same direction on both engines.
function toNeurons(
  documents: Array<NeuronDocument | undefined>,
  options: NeuronQueryOptions
): Neuron[] {
  return documents
    .filter((document): document is NeuronDocument => document !== undefined)
    .filter((document) => isNeuronId(document._id))
    .filter((document) => options.includeDeleted === true || !isDeleted(document))
    .filter((document) => options.includeAttributes === true || !isAttributeValue(document))
    .sort(byNewestFirst)
    .map((document) => NeuronFactory.fromDocument(document))
}

function byNewestFirst(left: NeuronDocument, right: NeuronDocument): number {
  const leftStamp = left.created_at ?? ''
  const rightStamp = right.created_at ?? ''
  if (leftStamp !== rightStamp) return leftStamp > rightStamp ? -1 : 1
  // Two neurons written in the same millisecond still need a stable order.
  return left._id.localeCompare(right._id)
}

// A template is the only thing under the template prefix, so the prefix is what
// identifies it; the extra field is checked so a half-written document cannot
// be read as a template with no attributes.
function isTemplateDocument(document: NeuronDocument): document is TemplateDocument {
  if (!isTemplateId(document._id)) return false
  return 'template_attributes' in document && Array.isArray(document.template_attributes)
}

// What a neuron made from a template starts as. An unknown type is skipped
// rather than guessed at, so a template written by a newer version of the app
// leaves a gap instead of the wrong kind of neuron.
function neuronForTemplateAttribute(attribute: TemplateAttribute): Neuron | null {
  switch (attribute.type) {
    case OBJECT_NEURON_TYPE:
      return ObjectNeuron.create({ templateId: attribute.templateId })
    case BOOLEAN_NEURON_TYPE:
      return BooleanNeuron.create({ value: attribute.defaultValue === true })
    case STRING_NEURON_TYPE:
      return StringNeuron.create({
        value: typeof attribute.defaultValue === 'string' ? attribute.defaultValue : ''
      })
    default:
      return null
  }
}

function byName(first: Template, second: Template): number {
  const left = first.name ?? ''
  const right = second.name ?? ''
  if (left === right) return first.id.localeCompare(second.id)
  return left.localeCompare(right)
}

function isDeleted(document: NeuronDocument): boolean {
  return (document.deleted_at ?? null) !== null
}

function isAttributeValue(document: NeuronDocument): boolean {
  return (document.attribute_of ?? null) !== null
}

function isNotFound(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 404
}

function describeCause(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null) return String(cause)
  const message = 'message' in cause ? String(cause.message) : String(cause)
  return 'status' in cause ? `${message} (${String(cause.status)})` : message
}
