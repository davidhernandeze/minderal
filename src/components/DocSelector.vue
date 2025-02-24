<script setup>
import { onMounted, inject, ref } from 'vue'
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import { getWidgetProps } from '@/enums/widgets.js'

const emit = defineEmits(['select'])

const props = defineProps({
  parentsOnly: {
    type: Boolean,
    default: false,
  },
  excludeDocIds: {
    type: Array,
    default: () => [],
  },
})

const workspace = inject('workspace')
const nodes = ref([])
const selectedKey = ref(null)
const loading = ref(false)

onMounted(() => {
  getChildDocs('')
})

async function getChildDocs(parentId, node = null) {
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
      children: [],
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
      :value="nodes"
      @node-expand="onNodeExpand"
      v-model:selectionKeys="selectedKey"
      selectionMode="single"
      :loading="loading"
      class="w-full"
    ></Tree>
    <div class="mt-6 flex justify-end">
      <Button @click="onSelect" severity="info" :disabled="!selectedKey" label="Select" />
    </div>
  </div>
</template>
