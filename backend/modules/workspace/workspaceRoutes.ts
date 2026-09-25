import { Router, type RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import {
  contentFormatDataSchema,
  contentFormatSchema,
} from '../../../shared/domain/contentFormats.js'
import {
  DEFAULT_POST_TIMEZONE,
  dateTimePartsInZone,
  isValidTimeZone,
  localDateTimeToIso,
} from '../../../shared/domain/contentTime.js'
import { socialPlatformSchema } from '../../../shared/domain/socialPlatforms.js'

const brandSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    segment: z.string().trim().min(2).max(120),
    toneOfVoice: z.string().trim().min(2).max(240),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    colorPalette: z
      .array(z.string().regex(/^#[0-9A-Fa-f]{6}$/))
      .min(1)
      .max(5)
      .optional(),
    description: z.string().trim().max(600).optional(),
    targetAudience: z.string().trim().max(400).optional(),
    productsOrServices: z.string().trim().max(600).optional(),
    differentials: z.string().trim().max(400).optional(),
    contentGoals: z.string().trim().max(400).optional(),
    keywords: z.string().trim().max(300).optional(),
    avoidTopics: z.string().trim().max(300).optional(),
    defaultCta: z.string().trim().max(180).optional(),
  })
  .strict()
const draftSchema = z
  .object({
    id: z.uuid().optional(),
    platform: socialPlatformSchema,
    title: z.string().trim().min(3).max(240),
    caption: z.string().trim().min(1).max(5000),
    hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
    visualText: z.string().trim().min(1).max(160),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    date: z.iso.date(),
    status: z.enum(['draft', 'scheduled', 'published']),
    format: contentFormatSchema.optional(),
    formatData: contentFormatDataSchema.optional(),
    persona: z.string().trim().max(160).optional(),
    time: z
      .string()
      .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    timezone: z.string().refine(isValidTimeZone).optional(),
  })
  .strict()

const batchDraftSchema = z
  .array(
    draftSchema.extend({
      id: z.uuid(),
      platform: socialPlatformSchema,
      status: z.literal('draft'),
      format: contentFormatSchema,
      formatData: contentFormatDataSchema,
      persona: z.string().trim().max(160),
      time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      timezone: z.string().refine(isValidTimeZone),
    }),
  )
  .min(1)
  .max(42)
function parse<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? 'Dados inválidos.',
    )
  return result.data
}
function workspaceId(request: Parameters<RequestHandler>[0]) {
  if (!request.workspaceContext)
    throw new HttpError(400, 'Contexto de workspace ausente.')
  return request.workspaceContext.workspaceId
}
function dbBrand(row: z.infer<typeof brandSchema>) {
  const brand: Record<string, unknown> = {
    name: row.name,
    segment: row.segment,
    tone_of_voice: row.toneOfVoice,
    primary_color: row.primaryColor,
  }
  if (row.colorPalette !== undefined) brand.color_palette = row.colorPalette
  const optionalFields: Array<[keyof typeof row, string]> = [
    ['description', 'description'],
    ['targetAudience', 'target_audience'],
    ['productsOrServices', 'products_or_services'],
    ['differentials', 'differentials'],
    ['contentGoals', 'content_goals'],
    ['keywords', 'keywords'],
    ['avoidTopics', 'avoid_topics'],
    ['defaultCta', 'default_cta'],
  ]
  for (const [field, column] of optionalFields) {
    const value = row[field]
    if (value !== undefined) brand[column] = value
  }
  return brand
}
interface PlatformInfo {
  id: string
  name: string
  character_limit: number
}

async function platformInfoByName(
  supabase: SupabaseClient,
  platform: string,
): Promise<PlatformInfo> {
  const { data, error } = await supabase
    .from('social_platforms')
    .select('id,name,character_limit')
    .eq('name', platform)
    .maybeSingle()
  if (error) throw new Error(`Falha ao consultar plataforma: ${error.message}`)
  if (!data) throw new HttpError(400, 'Plataforma não encontrada.')
  return data as PlatformInfo
}

async function platformInfoById(supabase: SupabaseClient, platformId: string) {
  const { data, error } = await supabase
    .from('social_platforms')
    .select('id,name,character_limit')
    .eq('id', platformId)
    .maybeSingle()
  if (error) throw new Error(`Falha ao consultar plataforma: ${error.message}`)
  if (!data) throw new HttpError(400, 'Plataforma não encontrada.')
  return data as PlatformInfo
}

function validateCaptionLength(
  platform: PlatformInfo,
  caption: string,
  hashtags: string[],
) {
  const composedCaption = `${caption}${hashtags.length ? `\n${hashtags.join(' ')}` : ''}`
  const characterCount = Array.from(composedCaption).length
  if (characterCount > platform.character_limit) {
    throw new HttpError(
      400,
      `A legenda e as hashtags excedem o limite de ${platform.character_limit} caracteres de ${platform.name}.`,
    )
  }
}

