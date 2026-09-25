// @vitest-environment node
import express, { type ErrorRequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createBrandRouter } from './brandRoutes.js'

const validBrand = {
  name: 'Studio Maria',
  segment: 'Serviços profissionais',
  toneOfVoice: 'Profissional e próximo',
  primaryColor: '#4F46E5',
  colorPalette: ['#4F46E5'],
}

function testApp(client: SupabaseClient) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.authUser = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'maria@postflow.com',
      displayName: 'Maria Silva',
    }
    next()
  })
  app.use(createBrandRouter(client))
  const errors: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: 'Erro interno da aplicação.' })
  }
  app.use(errors)
  return app
}

describe('criação de marca', () => {
  it('cria a marca e seu membership owner por uma única RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'brand-1',
        name: 'Studio Maria',
        segment: 'Serviços profissionais',
        tone_of_voice: 'Profissional e próximo',
        primary_color: '#4F46E5',
        color_palette: ['#4F46E5'],
      },
      error: null,
    })
    const from = vi.fn()
    const app = testApp({ rpc, from } as unknown as SupabaseClient)

    const response = await request(app).post('/').send(validBrand)

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({ id: 'brand-1', role: 'owner' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('create_brand_with_owner', {
      p_user_id: '00000000-0000-4000-8000-000000000001',
      p_brand: expect.objectContaining({
        name: 'Studio Maria',
        segment: 'Serviços profissionais',
      }),
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('não confirma sucesso se a operação transacional falhar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('db') })
    const app = testApp({ rpc } as unknown as SupabaseClient)

    const response = await request(app).post('/').send(validBrand)

    expect(response.status).toBe(500)
    expect(response.body).not.toHaveProperty('data')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
