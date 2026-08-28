import type { BrandProfile, PostDraft } from '../domain/models'
import type { PostFlowDataRepository } from '../services/postFlowRepository'

interface TestData {
  brand?: BrandProfile | null
  drafts?: PostDraft[]
}

export interface TestRepository extends PostFlowDataRepository {
  snapshot(): { brand: BrandProfile | null; drafts: PostDraft[] }
}

export function createTestRepository(initial: TestData = {}): TestRepository {
  let brand = initial.brand ?? null
  let drafts = [...(initial.drafts ?? [])]
  let nextId = drafts.length + 1

  return {
    async load() {
      return { brand, drafts: [...drafts] }
    },
    async saveBrand(nextBrand) {
      brand = { ...nextBrand }
      return brand
    },
    async createDraft(draft) {
      const createdDraft = { ...draft, id: `database-draft-${nextId++}` }
      drafts = [...drafts, createdDraft]
      return createdDraft
    },
    async updateDraft(updatedDraft) {
      drafts = drafts.map((draft) =>
        draft.id === updatedDraft.id ? updatedDraft : draft,
      )
      return updatedDraft
    },
    async deleteDraft(id) {
      drafts = drafts.filter((draft) => draft.id !== id)
    },
    snapshot() {
      return { brand, drafts: [...drafts] }
    },
  }
}
