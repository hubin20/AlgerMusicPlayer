const layoutRouter = [
  {
    path: '/',
    name: 'home',
    meta: {
      title: '首页',
      icon: 'icon-Home',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/home/index.vue')
  },
  {
    path: '/search',
    name: 'search',
    meta: {
      title: '搜索',
      noScroll: true,
      icon: 'icon-Search',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/search/index.vue')
  },
  {
    path: '/list',
    name: 'list',
    meta: {
      title: '歌单',
      icon: 'icon-Paper',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/list/index.vue')
  },
  {
    path: '/toplist',
    name: 'toplist',
    meta: {
      title: '排行榜',
      icon: 'ri-bar-chart-grouped-fill',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/toplist/index.vue')
  },
  {
    path: '/mv',
    name: 'mv',
    meta: {
      title: 'MV',
      icon: 'icon-recordfill',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/mv/index.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/historyAndFavorite/index.vue'),
    meta: {
      title: '收藏历史',
      icon: 'icon-a-TicketStar',
      keepAlive: true,
      isMobile: true
    }
  },
  {
    path: '/user',
    name: 'user',
    meta: {
      title: '用户',
      icon: 'icon-Profile',
      keepAlive: true,
      noScroll: true,
      isMobile: true
    },
    component: () => import('@/views/user/index.vue')
  },
  {
    path: '/set',
    name: 'set',
    meta: {
      title: '设置',
      icon: 'ri-settings-3-fill',
      keepAlive: true,
      noScroll: true,
      isMobile: true
    },
    component: () => import('@/views/set/index.vue')
  }
];
export default layoutRouter;
