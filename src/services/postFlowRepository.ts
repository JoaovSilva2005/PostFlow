import type { BrandProfile, PostDraft } from '../domain/models'
import { getSupabaseClient } from './supabaseClient'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

interface ProjectData {
  brand: BrandProfile | null
  drafts: PostDraft[]
}

interface BrandRow {
  id: string
  name: string
  segment: string
  tone_of_voice: string
  primary_color: string
}

interface DraftRow {
  id: string
  title: string
  caption: string
  visual_text: string
  color: string
  scheduled_at: string
  status: PostDraft['status']
  social_platforms: { name: string } | Array<{ name: string }> | null
  post_hashtags: Array<{ hashtag: string }> | null
}

export interface PostFlowDataRepository {
  load(): Promise<ProjectData>
  saveBrand(brand: BrandProfile): Promise<BrandProfile>
  createDraft(draft: PostDraft): Promise<PostDraft>
  updateDraft(draft: PostDraft): Promise<PostDraft>
  deleteDraft(id: string): Promise<void>
}

function toBrand(row: BrandRow): BrandProfile {
  return {
    name: row.name,
    segment: row.segment,
    toneOfVoice: row.tone_of_voice,
    primaryColor: row.primary_color,
  }
}

function platformName(platform: DraftRow['social_platforms']): string {
  if (Array.isArray(platform)) {
    return platform[0]?.name ?? 'Instagram'
  }

  return platform?.name ?? 'Instagram'
}

function toDraft(row: DraftRow): PostDraft {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    visualText: row.visual_text,
    color: row.color,
    date: row.scheduled_at.slice(0, 10),
    status: row.status,
    platform: platformName(row.social_platforms),
    hashtags: (row.post_hashtags ?? []).map(({ hashtag }) => hashtag),
  }
}

function databaseError(operation: string, message: string): Error {
  return new Error(`Falha ao ${operation} no Supabase: ${message}`)
}

async function findBrandId(): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .eq('user_id', DEMO_USER_ID)
    .maybeSingle()

  if (error) {
    throw databaseError('consultar a marca', error.message)
  }

  if (!data) {
    throw new Error('Cadastre a marca antes de criar publicações.')
  }

  return data.id as string
}

async function findPlatformId(name: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('social_platforms')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (error) {
    throw databaseError('consultar a plataforma', error.message)
  }

  if (!data) {
    throw new Error(`A plataforma ${name} não está cadastrada no banco.`)
  }

  return data.id as string
}

async function replaceHashtags(
  postId: string,
  hashtags: string[],
): Promise<void> {
  const supabase = getSupabaseClient()
  const { error: deleteError } = await supabase
    .from('post_hashtags')
    .delete()
    .eq('post_id', postId)

  if (deleteError) {
    throw databaseError('atualizar as hashtags', deleteError.message)
  }

  const uniqueHashtags = [...new Set(hashtags)]
  if (uniqueHashtags.length === 0) {
    return
  }

  const { error: insertError } = await supabase.from('post_hashtags').insert(
    uniqueHashtags.map((hashtag) => ({
      post_id: postId,
      hashtag,
    })),
  )

  if (insertError) {
    throw databaseError('salvar as hashtags', insertError.message)
  }
}

export const SupabasePostFlowRepository: PostFlowDataRepository = {
  async load() {
    const supabase = getSupabaseClient()
    const { data: brandData, error: brandError } = await supabase
      .from('brands')
      .select('id, name, segment, tone_of_voice, primary_color')
      .eq('user_id', DEMO_USER_ID)
      .maybeSingle()

    if (brandError) {
      throw databaseError('carregar a marca', brandError.message)
    }

    if (!brandData) {
      return { brand: null, drafts: [] }
    }

    const brandRow = brandData as BrandRow
    const { data: draftsData, error: draftsError } = await supabase
      .from('post_drafts')
      .select(
        `
          id,
          title,
          caption,
          visual_text,
          color,
          scheduled_at,
          status,
          social_platforms!post_drafts_platform_id_fkey (name),
          post_hashtags (hashtag)
        `,
      )
      .eq('brand_id', brandRow.id)
      .order('scheduled_at')

    if (draftsError) {
      throw databaseError('carregar as publicações', draftsError.message)
    }

    return {
      brand: toBrand(brandRow),
      drafts: (draftsData as unknown as DraftRow[]).map(toDraft),
    }
  },

  async saveBrand(brand) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('brands')
      .upsert(
        {
          user_id: DEMO_USER_ID,
          name: brand.name,
          segment: brand.segment,
          tone_of_voice: brand.toneOfVoice,
          primary_color: brand.primaryColor,
        },
        { onConflict: 'user_id' },
      )
      .select('id, name, segment, tone_of_voice, primary_color')
      .single()

    if (error) {
      throw databaseError('salvar a marca', error.message)
    }

    return toBrand(data as BrandRow)
  },

  async createDraft(draft) {
    const supabase = getSupabaseClient()
    const [brandId, platformId] = await Promise.all([
      findBrandId(),
      findPlatformId(draft.platform),
    ])
    const { data, error } = await supabase
      .from('post_drafts')
      .insert({
        brand_id: brandId,
        platform_id: platformId,
        title: draft.title,
        caption: draft.caption,
        visual_text: draft.visualText,
        color: draft.color,
        scheduled_at: `${draft.date}T12:00:00Z`,
        status: draft.status,
      })
      .select('id')
      .single()

    if (error) {
      throw databaseError('criar a publicação', error.message)
    }

    const createdDraft = { ...draft, id: data.id as string }

    try {
      await replaceHashtags(createdDraft.id, createdDraft.hashtags)
    } catch (hashtagError) {
      await supabase.from('post_drafts').delete().eq('id', createdDraft.id)
      throw hashtagError
    }

    return createdDraft
  },

  async updateDraft(draft) {
    const supabase = getSupabaseClient()
    const platformId = await findPlatformId(draft.platform)
    const { error } = await supabase
      .from('post_drafts')
      .update({
        platform_id: platformId,
        title: draft.title,
        caption: draft.caption,
        visual_text: draft.visualText,
        color: draft.color,
        scheduled_at: `${draft.date}T12:00:00Z`,
        status: draft.status,
      })
      .eq('id', draft.id)

    if (error) {
      throw databaseError('editar a publicação', error.message)
    }

    await replaceHashtags(draft.id, draft.hashtags)
    return draft
  },

  async deleteDraft(id) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('post_drafts').delete().eq('id', id)

    if (error) {
      throw databaseError('excluir a publicação', error.message)
    }
  },
}
