import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiRequest,
  SESSION_EXPIRED_EVENT,
  SESSION_REFRESH_UNAVAILABLE_CODE,
} from './apiClient'

describe('apiClient sessão expirada', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renova a sessão e repete uma chamada protegida uma única vez', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' })))
    vi.stubGlobal('fetch', fetch)

    await expect(
      apiRequest('/content/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Uma ideia' }),
      }),
    ).resolves.toBe('ok')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[1]?.[0]).toContain('/auth/refresh')
    expect(fetch.mock.calls[2]?.[0]).toContain('/content/generate')
    expect(fetch.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ prompt: 'Uma ideia' }),
    })
  })

  it('mantém o usuário conectado se a renovação falhar temporariamente', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Indisponível.' }), {
          status: 503,
        }),
      )
    vi.stubGlobal('fetch', fetch)
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(apiRequest('/content/generate')).rejects.toMatchObject({
      status: 503,
      code: SESSION_REFRESH_UNAVAILABLE_CODE,
    })

    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('notifica expiração confirmada e não repete automaticamente a chamada', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Refresh expirado.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(apiRequest('/content/generate')).rejects.toBeInstanceOf(
      ApiError,
    )

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(fetch.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('faz logout se a chamada continua 401 depois da renovação', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Sessão inválida.' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await apiRequest('/auth/login', { method: 'POST' })
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(apiRequest('/content/generate')).rejects.toMatchObject({
      status: 401,
    })

    expect(fetch).toHaveBeenCalledTimes(5)
    expect(fetch.mock.calls[4]?.[0]).toContain('/auth/logout')
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('não tenta renovar nem encerra sessão em falha no login', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Credenciais inválidas.' }), {
        status: 401,
      }),
    )
    vi.stubGlobal('fetch', fetch)
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ status: 401 })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })
})
