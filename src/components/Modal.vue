<script setup>
import { Dialog, DialogOverlay, TransitionChild, TransitionRoot } from '@headlessui/vue'

defineEmits(['close', 'update:isOpen'])
defineProps({
  isOpen: {
    required: true,
    type: Boolean
  }
})
</script>

<template>
  <TransitionRoot
    as="template"
    :show="isOpen"
  >
    <Dialog
      as="div"
      class="fixed z-10 inset-0 overflow-y-auto"
      @close="$emit('update:isOpen', false)"
    >
      <div class="flex items-center sm:items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <DialogOverlay class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <!-- This element is to trick the browser into centering the modal contents. -->
        <span
          class="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >&#8203;</span>
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          enter-to="opacity-100 translate-y-0 sm:scale-100"
          leave="ease-in duration-200"
          leave-from="opacity-100 translate-y-0 sm:scale-100"
          leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <div class="inline-block align-bottom bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            <div>
              <div
                class="absolute top-0 right-0 flex items-center justify-center py-2 pr-1 text-gray-400 hover:text-gray-50 cursor-pointer"
                @click="$emit('update:isOpen', false)"
              >
                <span class="text-xs mr-1">ESC</span>
                <i class="fa-solid fa-times h-3 mr-2" />
              </div>
              <slot name="body" />
            </div>
          </div>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
