// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { SupabaseAuthProvider } from './supabaseAuthProvider.js'

describe('SupabaseAuthProvider', () => {
  it('envia os dados essenciais de onboarding como metadados do cadastro', async () => {
    const signUp = vi.fn(async (input) => ({
      data: {
        user: {
          id: 'user-1',
          email: input.email,
          user_metadata: input.options.data,
        },
        session: null,
      },
      error: null,
    }))
    const client = { auth: { signUp } } as unknown as SupabaseClient
    const provider = new SupabaseAuthProvider(() => client)

    const result = await provider.register({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
      email: 'maria@postflow.com',
      password: 'senha123',
    })

    expect(signUp).toHaveBeenCalledWith({
      email: 'maria@postflow.com',
      password: 'senha123',
      options: {
        data: {
          display_name: 'Maria Silva',
          brand_name: 'Studio Maria',
          segment: 'Serviços profissionais',
        },
      },
    })
    expect(result.user).toMatchObject({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
    })
  })

  it('restaura os dois tokens da sessão antes de revogar o refresh token local', async () => {
    const setSession = vi.fn(async () => ({ data: { user: null, session: null }, error: null }))
    const signOut = vi.fn(async () => ({ error: null }))
    const client = { auth: { setSession, signOut } } as unknown as SupabaseClient
    const provider = new SupabaseAuthProvider(() => client)

    await provider.logout('access-token', 'refresh-token')

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(setSession.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0]!,
    )
  })

  it('não chama signOut se o SDK não conseguir restaurar a sessão fornecida', async () => {
    const setSession = vi.fn(async () => ({
      data: { user: null, session: null },
      error: new Error('token inválido'),
    }))
    const signOut = vi.fn(async () => ({ error: null }))
    const client = { auth: { setSession, signOut } } as unknown as SupabaseClient
    const provider = new SupabaseAuthProvider(() => client)

    await expect(
      provider.logout('access-token', 'refresh-token'),
    ).rejects.toThrow('token inválido')
    expect(signOut).not.toHaveBeenCalled()
  })
})
