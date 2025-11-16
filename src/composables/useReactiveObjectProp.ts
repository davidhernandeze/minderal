import { ref, Ref, onUnmounted } from 'vue'

export function useReactiveObjectProp<TSource extends EventEmitter, TData>(
  source: TSource,
  getter: (source: TSource) => TData,
  event: string
): Ref<TData> {
  const state = ref(getter(source)) as Ref<TData>

  const handler = () => {
    state.value = getter(source)
  }

  source.on(event, handler)

  onUnmounted(() => {
    source.removeListener(event, handler)
  })

  return state
}
