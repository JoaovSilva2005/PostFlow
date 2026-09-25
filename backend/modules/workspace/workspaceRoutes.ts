import { Router, type RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { Buffer } from 'node:buffer'
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

const draftCreateSchema = draftSchema.extend({
  imageUrl: z
    .string()
    .max(6_000_000)
    .refine(
      (value) =>
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
        /^https:\/\//.test(value),
      'A imagem gerada possui um formato inválido.',
    )
    .optional(),
})
const draftImageSchema = z
  .object({
    imageUrl: z
      .string()
      .max(6_000_000)
      .refine(
        (value) =>
          /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
          /^https:\/\//.test(value),
        'A imagem gerada possui um formato inválido.',
      ),
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

const DRAFT_IMAGE_BUCKET = 'post-draft-images'
const SIGNED_IMAGE_URL_TTL_SECONDS = 60 * 60
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
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
  imagePath?: string,
) {
  const timezone = row.timezone ?? DEFAULT_POST_TIMEZONE
  const format = row.format ?? 'static'
  return {
    id: row.id,
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
    image_path: imagePath ?? null,
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
    imageAvailable:
      typeof row.image_path === 'string' && row.image_path.length > 0,
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

async function imageBytes(imageUrl: string) {
  const dataUrl =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageUrl)
  if (dataUrl) {
    const bytes = Buffer.from(dataUrl[2], 'base64')
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new HttpError(413, 'A imagem gerada excede o tamanho permitido.')
    }
    return { bytes, contentType: dataUrl[1] }
  }

  let source: URL
  try {
    source = new URL(imageUrl)
  } catch {
    throw new HttpError(400, 'A imagem gerada possui um endereço inválido.')
  }
  if (
    source.protocol !== 'https:' ||
    source.hostname !== 'oaidalleapiprodscus.blob.core.windows.net' ||
    source.username ||
    source.password
  ) {
    throw new HttpError(400, 'O endereço da imagem gerada não é permitido.')
  }

  let response: Response
  try {
    response = await fetch(source, {
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
  } catch {
    throw new HttpError(502, 'Não foi possível baixar a imagem gerada.')
  }
  if (!response.ok) {
    throw new HttpError(502, 'Não foi possível baixar a imagem gerada.')
  }

  const contentType = response.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
  if (!contentType || !IMAGE_MIME_TYPES.has(contentType)) {
    throw new HttpError(400, 'O formato da imagem gerada não é permitido.')
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'A imagem gerada excede o tamanho permitido.')
  }

  const reader = response.body?.getReader()
  if (!reader) throw new HttpError(502, 'A imagem gerada veio vazia.')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel()
      throw new HttpError(413, 'A imagem gerada excede o tamanho permitido.')
    }
    chunks.push(value)
  }
  if (!size) throw new HttpError(502, 'A imagem gerada veio vazia.')
  return { bytes: Buffer.concat(chunks), contentType }
}

async function uploadDraftImage(
  supabase: SupabaseClient,
  path: string,
  imageUrl: string,
) {
  const image = await imageBytes(imageUrl)
  const { error } = await supabase.storage
    .from(DRAFT_IMAGE_BUCKET)
    .upload(path, image.bytes, {
      contentType: image.contentType,
      cacheControl: '3600',
      upsert: false,
    })
  if (error)
    throw new HttpError(503, 'Não foi possível salvar a imagem do post.')
}

async function removeDraftImage(supabase: SupabaseClient, path: string) {
  const { error } = await supabase.storage
    .from(DRAFT_IMAGE_BUCKET)
    .remove([path])
  if (error) console.error('Falha ao limpar imagem de post removido.')
}

async function toDraftWithImage(supabase: SupabaseClient, row: any) {
  const draft = toDraft(row)
  if (typeof row.image_path !== 'string' || !row.image_path) return draft
  const { data, error } = await supabase.storage
    .from(DRAFT_IMAGE_BUCKET)
    .createSignedUrl(row.image_path, SIGNED_IMAGE_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) return draft
  return { ...draft, imageUrl: data.signedUrl }
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
    response.json({
      data: await Promise.all(
        (data ?? []).map((row) => toDraftWithImage(supabase, row)),
      ),
    })
  })
  router.get('/drafts/:draftId/image-url', async (request, response) => {
    const id = parse(z.uuid(), request.params.draftId)
    const { data, error } = await supabase
      .from('post_drafts')
      .select('image_path')
      .eq('id', id)
      .eq('brand_id', workspaceId(request))
      .maybeSingle()
    if (error)
      throw new Error(`Falha ao consultar imagem do post: ${error.message}`)
    if (!data) throw new HttpError(404, 'Post não encontrado.')
    if (typeof data.image_path !== 'string' || !data.image_path) {
      response.json({ data: { imageUrl: null } })
      return
    }
    const { data: signed, error: signingError } = await supabase.storage
      .from(DRAFT_IMAGE_BUCKET)
      .createSignedUrl(data.image_path, SIGNED_IMAGE_URL_TTL_SECONDS)
    if (signingError || !signed?.signedUrl) {
      throw new HttpError(
        503,
        'Não foi possível carregar a imagem salva do post.',
      )
    }
    response.json({ data: { imageUrl: signed.signedUrl } })
  })
  router.put(
    '/drafts/:draftId/image',
    authorizeWrite,
    async (request, response) => {
      const id = parse(z.uuid(), request.params.draftId)
      const { imageUrl } = parse(draftImageSchema, request.body)
      const brandId = workspaceId(request)
      const { data: current, error: currentError } = await supabase
        .from('post_drafts')
        .select('image_path')
        .eq('id', id)
        .eq('brand_id', brandId)
        .maybeSingle()
      if (currentError)
        throw new Error(`Falha ao consultar post: ${currentError.message}`)
      if (!current) throw new HttpError(404, 'Post não encontrado.')

      const nextImagePath = `${brandId}/${id}/${crypto.randomUUID()}`
      await uploadDraftImage(supabase, nextImagePath, imageUrl)
      const { data: updated, error: updateError } = await supabase
        .from('post_drafts')
        .update({ image_path: nextImagePath })
        .eq('id', id)
        .eq('brand_id', brandId)
        .select('*,social_platforms(name),post_hashtags(hashtag)')
        .maybeSingle()
      if (updateError || !updated) {
        await removeDraftImage(supabase, nextImagePath)
        if (updateError)
          throw new Error(
            `Falha ao salvar imagem do post: ${updateError.message}`,
          )
        throw new HttpError(404, 'Post não encontrado.')
      }

      const previousImagePath = current.image_path
      if (
        typeof previousImagePath === 'string' &&
        previousImagePath &&
        previousImagePath !== nextImagePath
      ) {
        await removeDraftImage(supabase, previousImagePath)
      }
      response.json({ data: await toDraftWithImage(supabase, updated) })
    },
  )
  router.post('/drafts', authorizeWrite, async (request, response) => {
    const input = parse(draftCreateSchema, request.body)
    const platform = await platformInfoByName(supabase, input.platform)
    validateCaptionLength(platform, input.caption, input.hashtags)
    const id = input.id ?? crypto.randomUUID()
    const draftToSave = { ...input, id }
    const imagePath = input.imageUrl
      ? `${workspaceId(request)}/${id}`
      : undefined
    if (imagePath && input.imageUrl) {
      await uploadDraftImage(supabase, imagePath, input.imageUrl)
    }

    let created: unknown
    try {
      const { data, error } = await supabase.rpc(
        'create_post_draft_with_hashtags',
        {
          p_brand_id: workspaceId(request),
          p_draft: {
            ...dbDraft(
              draftToSave,
              workspaceId(request),
              platform.id,
              imagePath,
            ),
            hashtags: input.hashtags,
          },
        },
      )
      if (error) throwDraftWriteError(error, 'Falha ao criar post')
      created = Array.isArray(data) ? data[0] : data
      if (!created)
        throw new Error('A gravação do rascunho não retornou dados.')
    } catch (error) {
      if (imagePath) await removeDraftImage(supabase, imagePath)
      throw error
    }
    response.status(201).json({
      data: await toDraftWithImage(supabase, created),
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
      response.json({ data: await toDraftWithImage(supabase, updated) })
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
        .select('id,image_path')
      if (error) throw new Error(`Falha ao excluir post: ${error.message}`)
      if (!data?.length) throw new HttpError(404, 'Post não encontrado.')
      const imagePath = data[0].image_path
      if (typeof imagePath === 'string' && imagePath)
        await removeDraftImage(supabase, imagePath)
      response.status(204).send()
    },
  )
  return router
}
