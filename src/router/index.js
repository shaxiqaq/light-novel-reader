import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import BookView from '../views/BookView.vue';
import ReaderView from '../views/ReaderView.vue';
import HistoryView from '../views/HistoryView.vue';
import MangaHomeView from '../views/MangaHomeView.vue';
import ComicView from '../views/ComicView.vue';
import ComicReaderView from '../views/ComicReaderView.vue';
import LandingView from '../views/LandingView.vue';
import AccountView from '../views/AccountView.vue';
import FavoritesView from '../views/FavoritesView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingView,
      meta: { section: 'landing' }
    },
    {
      path: '/novels',
      name: 'novel-home',
      component: HomeView,
      meta: { section: 'novel' }
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
      meta: { section: 'novel' }
    },
    {
      path: '/account',
      name: 'account',
      component: AccountView,
      meta: { section: 'landing' }
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: FavoritesView,
      meta: { section: 'landing' }
    },
    {
      path: '/manga',
      name: 'manga-home',
      component: MangaHomeView,
      meta: { section: 'manga' }
    },
    {
      path: '/comic/:pathWord',
      name: 'comic',
      component: ComicView,
      props: true,
      meta: { section: 'manga' }
    },
    {
      path: '/comic/:pathWord/chapter/:chapterUuid',
      name: 'comic-reader',
      component: ComicReaderView,
      props: true,
      meta: { section: 'manga' }
    },
    {
      path: '/book/:pathWord',
      name: 'book',
      component: BookView,
      props: true,
      meta: { section: 'novel' }
    },
    {
      path: '/book/:pathWord/volume/:volumeId',
      name: 'reader',
      component: ReaderView,
      props: true,
      meta: { section: 'novel' }
    }
  ],
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
