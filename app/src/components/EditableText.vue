<script setup lang="ts">
import { nextTick, ref } from 'vue'

// Text that turns into an input when clicked, and nothing else: no label, no
// frame, no reserved space. It is used wherever a value is shown rather than in
// a form, so it stays invisible until the pointer is on it.
//
// The value is a prop and the result is an event, not `v-model`: every edit
// here ends in a database write, and the new text comes back through the change
// feed. Owning a local copy would mean showing an edit that had not landed yet.
const props = withDefaults(
  defineProps<{
    value: string
    placeholder?: string
    empty?: string
    title?: string
    disabled?: boolean
  }>(),
  { placeholder: '', empty: '—', title: 'Click to edit', disabled: false }
)

const emit = defineEmits<{ submit: [value: string] }>()

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

// Font, colour and width all come from whatever contains the component, so the
// same component carries a heading and a table cell without being told which.
async function startEditing(): Promise<void> {
  if (props.disabled) return
  draft.value = props.value
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function cancelEditing(): void {
  editing.value = false
  draft.value = ''
}

function commitEditing(): void {
  const next = draft.value.trim()
  editing.value = false
  draft.value = ''
  if (next === props.value.trim()) return
  emit('submit', next)
}

// Clicking away abandons an untouched editor but keeps one with changes in it.
// The checkmark takes mousedown instead of focus, so it never loses the race
// against this.
function onBlur(): void {
  if (draft.value.trim() === props.value.trim()) cancelEditing()
}
</script>

<template>
  <span class="editable" :class="{ editing }">
    <template v-if="editing">
      <input
        ref="input"
        v-model="draft"
        class="editable-input"
        :placeholder="placeholder"
        @keyup.enter="commitEditing"
        @keyup.esc="cancelEditing"
        @blur="onBlur"
      />
      <button class="editable-done" title="Done" @mousedown.prevent @click="commitEditing">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.2 8.6 L6.4 11.8 L12.8 4.6" />
        </svg>
      </button>
    </template>

    <button
      v-else
      class="editable-text"
      :class="{ blank: value.length === 0 }"
      :title="title"
      :disabled="disabled"
      @click="startEditing"
    >
      {{ value.length === 0 ? empty : value }}
    </button>
  </span>
</template>

<style scoped>
/* Block flex, not inline: shrink-to-fit would size the box to the text and then
   the negative margin below would pull it a hair under, so every value picked
   up an ellipsis it did not need. Filling the container also makes the text a
   wider thing to click. */
.editable {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  color: inherit;
}

.editable-text {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  margin: -1px -3px;
  padding: 1px 3px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editable-text:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.editable-text:focus-visible { outline: 1px solid var(--accent); }
.editable-text:disabled { cursor: default; background: transparent; opacity: 1; }
.editable-text.blank { color: var(--muted); font-style: italic; }

.editable-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  margin: -1px -1px -1px -3px;
  padding: 1px 2px;
  border: none;
  border-bottom: 1px solid var(--accent);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
}

.editable-done {
  flex: 0 0 auto;
  display: inline-flex;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  line-height: 0;
}

.editable-done svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.editable-done:hover { color: var(--ok); }
</style>
