<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import safeImport from '@/utils/safe-import.js'
import { vOnClickOutside } from '@vueuse/components'
import { useClipboard } from '@vueuse/core'
import InvisibleInput from '@/components/InvisibleInput.vue'
import Panel from 'primevue/panel'
import Button from 'primevue/button'
import { useTimeAgo } from '@vueuse/core'
import Dialog from 'primevue/dialog'
import { Widget } from '@/domain'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import WidgetMenu from '@/components/WidgetMenu.vue'

const { widget, hideMenu, single } = defineProps<{
  widget: Widget
  hideMenu?: boolean
  single?: boolean
}>()

defineEmits(['enable-drag', 'disable-drag'])

const { copy } = useClipboard()

const moveToModalOpen = ref(false)

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')

const timeAgo = useTimeAgo(widget.doc.updated_at)

const isEditingName = ref(false)

const widgetFormOpen = ref(false)

const icon = widget.icon
const WidgetPreviewComponent = defineAsyncComponent(() =>
  safeImport(() => import(`./widgets/preview/${widget.previewComponent}.vue`))
)

async function endNameEdition(event) {
  if (!isEditingName.value) return
  isEditingName.value = false
  event.target?.blur()
  await widget.rename(widgetName.value)
}

function startNameEdition(event) {
  isEditingName.value = true
  const input = event.target
  input.focus()
}

function copyToClipboard() {
  copy(widget.getPastableContent())
}

function addActions(actions) {
  rowActions.value = rowActions.value.concat(actions)
}

async function moveDoc(parentDoc) {
  await workspace.moveDoc({ ...props.doc }, parentDoc)
  moveToModalOpen.value = false
}

const menuEvent = ref(null)
</script>
<template>
  <Panel
    :pt:header:class="['!p-2', widget.doc.widget === 'folder' ? '!pb-0' : '']"
    pt:root:class=" h-full flex flex-col"
    pt:content-container:class="h-full min-h-0 flex-1 flex flex-col"
    pt:content:class="h-full flex-1 min-h-0 flex flex-col !pb-0"
    pt:footer:class="h-[2.5rem] !py-0"
  >
    <template #header>
      <div v-if="widget.standalonePreview || single" />
      <div v-else class="flex-1 flex justify-start items-center text-gray-400 truncate pr-2">
        <i class="text-xl" :class="icon" />
        <InvisibleInput
          v-model:value="widgetName"
          v-on-click-outside="endNameEdition"
          class="flex-1 ml-2 bg-transparent border-none focus:outline-hidden p-0"
          @click.stop
          @focus="(e) => startNameEdition(e)"
          @keyup.enter="endNameEdition"
        />
      </div>
    </template>
    <template #icons>
      <div v-if="!hideMenu" class="flex items-center gap-2">
        <!--        <div-->
        <!--          class="drag-zone rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"-->
        <!--          @pointerdown="$emit('enable-drag')"-->
        <!--          @pointerup="$emit('disable-drag')"-->
        <!--        >-->
        <!--          <i class="bi bi-grip-horizontal" />-->
        <!--        </div>-->
        <div class="card flex justify-center">
          <Button
            type="button"
            icon="bi bi-three-dots-vertical"
            variant="text"
            aria-haspopup="true"
            aria-controls="overlay_menu"
            @click="(e) => (menuEvent = e)"
          />
          <WidgetMenu v-model:event="menuEvent" :widget="widget" />
        </div>
      </div>
    </template>
    <template v-if="!widget.standalonePreview" #footer>
      <div class="relative flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <button
            v-if="!widget.hideCopyButton"
            class="rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
            @click="copyToClipboard"
          >
            <i class="bi bi-copy" />
          </button>
        </div>
        <span class="text-xs text-text-gray-700 dark:text-gray-500">Updated {{ timeAgo }}</span>
      </div>
    </template>

    <WidgetPreviewComponent :widget="widget" @add-actions="addActions" />
    <Dialog
      v-if="widget.formComponent"
      v-model:visible="widgetFormOpen"
      header="Edit widget"
      modal
      style="width: 40rem"
    >
    </Dialog>
  </Panel>
</template>
