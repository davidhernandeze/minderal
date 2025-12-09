interface FieldStructure {
  name: string
  type: string
  label: string
  required?: boolean
  default?: string
}

export interface FormStructure {
  fields: FieldStructure[]
}
