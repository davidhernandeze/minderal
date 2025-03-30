<script setup>
import { onMounted, inject, ref } from 'vue'
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import { getWidgetProps } from '@/enums/widgets.js'

const emit = defineEmits(['select'])

const props = defineProps({
  parentsOnly: {
    type: Boolean,
    default: false
  },
  excludeDocIds: {
    type: Array,
    default: () => []
  }
})

const workspace = inject('workspace')
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
  await getChildDocs('', nodes.value[0])
})

async function getChildDocs(parentId, node = null) {
  if (node?.loaded) return
  loading.value = true
  let docs = []
  if (props.parentsOnly) {
    docs = await workspace.fetchDocsByParentId(parentId, 'folder')
  } else {
    docs = await workspace.fetchDocsByParentId(parentId)
  }

  for (const doc of docs) {
    if (props.excludeDocIds.includes(doc._id)) {
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
    ></Tree>
    <div class="mt-6 flex justify-end">
      <Button severity="info" :disabled="!selectedKey" label="Select" @click="onSelect" />
    </div>
  </div>
</template>
