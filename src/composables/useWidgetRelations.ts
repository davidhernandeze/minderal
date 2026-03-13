const STORAGE_KEY = 'minderal_widget_relations'
const MAX_STORED = 50

export function useWidgetRelations() {
  function getRelations(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return []
    }
  }

  function recordRelation(relation: string): void {
    const trimmed = relation.trim()
    if (!trimmed) return
    const existing = getRelations().filter((r) => r !== trimmed)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([trimmed, ...existing].slice(0, MAX_STORED)))
  }

  function searchRelations(query: string): string[] {
    const all = getRelations()
    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all.filter((r) => r.toLowerCase().includes(q))
  }

  return { getRelations, recordRelation, searchRelations }
}
