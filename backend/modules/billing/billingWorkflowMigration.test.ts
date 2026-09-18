// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260917_fix_billing_workflow_ambiguity.sql',
  ),
  'utf8',
)

const uuidSchemaMigration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260917_fix_billing_uuid_schema.sql',
  ),
  'utf8',
)

describe('migração corretiva dos workflows de cobrança', () => {
  it('qualifica colunas que conflitam com o retorno RETURNS TABLE', () => {
    expect(migration).toContain('subscription.status in')
    expect(migration).toContain('where invoice.id = p_invoice_id')
    expect(migration).toContain(
      'where subscription.id = v_invoice.subscription_id',
    )
    expect(migration).toContain('where claim.brand_id = p_workspace_id')
  })

  it('mantém os workflows disponíveis apenas ao service_role', () => {
    expect(migration).toContain('from public, anon, authenticated;')
    expect(migration).toContain('to service_role;')
  })

  it('qualifica a geração de UUID no schema de extensões do Supabase', () => {
    expect(uuidSchemaMigration).toContain('extensions.gen_random_uuid()')
    expect(uuidSchemaMigration).toContain(
      "security definer set search_path = ''",
    )
    expect(uuidSchemaMigration).toContain('from public, anon, authenticated;')
  })
})
