<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import FileInput from '@/components/FileInput.vue'

const emits = defineEmits(['submit'])

const form = ref({
  name: '',
  widget: 'image',
  content: '',
  files: []
})

function submit () {
  emits('submit', form.value)
}

</script>

<template>
  <form
    @submit.prevent="submit"
  >
    <TextInput
      v-model:value="form.name"
      label="Name"
      type="text"
      class="my-3 w-full"
    />

    <FileInput v-model:files="form.files" />

    <GenericButton
      class="bg-indigo-600 hover:bg-indigo-500 mt-6"
      type="submit"
    >
      Save
    </GenericButton>
  </form>
</template>
