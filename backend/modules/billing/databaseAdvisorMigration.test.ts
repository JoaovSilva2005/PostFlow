// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260917_harden_rls_and_billing_indexes.sql',
  ),
  'utf8',
)

describe('migração de recomendações dos advisors', () => {
  it('remove execução pública da função privilegiada automática', () => {
    expect(migration).toContain(
      'revoke execute on function public.rls_auto_enable()',
    )
    expect(migration).toContain('from public, anon, authenticated;')
  })

  it('avalia auth.uid uma vez por consulta nas políticas', () => {
    expect(migration).toContain('(select auth.uid())')
    expect(migration).not.toContain('= auth.uid()')
  })

  it('cria índices de cobertura para as chaves estrangeiras do faturamento', () => {
    for (const index of [
      'billing_invoices_subscription_id_idx',
      'subscriptions_plan_id_idx',
      'financial_transactions_invoice_brand_idx',
      'fiscal_documents_invoice_brand_idx',
      'fiscal_documents_transaction_brand_idx',
    ]) {
      expect(migration).toContain(index)
    }
  })
})
