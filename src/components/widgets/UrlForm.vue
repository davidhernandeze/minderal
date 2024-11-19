<script setup>
import { ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import useUrl from '@/composables/useUrl.js'
import UrlMetadata from '@/components/UrlMetadata.vue'

const props = defineProps({
  doc: {
    type: Object,
    required: false,
    default: () => ({})
  }
})

const emits = defineEmits(['save'])
const { urlPreview, fetchLinkPreview } = useUrl()

watchDebounced(() => urlPreview.value.url, fetchLinkPreview, { debounce: 500, maxWait: 1000 })

const form = ref({
  name: '',
  widget: 'url'
})

if (props.doc) {
  urlPreview.value = { ...props.doc.content }
}

function submit () {
  form.value = { ...props.doc, ...form.value }
  form.value.name = props.doc.name || urlPreview.value.title
  form.value.content = urlPreview.value
  emits('save', form.value)
}

</script>

<template>
  <form
    class="text-gray-200 text-xl "
    @submit.prevent="submit"
  >
    <TextInput
      v-model:value="urlPreview.url"
      label="URL"
      type="text"
      class="my-3 w-full"
    />
    <UrlMetadata
      v-if="urlPreview.title"
      :url-preview="urlPreview"
      class="flex gap-4"
    />
    <GenericButton
      v-if="urlPreview.title"
      class="bg-indigo-600 hover:bg-indigo-500 mt-6"
      type="submit"
    >
      Save
    </GenericButton>
  </form>
</template>
