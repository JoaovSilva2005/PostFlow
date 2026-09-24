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
    caption: z.string().trim().min(1),
    hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
    visualText: z.string().trim().min(1),
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
  const brand: Record<string, string> = {
    name: row.name,
    segment: row.segment,
    tone_of_voice: row.toneOfVoice,
    primary_color: row.primaryColor,
  }
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
async function platformId(supabase: SupabaseClient, platform: string) {
  const { data, error } = await supabase
    .from('social_platforms')
    .select('id')
    .eq('name', platform)
    .maybeSingle()
  if (error) throw new Error(`Falha ao consultar plataforma: ${error.message}`)
  if (!data) throw new HttpError(400, 'Plataforma não encontrada.')
  return data.id
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
    const { data, error } = await supabase
      .from('post_drafts')
      .insert(
        dbDraft(
          input,
          workspaceId(request),
          await platformId(supabase, input.platform),
        ),
      )
      .select('*,social_platforms(name),post_hashtags(hashtag)')
      .single()
    if (error) throw new Error(`Falha ao criar post: ${error.message}`)
    await supabase
      .from('post_hashtags')
      .insert(input.hashtags.map((hashtag) => ({ post_id: data.id, hashtag })))
    response.status(201).json({
      data: toDraft({
        ...data,
        post_hashtags: input.hashtags.map((hashtag) => ({ hashtag })),
      }),
    })
  })
  router.post('/drafts/batch', authorizeWrite, async (request, response) => {
    const input = parse(batchDraftSchema, request.body)
    const { data: ids, error } = await supabase.rpc(
      'create_post_drafts_batch',
      {
        p_brand_id: workspaceId(request),
        p_drafts: input,
      },
    )
    if (error)
      throw new Error(`Falha ao salvar o lote de posts: ${error.message}`)
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
      const patch: Record<string, unknown> = {}
      if (input.platform !== undefined)
        patch.platform_id = await platformId(supabase, input.platform)
      if (input.title !== undefined) patch.title = input.title
      if (input.caption !== undefined) patch.caption = input.caption
      if (input.visualText !== undefined) patch.visual_text = input.visualText
      if (input.color !== undefined) patch.color = input.color
      if (
        input.date !== undefined ||
        input.time !== undefined ||
        input.timezone !== undefined
      ) {
        const { data: current, error: currentError } = await supabase
          .from('post_drafts')
          .select('scheduled_at,schedule_timezone')
          .eq('id', request.params.draftId)
          .eq('brand_id', workspaceId(request))
          .maybeSingle()
        if (currentError)
          throw new Error(
            `Falha ao consultar horário do post: ${currentError.message}`,
          )
        if (!current) throw new HttpError(404, 'Post não encontrado.')
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
      const id = parse(z.uuid(), request.params.draftId)
      const { data, error } = await supabase
        .from('post_drafts')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', workspaceId(request))
        .select('*,social_platforms(name),post_hashtags(hashtag)')
        .maybeSingle()
      if (error) throw new Error(`Falha ao atualizar post: ${error.message}`)
      if (!data) throw new HttpError(404, 'Post não encontrado.')
      if (input.hashtags !== undefined) {
        await supabase.from('post_hashtags').delete().eq('post_id', id)
        if (input.hashtags.length)
          await supabase
            .from('post_hashtags')
            .insert(input.hashtags.map((hashtag) => ({ post_id: id, hashtag })))
      }
      response.json({
        data: toDraft({
          ...data,
          post_hashtags:
            input.hashtags?.map((hashtag) => ({ hashtag })) ??
            data.post_hashtags,
        }),
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