function throwDraftWriteError(error: unknown, operation: string): never {
  const details =
    error && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown })
      : {}
  if (
    details.code === '22023' &&
    details.message === 'platform_character_limit_exceeded'
  ) {
    throw new HttpError(
      400,
      'A legenda e as hashtags excedem o limite de caracteres da plataforma.',
    )
  }
  throw new Error(
    `${operation}: ${typeof details.message === 'string' ? details.message : 'erro desconhecido'}`,
  )
}
function dbDraft(
  row: z.infer<typeof draftSchema>,
  brandId: string,
  platformId: string,
) {
  const timezone = row.timezone ?? DEFAULT_POST_TIMEZONE
  const format = row.format ?? 'static'
  return {
    brand_id: brandId,
    platform_id: platformId,
    title: row.title,
    caption: row.caption,
    visual_text: row.visualText,
    color: row.color,
    scheduled_at: localDateTimeToIso(row.date, row.time ?? '12:00', timezone),
    status: row.status,
    content_format: format,
    audience_persona: row.persona ?? '',
    schedule_timezone: timezone,
    format_data: row.formatData ?? {
      kind: 'static',
      headline: row.visualText.slice(0, 120),
      visualDirection: row.visualText,
    },
  }
}
function toDraft(row: any) {
  const timezone = row.schedule_timezone ?? DEFAULT_POST_TIMEZONE
  const scheduled = dateTimePartsInZone(row.scheduled_at, timezone)
  const format = contentFormatSchema.safeParse(row.content_format).success
    ? row.content_format
    : 'static'
  const formatData = contentFormatDataSchema.safeParse(row.format_data)
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    hashtags: (row.post_hashtags ?? []).map((tag: any) => tag.hashtag),
    platform: row.social_platforms?.name ?? '',
    date: scheduled?.date ?? String(row.scheduled_at).slice(0, 10),
    time: scheduled?.time ?? '12:00',
    timezone,
    status: row.status,
    visualText: row.visual_text,
    color: row.color,
    format,
    persona: row.audience_persona ?? '',
    formatData: formatData.success
      ? formatData.data
      : {
          kind: 'static',
          headline: String(row.visual_text ?? '').slice(0, 120),
          visualDirection: row.visual_text ?? '',
        },
  }
}

