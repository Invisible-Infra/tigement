import { createRouter, createWebHistory } from 'vue-router'
import TableList from '@/components/table/TableList.vue'
import Login from '@/views/Login.vue'
import Register from '@/views/Register.vue'

const router = createRouter({
  history: createWebHistory('/frontend/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: TableList
    },
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/register',
      name: 'register',
      component: Register
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ]
})

router.beforeEach((to, from, next) => {
  const user = localStorage.getItem('user')
  const useLocal = localStorage.getItem('useLocal')

  if (to.meta.requiresAuth && !user && !useLocal) {
    // Only redirect to login if not using local storage and trying to access protected route
    next('/login')
  } else if ((to.path === '/login' || to.path === '/register') && user) {
    // Redirect to home if trying to access login/register while authenticated
    next('/')
  } else {
    next()
  }
})

export default router
