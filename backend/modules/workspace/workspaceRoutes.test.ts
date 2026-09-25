// @vitest-environment node
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../shared/HttpError.js'
import { createWorkspaceRouter } from './workspaceRoutes.js'

const workspaceId = '10000000-0000-4000-8000-000000000001'
const draft = {
  id: '20000000-0000-4000-8000-000000000001',
  platform: 'Instagram',
  title: 'Uma ideia prática para a marca',
  caption: 'Compartilhe uma dica simples com seu público.',
  hashtags: ['#PostFlow'],
  visualText: 'Uma dica prática',
  color: '#4F46E5',
  date: '2099-12-30',
  status: 'draft',
  format: 'static',
  formatData: {
    kind: 'static',
    headline: 'Uma dica prática',
    visualDirection: 'Composição editorial simples.',
  },
  persona: 'Pessoas que estão começando',
  time: '09:45',
  timezone: 'America/Sao_Paulo',
}

function savedDraft(input = draft) {
  return {
    id: input.id,
    title: input.title,
    caption: input.caption,
    visual_text: input.visualText,
    color: input.color,
    scheduled_at: `${input.date}T12:00:00.000Z`,
    status: input.status,
    content_format: input.format,
    audience_persona: input.persona,
    schedule_timezone: input.timezone,
    format_data: input.formatData,
    social_platforms: { name: input.platform },
    post_hashtags: input.hashtags.map((hashtag) => ({ hashtag })),
  }
}

function createSupabaseMock(
  rpcResult: { data: unknown; error: unknown },
  currentDraft = savedDraft(),
) {
  const rpc = vi.fn().mockResolvedValue(rpcResult)
  const from = vi.fn((table: string) => {
    const filters = new Map<string, unknown>()
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((column: string, value: unknown) => {
        filters.set(column, value)
        return chain
      }),
      async maybeSingle() {
        if (table === 'social_platforms') {
          const name = filters.get('name')
          const platform =
            name === 'X / Twitter'
              ? { id: 'platform-x', name, character_limit: 280 }
              : name === 'Blog'
                ? { id: 'platform-blog', name, character_limit: 30000 }
                : { id: 'platform-instagram', name: 'Instagram', character_limit: 2200 }
          return { data: platform, error: null }
        }
        return {
          data: {
            scheduled_at: currentDraft.scheduled_at,
            schedule_timezone: currentDraft.schedule_timezone,
            caption: currentDraft.caption,
            platform_id: 'platform-instagram',
            post_hashtags: currentDraft.post_hashtags,
          },
          error: null,
        }
      },
    }
    return chain
  })
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from }
}

function createTestApp(
  supabase: SupabaseClient,
  authorizeWrite: RequestHandler = (_request, _response, next) => next(),
) {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/workspaces/:workspaceId', (req, _res, next) => {
    req.workspaceContext = {
      workspaceId: String(req.params.workspaceId),
      role: 'owner',
    }
    next()
  })
  app.use(
    '/api/workspaces/:workspaceId',
    createWorkspaceRouter(supabase, authorizeWrite),
  )
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error instanceof HttpError ? error.statusCode : 500
    res.status(status).json({
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    })
  }
  app.use(errors)
  return app
}

describe('persistência em lote de rascunhos', () => {
  it('envia o lote completo com hora, fuso e formato para a função transacional', async () => {
    const { client, rpc } = createSupabaseMock({ data: [draft.id], error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([draft])

    expect(response.status).toBe(201)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('create_post_drafts_batch', {
      p_brand_id: workspaceId,
      p_drafts: [draft],
    })
    expect(response.body.data).toEqual([draft])
  })

  it('aceita 42 rascunhos com o limite máximo de legenda', async () => {
    const largestBatch = Array.from({ length: 42 }, (_, index) => ({
      ...draft,
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      platform: 'Blog',
      caption: 'x'.repeat(5000),
      hashtags: [],
    }))
    const { client, rpc } = createSupabaseMock({
      data: largestBatch.map((item) => item.id),
      error: null,
    })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send(largestBatch)

    expect(response.status).toBe(201)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(response.body.data).toHaveLength(42)
  })

  it('rejeita um lote inválido antes de consultar o banco', async () => {
    const { client, rpc, from } = createSupabaseMock({ data: null, error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([{ ...draft, time: '25:00' }])

    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('aplica o limite de caracteres da plataforma também ao lote', async () => {
    const { client, rpc } = createSupabaseMock({ data: null, error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([
        {
          ...draft,
          platform: 'X / Twitter',
          caption: 'x'.repeat(280),
        },
      ])

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('280 caracteres')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('retorna falha se a função transacional rejeitar o lote', async () => {
    const { client } = createSupabaseMock({
      data: null,
      error: { message: 'invalid_post_drafts_batch' },
    })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([draft])

    expect(response.status).toBe(500)
    expect(response.body.error).toContain('Falha ao salvar o lote de posts')
  })

  it('não informa sucesso se a função não confirmar todos os IDs do lote', async () => {
    const { client } = createSupabaseMock({ data: [], error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([draft])

    expect(response.status).toBe(500)
    expect(response.body.error).toContain(
      'O lote não retornou todos os rascunhos salvos',
    )
  })
})

describe('persistência atômica de rascunhos individuais', () => {
  it('cria post e hashtags por uma única RPC', async () => {
    const { client, rpc, from } = createSupabaseMock({
      data: savedDraft(),
      error: null,
    })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts`)
      .send(draft)

    expect(response.status).toBe(201)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'create_post_draft_with_hashtags',
      expect.objectContaining({
        p_brand_id: workspaceId,
        p_draft: expect.objectContaining({
          title: draft.title,
          hashtags: draft.hashtags,
        }),
      }),
    )
    expect(from).toHaveBeenCalledTimes(1)
    expect(response.body.data.hashtags).toEqual(draft.hashtags)
  })

  it('não responde sucesso se a gravação transacional falhar', async () => {
    const { client, rpc } = createSupabaseMock({
      data: null,
      error: { message: 'hashtag insert failed' },
    })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts`)
      .send(draft)

    expect(response.status).toBe(500)
    expect(response.body).not.toHaveProperty('data')
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('atualiza o post e substitui hashtags por uma única RPC', async () => {
    const updated = savedDraft({
      ...draft,
      caption: 'Legenda atualizada.',
      hashtags: ['#Novo'],
    })
    const { client, rpc } = createSupabaseMock({ data: updated, error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .patch(`/api/workspaces/${workspaceId}/drafts/${draft.id}`)
      .send({ caption: 'Legenda atualizada.', hashtags: ['#Novo'] })

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith(
      'update_post_draft_with_hashtags',
      expect.objectContaining({
        p_brand_id: workspaceId,
        p_post_id: draft.id,
        p_patch: { caption: 'Legenda atualizada.' },
        p_hashtags: ['#Novo'],
      }),
    )
  })

  it('rejeita legenda acima do limite explícito antes de gravar', async () => {
    const { client, rpc } = createSupabaseMock({ data: null, error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts`)
      .send({ ...draft, caption: 'x'.repeat(5001) })

    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejeita texto visual acima de 160 caracteres antes de gravar', async () => {
    const { client, rpc } = createSupabaseMock({ data: null, error: null })
    const app = createTestApp(client)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts`)
      .send({ ...draft, visualText: 'x'.repeat(161) })

    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})
