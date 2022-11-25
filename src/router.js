import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  scrollBehavior: () => ({ left: 0, top: 0 }),
  history: createWebHashHistory(),
  routes: [
    {
      path: '/:id?',
      name: 'document',
      component: Workspace,
      props: true,
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const currentTenant = localStorage.getItem('tenant')
  if (to.name === 'login' && currentTenant) {
    next({ name: 'devices' })
    return
  }
  if (to.name !== 'login' && !currentTenant) {
    next({ name: 'login' })
    return
  }
  next()
})

export default router

