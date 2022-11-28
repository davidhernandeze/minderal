<template>
  <div>
    <div>RTC settings</div>
    <div class="bg-gray-600 p-2">
      <button
        class="block text-green-500"
        @click="startConnection"
      >
        Create Offer
      </button>
      <div>local offer</div>
      <div class="break-all">{{ offerString }}</div>

      <div>remote offer</div>
      <textarea
        v-model="remoteDescription"
        class="bg-gray-500 rounded w-full"
        rows="5"
      />
      <button class="bg-green-500 px-1" @click="connect">Connect</button>
    </div>
    <div class="mt-10">
      <button
        class="block text-green-500"
        @click="receiveConnection"
      >
        Receive Connection
      </button>
      <div class="break-all">{{ remoteOfferString }}</div>
      <textarea
        v-model="receivedOfferString"
        class="bg-gray-500 rounded mt-2 w-full"
        rows="5"
      />
    </div>
    <div>
      <span>send msg: </span>
      <input v-model="message" type="text">
      <button
        class="ml-2 text-green-500"
        @click="sendMessage"
      >
        Send
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const signalingServer = '192.168.100.125:5984'

const message = ref()
const offerString = ref()
const remoteOfferString = ref()
const receivedOfferString = ref()
const remoteDescription = ref()

const peerConnection = new RTCPeerConnection()

async function startConnection () {
  peerConnection.onicecandidate = e => {
    offerString.value = peerConnection.localDescription
  }

  const dataChannel = peerConnection.createDataChannel('main')
  peerConnection.dc = dataChannel
  dataChannel.onmessage = (e) => {
    console.log('new message: ' + e.data)
  }
  dataChannel.onopen = () => console.log('connection opened!')

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
}

async function receiveConnection () {
  peerConnection.onicecandidate = e => {
    remoteOfferString.value = peerConnection.localDescription
  }
  peerConnection.ondatachannel = ({ channel }) => {
    peerConnection.dc = channel
    peerConnection.dc.onopen = e => console.log('connection opened!')
    peerConnection.dc.onmessage = e => {
      console.log('message received: ' + e.data)
    }
  }
  await peerConnection.setRemoteDescription(JSON.parse(receivedOfferString.value))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  console.log('answer created')
}

async function connect () {
  await peerConnection.setRemoteDescription(JSON.parse(remoteDescription.value))
}

function reconnect () {

}

function sendMessage () {
  peerConnection.dc.send(message.value)
}

</script>
