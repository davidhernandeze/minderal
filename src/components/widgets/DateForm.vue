<script setup>
import { nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import moment from 'moment'

const props = defineProps({
  doc: {
    type: Object,
    required: false,
  },
})

const emits = defineEmits(['submit'])

const day = ref(null)
const month = ref(null)
const year = ref(null)
const time = ref(null)
const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'date',
  content: props.doc?.content || {},
})

watch(month, (value) => {
  if (value) {
    day.value = moment(month.value).date(1).toDate()
  }
})

function submit() {
  form.value.content = {
    year: moment(year.value).year(),
    month: moment(month.value).month(),
    day: moment(day.value).date(),
    time: time.value ? moment(time.value).format('HH:mm') : null,
    offset: moment().utcOffset(),
  }
  emits('submit', form.value)
}

async function setFromCurrent() {
  year.value = new Date()
  month.value = new Date()
  await nextTick()
  day.value = new Date()
  time.value = new Date()
}
</script>

<template>
  <form class="text-gray-200 flex flex-col gap-4" @submit.prevent="submit">
    <div class="flex gap-3">
      <div class="flex flex-col gap-2 w-[13rem]">
        <label for="year">Year</label>
        <DatePicker id="year" v-model="year" showButtonBar view="year" dateFormat="yy" />
      </div>
      <div class="flex flex-col gap-2">
        <label for="month">Month</label>
        <DatePicker
          id="month"
          v-model="month"
          showButtonBar
          view="month"
          dateFormat="MM"
          pt:header:class="!hidden"
        />
      </div>
      <div class="flex flex-col gap-2 w-16">
        <label for="day">Day</label>
        <DatePicker
          id="day"
          v-model="day"
          showButtonBar
          view="date"
          dateFormat="dd"
          pt:header:class="!hidden"
        />
      </div>
      <div class="flex flex-col gap-2 w-36">
        <label for="day">Time</label>
        <DatePicker id="day" v-model="time" showButtonBar showTime hourFormat="12" timeOnly />
      </div>
    </div>
    <div>
      <Button @click="setFromCurrent" label="Set from current time" size="small" variant="text" />
    </div>
    <div class="flex justify-end">
      <Button @click="submit">Save</Button>
    </div>
  </form>
</template>
