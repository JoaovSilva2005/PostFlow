// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('fitness functions de produção', () => {
  function filesIn(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesIn(path) : [path]
    })
  }

  it('mantém o backend independente da árvore de apresentação', () => {
    const violations = filesIn('backend')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) =>
        /from\s+['"][^'"]*src\//.test(readFileSync(file, 'utf8')),
      )

    expect(violations).toEqual([])
  })

  it('mantém shared livre de infraestrutura', () => {
    const forbidden = /from\s+['"][^'"]*(react|express|supabase|vite|node:)/i
    const violations = filesIn('shared')
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => !/\.(test|spec)\.(ts|tsx)$/.test(file))
      .filter((file) => forbidden.test(readFileSync(file, 'utf8')))

    expect(violations).toEqual([])
  })

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
