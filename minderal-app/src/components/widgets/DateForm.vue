<script setup>
import { nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import moment from 'moment'

const props = defineProps({
  doc: {
    type: Object,
    default: null,
    required: false
  }
})

const emits = defineEmits(['submit'])

const day = ref(moment(props.doc?.content?.day).toDate() ?? null)
const month = ref(moment(props.doc?.content?.month).toDate() ?? null)
const year = ref(moment(props.doc?.content?.year).toDate() ?? null)
const time = ref(moment(props.doc?.content?.time).toDate() ?? null)
const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'date',
  content: props.doc?.content || {}
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
    offset: moment().utcOffset()
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
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="flex flex-col gap-2 w-full sm:w-[13rem]">
        <label for="year">Year</label>
        <DatePicker id="year" v-model="year" show-button-bar view="year" date-format="yy" />
      </div>
      <div class="flex flex-col gap-2">
        <label for="month">Month</label>
        <DatePicker
          id="month"
          v-model="month"
          show-button-bar
          view="month"
          date-format="MM"
          pt:header:class="!hidden"
        />
      </div>
      <div class="flex flex-col gap-2 w-full sm:w-16">
        <label for="day">Day</label>
        <DatePicker
          id="day"
          v-model="day"
          show-button-bar
          view="date"
          date-format="dd"
          pt:header:class="!hidden"
        />
      </div>
      <div class="flex flex-col gap-2 w-full sm:w-36">
        <label for="day">Time</label>
        <DatePicker id="day" v-model="time" show-button-bar show-time hour-format="12" time-only />
      </div>
    </div>
    <div>
      <Button label="Set from current time" size="small" variant="text" @click="setFromCurrent" />
    </div>
    <div class="flex justify-end">
      <Button @click="submit">Save</Button>
    </div>
  </form>
</template>
