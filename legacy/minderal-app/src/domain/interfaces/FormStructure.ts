import { AllowedContentTypes } from '@/domain/interfaces/WidgetDocStructure'

export interface FieldStructure {
  name: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'color' | 'widget' | 'icon' | 'boolean'
  label?: string
  required?: boolean
  default?: AllowedContentTypes
}

export interface FormStructure {
  fields: FieldStructure[]
}
