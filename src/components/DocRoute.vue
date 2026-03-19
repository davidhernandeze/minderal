<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue'
import { Application, WidgetRoute, Workspace } from '@/domain/index.js'

const app = inject<Application>('app')

defineEmits(['navigate'])
const props = defineProps<{
  route: WidgetRoute
  workspace: Workspace
}>()

const container = ref()

watch(
  () => props.route,
  async () => {
    await nextTick()
    container.value.scrollLeft = container.value.scrollWidth
  }
)
</script>
<template>
  <nav
    ref="container"
    v-bind="$attrs"
    class="flex w-full overflow-x-auto pr-3 text-sm"
    aria-label="Breadcrumb"
  >
    <ol role="list" class="flex items-center">
      <li v-for="(doc, index) in route" :key="doc._id" @click="workspace.navigateToWidget(doc._id)">
        <div class="flex items-center">
          <i v-if="index !== 0" class="bi bi-caret-right-fill mx-1" />
          <div
            :class="{ 'text-(--p-primary-500)': index === route.length - 1 }"
            class="ml-1 flex hover:text-(--p-primary-500)"
            @click.middle="app.openNewTab(workspace.db, doc._id)"
          >
            <i :class="doc.icon" />
            <a href="#" class="font-medium truncate max-w-xs ml-2">{{ doc.name }}</a>
          </div>
        </div>
      </li>
    </ol>
  </nav>
</template>
