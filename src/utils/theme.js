const STORAGE_KEY = 'app-theme';

export function loadAppTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'night' ? 'night' : 'light';
}

export function saveAppTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyAppTheme(theme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'night');
}
