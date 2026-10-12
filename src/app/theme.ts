import { useSyncExternalStore } from 'react'

export type ThemePreference = 'dark' | 'light' | 'system'
export const THEME_STORAGE_KEY = 'postflow.theme'
const listeners = new Set<() => void>()
let preference: ThemePreference = readPreference()
let initialized = false
let media: MediaQueryList | undefined

function isPreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}
function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(value) ? value : 'dark'
  } catch {
    return 'dark'
  }
}
function applyTheme() {
  if (typeof document === 'undefined') return
  const resolved =
    preference === 'system' ? (media?.matches ? 'dark' : 'light') : preference
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'light' ? '#f3f4f5' : '#101112')
}
function notify() {
  applyTheme()
  listeners.forEach((listener) => listener())
}
export function initializeTheme() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener('change', () => {
    if (preference === 'system') notify()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return
    preference = readPreference()
    notify()
  })
  applyTheme()
}
export function setThemePreference(value: ThemePreference) {
  preference = value
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // Storage can be blocked; switching still works for this open session.
  }
  notify()
}
function subscribe(listener: () => void) {
  initializeTheme()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function useThemePreference() {
  const value = useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'dark' as ThemePreference,
  )
  return [value, setThemePreference] as const
}