export function createWorkspaceRouter(
  supabase: SupabaseClient,
  authorizeWrite: RequestHandler,
) {
  const router = Router({ mergeParams: true })
  router.get('/brand', async (request, response) => {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', workspaceId(request))
      .maybeSingle()
    if (error) throw new Error(`Falha ao consultar marca: ${error.message}`)
    if (!data) throw new HttpError(404, 'Marca não encontrada.')
    response.json({
      data: {
        name: data.name,
        segment: data.segment,
        toneOfVoice: data.tone_of_voice,
        primaryColor: data.primary_color,
        colorPalette: Array.isArray(data.color_palette)
          ? data.color_palette
          : [],
        description: data.description ?? '',
        targetAudience: data.target_audience ?? '',
        productsOrServices: data.products_or_services ?? '',
        differentials: data.differentials ?? '',
        contentGoals: data.content_goals ?? '',
        keywords: data.keywords ?? '',
        avoidTopics: data.avoid_topics ?? '',
        defaultCta: data.default_cta ?? '',
      },
    })
  })
  router.put('/brand', authorizeWrite, async (request, response) => {
    const { data, error } = await supabase
      .from('brands')
      .update(dbBrand(parse(brandSchema, request.body)))
      .eq('id', workspaceId(request))
      .select('*')
      .maybeSingle()
    if (error) throw new Error(`Falha ao atualizar marca: ${error.message}`)
    if (!data) throw new HttpError(404, 'Marca não encontrada.')
    response.json({
      data: {
        name: data.name,
        segment: data.segment,
        toneOfVoice: data.tone_of_voice,
        primaryColor: data.primary_color,
        colorPalette: Array.isArray(data.color_palette)
          ? data.color_palette
          : [],
        description: data.description ?? '',
        targetAudience: data.target_audience ?? '',
        productsOrServices: data.products_or_services ?? '',
        differentials: data.differentials ?? '',
        contentGoals: data.content_goals ?? '',
        keywords: data.keywords ?? '',
        avoidTopics: data.avoid_topics ?? '',
        defaultCta: data.default_cta ?? '',
      },
    })
  })
  router.get('/drafts', async (request, response) => {
    const { data, error } = await supabase
      .from('post_drafts')
      .select('*,social_platforms(name),post_hashtags(hashtag)')
      .eq('brand_id', workspaceId(request))
      .order('scheduled_at')
    if (error) throw new Error(`Falha ao listar posts: ${error.message}`)
    response.json({ data: (data ?? []).map(toDraft) })
  })
  router.post('/drafts', authorizeWrite, async (request, response) => {
    const input = parse(draftSchema, request.body)
    const platform = await platformInfoByName(supabase, input.platform)
    validateCaptionLength(platform, input.caption, input.hashtags)
    const { data, error } = await supabase.rpc(
      'create_post_draft_with_hashtags',
      {
        p_brand_id: workspaceId(request),
        p_draft: {
          ...dbDraft(input, workspaceId(request), platform.id),
          hashtags: input.hashtags,
        },
      },
    )
    if (error) throwDraftWriteError(error, 'Falha ao criar post')
    const created = Array.isArray(data) ? data[0] : data
    if (!created) throw new Error('A gravação do rascunho não retornou dados.')
    response.status(201).json({
      data: toDraft(created),
    })
  })
  router.post('/drafts/batch', authorizeWrite, async (request, response) => {
    const input = parse(batchDraftSchema, request.body)
    const platformNames = [...new Set(input.map((draft) => draft.platform))]
    const platformInfos = await Promise.all(
      platformNames.map((platform) => platformInfoByName(supabase, platform)),
    )
    const platformByName = new Map(
      platformInfos.map((platform) => [platform.name, platform]),
    )
    for (const draft of input) {
      const platform = platformByName.get(draft.platform)
      if (!platform) throw new HttpError(400, 'Plataforma não encontrada.')
      validateCaptionLength(platform, draft.caption, draft.hashtags)
    }
    const { data: ids, error } = await supabase.rpc(
      'create_post_drafts_batch',
      {
        p_brand_id: workspaceId(request),
        p_drafts: input,
      },
    )
    if (error) throwDraftWriteError(error, 'Falha ao salvar o lote de posts')
    if (
      !ids ||
      ids.length !== input.length ||
      input.some((draft, index) => ids[index] !== draft.id)
    ) {
      throw new Error('O lote não retornou todos os rascunhos salvos.')
    }

    response.status(201).json({ data: input })
  })
  router.patch(
    '/drafts/:draftId',
    authorizeWrite,
    async (request, response) => {
      const input = parse(
        draftSchema.partial().refine((value) => Object.keys(value).length > 0),
        request.body,
      )
      const id = parse(z.uuid(), request.params.draftId)
      const { data: current, error: currentError } = await supabase
        .from('post_drafts')
        .select(
          'scheduled_at,schedule_timezone,caption,platform_id,post_hashtags(hashtag)',
        )
        .eq('id', id)
        .eq('brand_id', workspaceId(request))
        .maybeSingle()
      if (currentError)
        throw new Error(`Falha ao consultar rascunho: ${currentError.message}`)
      if (!current) throw new HttpError(404, 'Post não encontrado.')

      const patch: Record<string, unknown> = {}
      let targetPlatform: PlatformInfo | undefined
      if (input.platform !== undefined) {
        targetPlatform = await platformInfoByName(supabase, input.platform)
        patch.platform_id = targetPlatform.id
      }
      if (input.title !== undefined) patch.title = input.title
      if (input.caption !== undefined) patch.caption = input.caption
      if (input.visualText !== undefined) patch.visual_text = input.visualText
      if (input.color !== undefined) patch.color = input.color
      if (
        input.caption !== undefined ||
        input.platform !== undefined ||
        input.hashtags !== undefined
      ) {
        const platform =
          targetPlatform ??
          (await platformInfoById(supabase, current.platform_id))
        const currentHashtags = (current.post_hashtags ?? []).map(
          (tag: { hashtag: string }) => tag.hashtag,
        )
        validateCaptionLength(
          platform,
          input.caption ?? current.caption,
          input.hashtags ?? currentHashtags,
        )
      }
      if (
        input.date !== undefined ||
        input.time !== undefined ||
        input.timezone !== undefined
      ) {
        const timezone =
          input.timezone ?? current.schedule_timezone ?? DEFAULT_POST_TIMEZONE
        const currentParts = dateTimePartsInZone(
          current.scheduled_at,
          current.schedule_timezone ?? DEFAULT_POST_TIMEZONE,
        )
        patch.scheduled_at = localDateTimeToIso(
          input.date ??
            currentParts?.date ??
            String(current.scheduled_at).slice(0, 10),
          input.time ?? currentParts?.time ?? '12:00',
          timezone,
        )
        patch.schedule_timezone = timezone
      }
      if (input.format !== undefined) patch.content_format = input.format
      if (input.formatData !== undefined) patch.format_data = input.formatData
      if (input.persona !== undefined) patch.audience_persona = input.persona
      if (input.status !== undefined) patch.status = input.status
      const { data, error } = await supabase.rpc(
        'update_post_draft_with_hashtags',
        {
          p_brand_id: workspaceId(request),
          p_post_id: id,
          p_patch: patch,
          p_hashtags: input.hashtags ?? null,
        },
      )
      if (error) throwDraftWriteError(error, 'Falha ao atualizar post')
      const updated = Array.isArray(data) ? data[0] : data
      if (!updated) throw new HttpError(404, 'Post não encontrado.')
      response.json({
        data: toDraft(updated),
      })
    },
  )
  router.delete(
    '/drafts/:draftId',
    authorizeWrite,
    async (request, response) => {
      const id = parse(z.uuid(), request.params.draftId)
      const { data, error } = await supabase
        .from('post_drafts')
        .delete()
        .eq('id', id)
        .eq('brand_id', workspaceId(request))
        .select('id')
      if (error) throw new Error(`Falha ao excluir post: ${error.message}`)
      if (!data?.length) throw new HttpError(404, 'Post não encontrado.')
      response.status(204).send()
    },
  )
  return router
}
