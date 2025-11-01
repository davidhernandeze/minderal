import { Doc } from '@/domain/Doc'

export interface WidgetDoc extends Doc {
  parent_id?: string
  name: string
  content: string
  widget: string
  settings: object
  created_by: string
  deleted_at: string | null
  files: object[]
  child_order: string[]
}
