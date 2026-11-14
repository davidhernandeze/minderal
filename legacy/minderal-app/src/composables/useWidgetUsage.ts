import type { WidgetTypeDefinition } from '@/domain/widgets'

const STORAGE_KEY = 'minderal_widget_usage'

export function useWidgetUsage() {
  function getCounts(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  function recordUsage(widgetKey: string): void {
    const counts = getCounts()
    counts[widgetKey] = (counts[widgetKey] ?? 0) + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  }

  function sortByUsage(types: WidgetTypeDefinition[]): WidgetTypeDefinition[] {
    const counts = getCounts()
    return [...types].sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0))
  }

  return { getCounts, recordUsage, sortByUsage }
}
