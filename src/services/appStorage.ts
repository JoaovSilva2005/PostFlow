import type { BrandProfile, PostDraft } from '../domain/models'

const keys = {
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

export const AppStorage = {
  loadSession: () => readJson(keys.session, false),
  saveSession: (isAuthenticated: boolean) => {
    localStorage.setItem(keys.session, JSON.stringify(isAuthenticated))
  },
  loadBrand: () => readJson<BrandProfile | null>(keys.brand, null),
  saveBrand: (brand: BrandProfile) => {
    localStorage.setItem(keys.brand, JSON.stringify(brand))
  },
  loadDrafts: () => readJson<PostDraft[]>(keys.drafts, []),
  saveDrafts: (drafts: PostDraft[]) => {
    localStorage.setItem(keys.drafts, JSON.stringify(drafts))
  },
}
