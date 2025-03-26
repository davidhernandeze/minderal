<script setup>
import { computed } from 'vue'
import { Doc } from '@/classes/Doc.js'
import moment from 'moment'
import themeStore from '@/stores/theme.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const date = computed(() => {
  if (props.doc.content) {
    return moment()
      .year(props.doc.content.year)
      .month(props.doc.content.month)
      .date(props.doc.content.day)
      .hour(props.doc.content.time ? moment(props.doc.content.time, 'HH:mm').hour() : 0)
      .minute(props.doc.content.time ? moment(props.doc.content.time, 'HH:mm').minute() : 0)
  }
  return moment()
})
</script>

<template>
  <div class="flex items-center justify-evenly gap-4 overflow-auto">
    <countdown-timer
      :date="date"
      heading="Event Starts In"
      :theme="themeStore.isDarkTheme ? 'dark' : 'light'"
      message="The event has begun!"
    />
  </div>
</template>
