interface FieldStructure {
  name: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'color'
  label?: string
  required?: boolean
  default?: string
}

export interface FormStructure {
  fields: FieldStructure[]
}
