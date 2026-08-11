import type { BrandProfile, PostDraft } from '../domain/models'

const STORAGE_KEYS = {
  session: 'postflow:session',
  brand: 'postflow:brand',
  drafts: 'postflow:drafts',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export const AppStorage = {
  loadSession: () => readJson(STORAGE_KEYS.session, false),
  saveSession: (isAuthenticated: boolean) =>
    writeJson(STORAGE_KEYS.session, isAuthenticated),
  loadBrand: () => readJson<BrandProfile | null>(STORAGE_KEYS.brand, null),
  saveBrand: (brand: BrandProfile) => writeJson(STORAGE_KEYS.brand, brand),
  loadDrafts: () => readJson<PostDraft[]>(STORAGE_KEYS.drafts, []),
  saveDrafts: (drafts: PostDraft[]) => writeJson(STORAGE_KEYS.drafts, drafts),
}
