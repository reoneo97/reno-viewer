// Theme management: persisted in localStorage, defaults to OS preference.
// initTheme() runs before React renders (from main.tsx) to avoid a flash
// of the wrong theme.
//
// Three themes ship today: the default neutral-slate "dark" and "light",
// plus a warm terracotta theme suited to interior-design work. The toolbar
// toggle cycles through them in THEME_ORDER.

export type Theme = 'light' | 'dark' | 'warm'

export const THEME_ORDER: Theme[] = ['dark', 'light', 'warm']

const STORAGE_KEY = 'reno-theme'

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark' || v === 'warm'
}

export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return isTheme(v) ? v : null
}

export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? 'warm'
}

export function nextTheme(theme: Theme): Theme {
  const i = THEME_ORDER.indexOf(theme)
  return THEME_ORDER[(i + 1) % THEME_ORDER.length]
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(resolveInitialTheme())
}
