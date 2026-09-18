// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260918023338_simulated_service_invoice_snapshot.sql',
  ),
  'utf8',
)

describe('migração da NFS-e simulada', () => {
  it('persiste os campos comerciais como snapshot fiscal', () => {
    for (const field of [
      'document_number',
      'verification_code',
      'issuer_name',
      'recipient_name',
      'service_description',
      'service_municipality',
    ]) {
      expect(migration).toContain(field)
    }
  })

  it('identifica o documento como simulação e mantém imutabilidade', () => {
    expect(migration).toContain("'simulation'")
    expect(migration).toContain('fiscal_documents_immutable')
    expect(migration).toContain('new.verification_code = old.verification_code')
  })

  it('mantém a emissão protegida atrás do service role', () => {
    expect(migration).toContain(
      'revoke all on function public.pay_billing_invoice_workflow',
    )
    expect(migration).toContain('to service_role;')
  })
})
