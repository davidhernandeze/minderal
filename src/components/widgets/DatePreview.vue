<script setup>
import { Doc } from '@/classes/Doc.js'
import { computed } from 'vue'
import moment from 'moment'

defineEmits(['update'])
const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
console.log(props.doc)

const dateString = computed(() => {
  if (props.doc.content) {
    return formatDateTime(props.doc.content)
  }
  return ''
})

function formatDateTime(obj) {
  const { year, month, day, time } = obj;

  // Build a date with what's available
  const components = [];

  if (day != null) {
    components.push(String(day).padStart(2, '0'));
  }

  if (month != null) {
    const monthName = moment().month(month).format("MMM"); // short month name
    components.push("of " + monthName);
  }

  if (year != null) {
    components.push(String(year));
  }

  let dateStr = components.join(" ");

  if (time != null) {
    if (dateStr) {
      dateStr += " at " + time;
    } else {
      dateStr = time;
    }
  }

  return dateStr.trim();
}
</script>

<template>
  <div>{{ dateString }}</div>
</template>
