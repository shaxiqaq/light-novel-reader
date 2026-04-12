import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import BookView from '../views/BookView.vue';
import ReaderView from '../views/ReaderView.vue';
import HistoryView from '../views/HistoryView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView
    },
    {
      path: '/book/:pathWord',
      name: 'book',
      component: BookView,
      props: true
    },
    {
      path: '/book/:pathWord/volume/:volumeId',
      name: 'reader',
      component: ReaderView,
      props: true
    }
  ],
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
