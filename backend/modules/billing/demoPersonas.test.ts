// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const seed = readFileSync(
  resolve(process.cwd(), 'database/demo-personas.sql'),
  'utf8',
)

describe('perfis de demonstração', () => {
  it('mantém credenciais fora do repositório e separa os três cenários', () => {
    expect(seed).toContain('admin@postflow.test')
    expect(seed).toContain('cliente@postflow.test')
    expect(seed).toContain('semplano@postflow.test')
    expect(seed).toContain("(v_admin_id, 'platform_owner')")
    expect(seed).toContain("'seed-client-professional'")
    expect(seed).toContain('O workspace sem plano já possui assinatura')
    expect(seed).not.toMatch(/PostFlow[@!#]\d+/)
  })
})
