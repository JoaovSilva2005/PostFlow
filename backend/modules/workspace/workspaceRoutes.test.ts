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

function createTestApp(
  supabase: SupabaseClient,
  authorizeWrite: RequestHandler = (_request, _response, next) => next(),
) {
  const app = express()
  app.use(express.json())
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
    const rpc = vi.fn().mockResolvedValue({ data: [draft.id], error: null })
    const app = createTestApp({ rpc } as unknown as SupabaseClient)

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

  it('rejeita um lote inválido antes de chamar o banco', async () => {
    const rpc = vi.fn()
    const app = createTestApp({ rpc } as unknown as SupabaseClient)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([{ ...draft, time: '25:00' }])

    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('retorna falha se a função transacional rejeitar o lote', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'invalid_post_drafts_batch' },
    })
    const app = createTestApp({ rpc } as unknown as SupabaseClient)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([draft])

    expect(response.status).toBe(500)
    expect(response.body.error).toContain('Falha ao salvar o lote de posts')
  })

  it('não informa sucesso se a função não confirmar todos os IDs do lote', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })
    const app = createTestApp({ rpc } as unknown as SupabaseClient)

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/drafts/batch`)
      .send([draft])

    expect(response.status).toBe(500)
    expect(response.body.error).toContain(
      'O lote não retornou todos os rascunhos salvos',
    )
  })
})
