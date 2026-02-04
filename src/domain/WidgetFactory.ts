import { Database } from '@/domain/Database'
import { WidgetRequest } from '@/domain/interfaces/WidgetRequest'
import { WidgetDocStructure } from '@/domain/interfaces/WidgetDocStructure'
import { v4 as generateId } from 'uuid'
import { Widget } from '@/domain/Widget'
import { Workspace } from '@/domain/Workspace'
import WidgetConstructor from '@/domain/WidgetConstructor'

export class WidgetFactory {
  constructor(
    private workspace: Workspace,
    private readonly db: Database
  ) {}

  async getWidgetClass(widgetType: string): Promise<WidgetConstructor> {
    const widgetModule = await this.workspace.widgetTypes.get(widgetType)?.class()
    return widgetModule?.default
  }

  getWorkspace(): Workspace {
    return this.workspace
  }

  async fromDoc(doc: WidgetDocStructure): Promise<Widget> {
    const WidgetConstructor = await this.getWidgetClass(doc.widget)
    return WidgetConstructor ? new WidgetConstructor(this.db, doc, this) : null
  }

  async createFromRequest(request: WidgetRequest): Promise<Widget> {
    const widgetDoc: WidgetDocStructure = {
      _id: request._id ?? generateId(),
      name: request.name ?? '',
      widget: request.widget,
      settings: request.settings ?? {},
      parent_id: request.parent_id ?? '',
      content: request.content ?? '',
      created_by: this.db.username,
      deleted_at: null
    }

    return await this.fromDoc(widgetDoc)
  }

  async getFromId(id: string): Promise<Widget> {
    const doc: WidgetDocStructure = await this.db.getDoc(id)
    return await this.fromDoc(doc)
  }

  async getOrCreateFromDoc(doc: WidgetRequest): Promise<Widget> {
    try {
      return await this.getFromId(doc._id)
    } catch (e) {
      if (e.status !== 404) return null
      const widget = await this.createFromRequest(doc)
      await widget.save()
    }
  }
}
