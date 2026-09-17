import { Router, type RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'

const brandSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    segment: z.string().trim().min(2).max(120),
    toneOfVoice: z.string().trim().min(2).max(240),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  })
  .strict()
const draftSchema = z
  .object({
    id: z.uuid().optional(),
    platform: z.string().trim().min(2).max(80),
    title: z.string().trim().min(3).max(240),
    caption: z.string().trim().min(1),
    hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(30),
    visualText: z.string().trim().min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    date: z.iso.date(),
    status: z.enum(['draft', 'scheduled', 'published']),
  })
  .strict()
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
  return {
    name: row.name,
    segment: row.segment,
    tone_of_voice: row.toneOfVoice,
    primary_color: row.primaryColor,
  }
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
  return {
    brand_id: brandId,
    platform_id: platformId,
    title: row.title,
    caption: row.caption,
    visual_text: row.visualText,
    color: row.color,
    scheduled_at: `${row.date}T12:00:00Z`,
    status: row.status,
  }
}
function toDraft(row: any) {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    hashtags: (row.post_hashtags ?? []).map((tag: any) => tag.hashtag),
    platform: row.social_platforms?.name ?? '',
    date: String(row.scheduled_at).slice(0, 10),
    status: row.status,
    visualText: row.visual_text,
    color: row.color,
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
      if (input.date !== undefined)
        patch.scheduled_at = `${input.date}T12:00:00Z`
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
