// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'database/migrations/20260917_saas_billing_authorization.sql',
  ),
  'utf8',
)

describe('migração SaaS: funções privilegiadas', () => {
  it('não expõe os workflows SECURITY DEFINER a clientes', () => {
    expect(migration).toContain("security definer set search_path = ''")
    expect(migration).toContain(
      'revoke all on function public.create_subscription_invoice_workflow(uuid,text,text,text,text) from public, anon, authenticated;',
    )
    expect(migration).toContain(
      'revoke all on function public.pay_billing_invoice_workflow(uuid,uuid,text,text,text) from public, anon, authenticated;',
    )
    expect(migration).toContain(
      'grant execute on function public.create_subscription_invoice_workflow(uuid,text,text,text,text) to service_role;',
    )
    expect(migration).toContain('gross_cents,description,idempotency_key')
    expect(migration).toContain(
      'create or replace function public.claim_billing_operation',
    )
    expect(migration).toContain("set status='completed'")
    expect(migration).toContain(
      'revoke update, delete on public.fiscal_documents from service_role;',
    )
    expect(migration).toContain(
      'alter table public.financial_transactions alter column brand_id drop not null;',
    )
    expect(migration).toContain('from anon, authenticated;')
    expect(migration).toContain(
      'drop policy if exists "demo_brand_can_be_read"',
    )
    expect(migration).toContain(
      'drop policy if exists "demo_posts_can_be_read"',
    )
    expect(migration).toContain(
      'drop policy if exists "demo_hashtags_can_be_read"',
    )
    for (const table of [
      'platform_members',
      'plans',
      'subscriptions',
      'usage_counters',
      'billing_invoices',
      'fiscal_documents',
    ]) {
      expect(migration).toContain(`public.${table}`)
    }
  })
})
