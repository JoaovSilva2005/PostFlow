import { Router } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'

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

function parseBrand(value: unknown) {
  const result = brandSchema.safeParse(value)
  if (!result.success) {
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? 'Dados da marca inválidos.',
    )
  }
  return result.data
}

function toDatabaseBrand(brand: z.infer<typeof brandSchema>) {
  return {
    name: brand.name,
    segment: brand.segment,
    tone_of_voice: brand.toneOfVoice,
    primary_color: brand.primaryColor,
    ...(brand.colorPalette === undefined
      ? {}
      : { color_palette: brand.colorPalette }),
    description: brand.description ?? '',
    target_audience: brand.targetAudience ?? '',
    products_or_services: brand.productsOrServices ?? '',
    differentials: brand.differentials ?? '',
    content_goals: brand.contentGoals ?? '',
    keywords: brand.keywords ?? '',
    avoid_topics: brand.avoidTopics ?? '',
    default_cta: brand.defaultCta ?? '',
  }
}

export function brandProfile(row: any) {
  return {
    name: row.name,
    segment: row.segment,
    toneOfVoice: row.tone_of_voice,
    primaryColor: row.primary_color,
    colorPalette: Array.isArray(row.color_palette) ? row.color_palette : [],
    description: row.description ?? '',
    targetAudience: row.target_audience ?? '',
    productsOrServices: row.products_or_services ?? '',
    differentials: row.differentials ?? '',
    contentGoals: row.content_goals ?? '',
    keywords: row.keywords ?? '',
    avoidTopics: row.avoid_topics ?? '',
    defaultCta: row.default_cta ?? '',
  }
}

export function createBrandRouter(supabase: SupabaseClient) {
  const router = Router()

  router.get('/', async (request, response) => {
    const userId = request.authUser!.id
    const { data: memberships, error: membershipError } = await supabase
      .from('brand_members')
      .select('brand_id, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (membershipError)
      throw new Error(`Falha ao listar marcas: ${membershipError.message}`)

    const ids = (memberships ?? []).map((membership) => membership.brand_id)
    if (!ids.length) return response.json({ data: [] })

    const [
      { data: brands, error: brandError },
      { data: subscriptions, error: subscriptionError },
    ] = await Promise.all([
      supabase.from('brands').select('*').in('id', ids),
      supabase
        .from('subscriptions')
        .select('brand_id, status, created_at')
        .in('brand_id', ids)
        .in('status', ['trialing', 'active', 'past_due'])
        .order('created_at', { ascending: false }),
    ])
    if (brandError)
      throw new Error(`Falha ao carregar marcas: ${brandError.message}`)
    if (subscriptionError)
      throw new Error(
        `Falha ao carregar assinatura das marcas: ${subscriptionError.message}`,
      )

    const brandById = new Map((brands ?? []).map((brand) => [brand.id, brand]))
    const billingById = new Map<string, string>()
    for (const subscription of subscriptions ?? []) {
      if (!billingById.has(subscription.brand_id))
        billingById.set(subscription.brand_id, subscription.status)
    }

    response.json({
      data: (memberships ?? [])
        .map((membership) => {
          const brand = brandById.get(membership.brand_id)
          if (!brand) return null
          return {
            id: membership.brand_id,
            role: membership.role,
            brand: brandProfile(brand),
            billingStatus: billingById.get(membership.brand_id) ?? 'none',
          }
        })
        .filter(Boolean),
    })
  })

  router.post('/', async (request, response) => {
    const userId = request.authUser!.id
    const input = parseBrand(request.body)
    const { data, error: brandError } = await supabase.rpc(
      'create_brand_with_owner',
      { p_user_id: userId, p_brand: toDatabaseBrand(input) },
    )
    const brand = Array.isArray(data) ? data[0] : data
    if (brandError || !brand)
      throw new Error(
        `Falha ao criar marca: ${brandError?.message ?? 'marca não retornada'}`,
      )

    response.status(201).json({
      data: {
        id: brand.id,
        role: 'owner',
        brand: brandProfile(brand),
        billingStatus: 'none',
      },
    })
  })

  return router
}
