// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('clientes Supabase do backend', () => {
  const source = readFileSync(
    new URL('./supabaseServer.ts', import.meta.url),
    'utf8',
  )
  const appSource = readFileSync(new URL('../app.ts', import.meta.url), 'utf8')

  it('usa a chave privilegiada somente no cliente de dados do servidor', () => {
    expect(source).toContain('environment.supabaseServiceRoleKey()')
    expect(source).not.toContain('import.meta.env')
    expect(source).toContain('createSupabaseAdminDataClient')
    expect(appSource).toContain('createSupabaseAdminDataClient')
  })

  it('mantém o cliente público separado para autenticação', () => {
    expect(source).toContain('createSupabaseAuthClient')
    expect(appSource).toContain(
      'new SupabaseAuthProvider(createSupabaseAuthClient)',
    )
  })

  it('não publica nomes de segredo nas variáveis Vite', () => {
    const envExample = readFileSync('.env.example', 'utf8')
    expect(envExample).not.toMatch(/^VITE_.*(SERVICE_ROLE|SECRET_KEY)/m)
    expect(envExample).toContain('SUPABASE_SERVICE_ROLE_KEY=')
  })

  it('prioriza a chave secreta moderna sobre a chave legada', () => {
    const environmentSource = readFileSync(
      new URL('./environment.ts', import.meta.url),
      'utf8',
    )
    const secretKeyPosition = environmentSource.indexOf(
      'process.env.SUPABASE_SECRET_KEY',
    )
    const legacyKeyPosition = environmentSource.indexOf(
      'process.env.SUPABASE_SERVICE_ROLE_KEY',
    )

    expect(secretKeyPosition).toBeGreaterThan(-1)
    expect(legacyKeyPosition).toBeGreaterThan(secretKeyPosition)
    expect(environmentSource).toContain("startsWith('sb_publishable_')")
  })
})
