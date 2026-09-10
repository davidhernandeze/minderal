<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import { Workspace } from '@/domain'

const emit = defineEmits(['select'])

const { workspace, parentsOnly, excludedDocIds } = defineProps<{
  workspace: Workspace
  parentsOnly?: boolean
  excludedDocIds?: string[]
}>()

const nodes = ref([
  {
    key: '',
    label: '',
    icon: 'bi bi-house',
    leaf: false,
    children: [],
    loaded: false
  }
])
const selectedKey = ref(null)
const loading = ref(false)

onMounted(async () => {
  await getChildDocs('widget:root', nodes.value[0])
})

async function getChildDocs(parentId, node = null) {
  if (node?.loaded) return
  const widgetTypes = workspace.getWidgetTypes()
  loading.value = true
  let docs = []
  docs = await workspace.db.getDocsByParentId(parentId)
  docs = docs.filter((doc) => {
    const widgetType = widgetTypes.find((t) => t.key === doc.widget)
    if (!widgetType) return false
    return !(parentsOnly && !widgetType.parentable)
  })

  for (const doc of docs) {
    if (excludedDocIds.includes(doc._id)) {
      continue
    }
    const widget = await workspace.widgetFactory.fromDoc(doc)
    const newNode = {
      key: doc._id,
      label: doc.name,
      icon: widget.getIcon(),
      leaf: false,
      children: []
    }
    if (node) {
      node.children.push(newNode)
    } else {
      nodes.value.push(newNode)
    }
  }

  if (node?.children.length === 0) {
    node.leaf = true
  }

  node.loaded = true
  loading.value = false
}

async function onNodeExpand(node) {
  await getChildDocs(node.key, node)
}

function onSelect() {
  emit('select', Object.keys(selectedKey.value)[0])
}
</script>
<template>
  <div>
    <Tree
      v-model:selection-keys="selectedKey"
      :value="nodes"
      selection-mode="single"
      :loading="loading"
      class="w-full"
      @node-expand="onNodeExpand"
    />
    <div class="mt-6 flex justify-end">
      <Button severity="info" :disabled="!selectedKey" label="Select" @click="onSelect" />
    </div>
  </div>
</template>
<style>
.p-tree-node-icon {
  padding-right: 0.5rem;
}
</style>
