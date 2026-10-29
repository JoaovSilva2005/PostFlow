import { describe, expect, it } from 'vitest'
import { isAuthProviderUnavailable } from './authService.js'

function errorWith(name: string, props: Record<string, unknown> = {}) {
  return Object.assign(new Error('x'), { name }, props)
}

describe('isAuthProviderUnavailable', () => {
  it('reconhece AuthRetryableFetchError', () => {
    expect(
      isAuthProviderUnavailable(errorWith('AuthRetryableFetchError', { status: 0 })),
    ).toBe(true)
  })

  it('reconhece status 5xx', () => {
    expect(isAuthProviderUnavailable(errorWith('AuthApiError', { status: 503 }))).toBe(true)
    expect(isAuthProviderUnavailable(errorWith('AuthApiError', { status: 500 }))).toBe(true)
  })

  it('reconhece falha de rede de fetch', () => {
    expect(isAuthProviderUnavailable(new TypeError('fetch failed'))).toBe(true)
    for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']) {
      expect(
        isAuthProviderUnavailable(
          Object.assign(new Error('x'), { cause: { code } }),
        ),
      ).toBe(true)
      expect(isAuthProviderUnavailable(Object.assign(new Error('x'), { code }))).toBe(true)
    }
  })

  it('não trata um TypeError não relacionado à rede como indisponibilidade', () => {
    expect(
      isAuthProviderUnavailable(
        new TypeError("Cannot read properties of undefined (reading 'user')"),
      ),
    ).toBe(false)
    expect(
      isAuthProviderUnavailable(
        Object.assign(new TypeError('x'), { cause: { code: 'ECONNREFUSED' } }),
      ),
    ).toBe(true)
    expect(isAuthProviderUnavailable(new TypeError('Failed to fetch'))).toBe(true)
    expect(isAuthProviderUnavailable(new TypeError('NetworkError when attempting'))).toBe(true)
  })

  it('não trata credenciais inválidas ou erros comuns como indisponibilidade', () => {
    expect(
      isAuthProviderUnavailable(
        errorWith('AuthApiError', { status: 400, code: 'invalid_credentials' }),
      ),
    ).toBe(false)
    expect(isAuthProviderUnavailable(new Error('Credenciais inválidas.'))).toBe(false)
    expect(isAuthProviderUnavailable(new Error('Sessão não criada.'))).toBe(false)
    expect(isAuthProviderUnavailable(undefined)).toBe(false)
    expect(isAuthProviderUnavailable('boom')).toBe(false)
  })
})
