import { useConfirm } from 'primevue/useconfirm'

export default async (importFn) => {
  const confirm = useConfirm()
  try {
    return await importFn()
  } catch (error) {
    console.log(error)
    confirm.require({
      header: 'Update available',
      message: 'There is a new version of the app available',
      acceptLabel: 'Reload',
      rejectClass: '!hidden',
      onHide: () => window.location.reload(true),
      accept: () => window.location.reload(true)
    })
  }
}
