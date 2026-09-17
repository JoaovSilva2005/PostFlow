// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('fitness functions de produção', () => {
  it('não permite segredo de IA em variáveis públicas do Vite', () => {
    const envExample = readFileSync('.env.example', 'utf8')
    expect(envExample).not.toMatch(/^VITE_(OPENAI|AI)_API_KEY=/m)
  })

  it('mantém o modo API como padrão documentado', () => {
    const envExample = readFileSync('.env.example', 'utf8')
    expect(envExample).toContain('VITE_AI_MODE=api')
    expect(envExample).toContain('POSTFLOW_ALLOW_DEMO_FALLBACK=false')
  })
})
