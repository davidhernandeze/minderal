<template>
  <div>
    <div
      ref="chatContainer"
      class="bg-gray-800 w-full h-[70vh] overflow-y-scroll p-5 rounded-md flex-row pb-12"
    >
      <div
        v-for="{ id, message, is_own, sent_by, created_at } in messages"
        :key="id"
        class="w-full flex"
        :class="is_own ? 'justify-end' : 'justify-start'"
      >
        <div
          class="relative bg-blue-600 my-1 w-48 py-2 px-4 max-w-md rounded-xl"
        >
          <div class="flex items-center">
            <div class="flex items-center text-gray-300">
              <i class="fa-solid fa-ghost text-xs mr-1" />
              <span class="text-xs mr-1">{{ sent_by }}</span>
              <span
                v-if="is_own"
                class="text-xs"
              >(You)</span>
            </div>
          </div>
          <p class="break-words p-1 mb-3">
            {{ message }}
          </p>
          <span class="absolute text-gray-400 text-xss right-2 bottom-1">
            {{ created_at }}
          </span>
        </div>
      </div>
    </div>
    <div class="px-10 flex mt-8">
      <input
        v-model="inputValue"
        class="bg-transparent flex-1 border border-gray-100 px-2"
        @keyup.enter="send"
      >
      <button
        class="bg-green-700 py-2 px-4 rounded ml-4"
        @click="send"
      >
        Send
      </button>
    </div>
  </div>
</template>
<script setup>
import useChat from '@/composables/useChat.js'
import { inject, nextTick, onMounted, ref, watch } from 'vue'

const db = inject('db')
const emits = defineEmits(['update'])

const { messages, inputValue, send } = useChat(db, emits)

const chatContainer = ref(null)

watch(messages, async () => {
  await nextTick()
  chatContainer.value.scrollTop = chatContainer.value.scrollHeight
})

onMounted(async () => {
  chatContainer.value.scrollTop = chatContainer.value.scrollHeight
})

</script>
