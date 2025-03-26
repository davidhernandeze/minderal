import { ref } from 'vue'

export default () => {
  const urlPreview = ref({ url: null })

  async function fetchLinkPreview() {
    if (!urlPreview.value.url || urlPreview.value.url === '') return
    const apiUrl = `https://link-preview-api.nivaldo.workers.dev/preview?url=${encodeURIComponent(urlPreview.value.url)}`
    const headers = {
      accept: '*/*'
    }

    try {
      const response = await fetch(apiUrl, { method: 'GET', headers })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      urlPreview.value = data
    } catch (error) {
      console.error('Error fetching the link preview:', error)
    }
  }

  return {
    fetchLinkPreview,
    urlPreview
  }
}
