<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import { getWidgetProps } from '@/enums/widgets.js'
import { Database } from '@/domain'

const emit = defineEmits(['select'])

const props = defineProps<{
  db: Database
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
  await getChildDocs('root', nodes.value[0])
})

async function getChildDocs(parentId, node = null) {
  if (node?.loaded) return
  loading.value = true
  let docs = []
  if (props.parentsOnly) {
    docs = await props.db.getDocsByParentId(parentId, 'folder')
  } else {
    docs = await props.db.getDocsByParentId(parentId)
  }

  for (const doc of docs) {
    if (props.excludedDocIds.includes(doc._id)) {
      continue
    }
    const newNode = {
      key: doc._id,
      label: doc.name,
      icon: getWidgetProps(doc.widget)?.icon,
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
