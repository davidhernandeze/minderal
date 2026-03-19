import { Database } from '@/domain/Database'
import { AllowedContentTypes, WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { EventEmitter } from 'events'
import { WidgetFactory } from '@/domain/WidgetFactory'
import { FormStructure } from '@/domain/interfaces/FormStructure'
import { WidgetTypeDefinition } from '@/domain/widgets'

export type WidgetRoute = { _id: string; name: string; widget: string; icon: string }[]

export abstract class Widget extends EventEmitter {
  abstract key: string
  abstract label: string
  saved: boolean = false
  route: WidgetRoute = []
  parent?: Widget
  children: Map<string, Widget> = new Map()
  doc: WidgetDocStructure
  docId: string = ''
  widgetTypeDefinition: WidgetTypeDefinition

  readonly db: Database

  readonly icon: string
  readonly expandable: boolean = false
  readonly parentable: boolean = false
  readonly standalonePreview: boolean = false
  readonly expandedComponent?: string
  readonly previewComponent?: string
  readonly formComponent?: string = 'GeneralForm'
  readonly hideCopyButton: boolean = false
  readonly hideIcon: boolean = false

  static readonly formComponent: string
  private readonly widgetFactory: WidgetFactory

  abstract getFormStructure(): FormStructure

  getFormValues(): Record<string, unknown> {
    return { name: this.doc.name }
  }

  protected constructor(db: Database, doc: WidgetDocStructure, widgetFactory: WidgetFactory) {
    super()
    this.db = db
    this.docId = doc._id
    this.doc = doc
    this.widgetFactory = widgetFactory
    this.widgetTypeDefinition = this.getWorkspace().widgetTypes.get(doc.widget)

    if (doc.created_at) this.saved = true
  }

  getAvailableSettings(): Array<{ name: string; type: string; label: string }> {
    return []
  }

  listenForChanges() {
    this.db.on(`doc:changed:${this.docId}`, async (doc) => {
      if (doc.deleted_at) {
        await this.remove()
        return
      }
      if (doc._rev !== this.doc._rev) {
        this.updateDoc(doc)
      }
    })
    this.db.on(`child:changed:${this.docId}`, async (doc) => {
      if (this.children.has(doc._id)) return
      if (doc.deleted_at) return

      const childWidget = await this.widgetFactory.fromDoc(doc)
      this.addChild(childWidget)
      this.emit('children:changed')
    })
  }

  async openInWorkspace() {
    await this.widgetFactory.getWorkspace().navigateToWidget(this.docId)
  }

  removeListeners() {
    this.db.removeAllListeners(`doc:changed:${this.docId}`)
    this.db.removeAllListeners(`child:changed:${this.docId}`)
  }

  async remove() {
    this.parent?.removeChild(this)
    this.removeListeners()
  }

  removeChild(child: Widget) {
    child.removeListeners()
    this.children.delete(child.docId)
    this.emit('children:changed')
  }

  async save() {
    await this.db.createWidgetDoc(this.doc)
    this.saved = true
  }

  updateDoc(doc: WidgetDocStructure) {
    this.doc = doc
    this.emit('content:changed')
    this.emit('name:changed')
  }

  async fetchRoute() {
    let parentId = this.docId
    const route = []
    while (parentId) {
      const parentDoc = await this.db.getDoc(parentId)
      route.push({
        _id: parentId,
        name: parentDoc.name,
        widget: parentDoc.widget,
        icon: parentDoc.settings?.icon
          ? `bi bi-${parentDoc.settings?.icon}`
          : this.getWorkspace().widgetTypes.get(parentDoc.widget)?.icon
      })
      parentId = parentDoc.parent_id
    }
    route.pop()
    this.route = route.reverse()
  }

  filter() {
    this.emit('children:changed')
  }

  getChildren() {
    const unfilteredChildren = Array.from(this.children.values())
    const filter = this.getWorkspace().filter.toLowerCase()
    if (!filter) return unfilteredChildren

    return unfilteredChildren.filter((child) => {
      const searchableContent = child.getName() + child.getContent()
      return searchableContent.toLowerCase().indexOf(filter) > -1
    })
  }

  getContent() {
    return this.doc.content
  }

  getName() {
    return this.doc.name
  }

  addChild(widget: Widget) {
    widget.parent = this
    widget.listenForChanges()
    this.children.set(widget.docId, widget)
  }

  async fetchChildren() {
    const childDocs = await this.db.getDocsByParentId(this.doc._id)
    const idsToDelete = new Set(this.children.keys())
    for (const childDoc of childDocs) {
      const childWidget = await this.widgetFactory.fromDoc(childDoc)
      if (!childWidget) continue
      this.addChild(childWidget)
      idsToDelete.delete(childWidget.docId)
    }

    idsToDelete.forEach((id) => this.removeChild(this.children.get(id)))

    this.emit('children:changed')
  }

  async rename(name: string) {
    this.doc.name = name
    await this.db.updateDoc(this.doc)
    this.emit('name:changed')
  }

  async delete() {
    await this.db.deleteDoc(this.doc)
  }

  async updateContent(content: string | boolean | number) {
    this.doc.content = content
    await this.db.updateDoc(this.doc)
  }

  async updateSetting(key: string, value: AllowedContentTypes) {
    if (!this.doc.settings || typeof this.doc.settings !== 'object') {
      this.doc.settings = {}
    }
    this.doc.settings[key] = value
    await this.db.updateDoc(this.doc)
  }

  getPastableContent(): string {
    return <string>this.doc.content
  }

  async move(parentId: string) {
    const oldParent = this.parent
    this.doc.parent_id = parentId
    await this.db.updateDoc(this.doc)
    await oldParent.onChildrenMoved()
  }

  async onChildrenMoved() {
    console.log('Children moved, updating route...', this.docId)
    await this.fetchChildren()
  }

  getWorkspace() {
    return this.widgetFactory.getWorkspace()
  }

  getIcon() {
    if (this.doc.settings?.icon) return `bi bi-${this.doc.settings?.icon}`
    if (this.widgetTypeDefinition?.icon) return this.widgetTypeDefinition.icon
    return this.widgetFactory.getWorkspace().widgetTypes.get(this.key)?.icon
  }
}
