import { AllowedContentTypes } from '@/domain/interfaces/WidgetDocStructure'

export interface WidgetRequest {
  _id?: string
  name?: string
  parent_id?: string
  content: string
  widget: string
  settings?: { [key: string]: AllowedContentTypes }
  relation?: string | null
  files?: object[]
}
