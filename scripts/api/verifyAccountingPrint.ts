import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createSupabaseAdminDataClient } from '../../backend/config/supabaseServer.js'
import { SupabaseFinancialTransactionRepository } from '../../backend/modules/finance/financialRepository.js'
import { buildAccountingReport } from '../../shared/domain/accounting.js'

// Print-layout check only. Uses the published frontend and a read-only snapshot
// from real PostgreSQL. Auth/session are browser fixtures; this is not a login test.
// The separate manual-login audit verifies real production authentication.
const frontend = process.env.QA_BASE_URL || 'https://post-flow-ochre.vercel.app'
const period = process.env.QA_ACCOUNTING_PERIOD || '2026-09'
const repository = new SupabaseFinancialTransactionRepository(
  createSupabaseAdminDataClient(),
)
const report = {
  ...buildAccountingReport(await repository.list(null), period),
  storage: 'supabase',
}
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  locale: 'pt-BR',
})
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
mkdirSync('output/pdf', { recursive: true })
try {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    assert.equal(
      request.method(),
      'GET',
      'Print validation must never mutate data',
    )
    const url = new URL(request.url())
    if (url.pathname.includes('/auth/'))
      return route.fulfill({
        json: {
          data: {
            user: {
              id: 'print-qa',
              displayName: 'Verificação de impressão',
              email: 'qa@example.invalid',
            },
            workspace: null,
            platformRole: 'support',
            billingStatus: 'none',
          },
        },
      })
    if (url.pathname.endsWith('/brands'))
      return route.fulfill({ json: { data: [] } })
    if (url.pathname.endsWith('/health'))
      return route.fulfill({
        json: { data: { status: 'ok', storage: 'supabase' } },
      })
    if (url.pathname.endsWith('/accounting/report'))
      return route.fulfill({ json: { data: report } })
    throw new Error('Unexpected API route in print validation: ' + url.pathname)
  })
  await page.goto(frontend + '/admin/accounting')
  await page.getByLabel('Período contábil').fill(period)
  await page
    .getByRole('region', { name: 'Demonstrativo do resultado' })
    .getByText(
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(report.totals.result),
      { exact: true },
    )
    .waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ media: 'print' })
  const foreground = await page
    .getByRole('region', { name: 'Demonstrativo do resultado' })
    .evaluate((element) => getComputedStyle(element).color)
  assert.equal(foreground, 'rgb(0, 0, 0)')
  await page.pdf({
    path: 'output/pdf/dre-setembro-2026.pdf',
    format: 'A4',
    printBackground: true,
  })
  assert.deepEqual(errors, [])
  const evidence = {
    frontend,
    period,
    totals: report.totals,
    financialSource: 'read-only PostgreSQL snapshot',
    auth: 'fixture for print only',
    errors,
    pdf: 'output/pdf/dre-setembro-2026.pdf',
  }
  writeFileSync(
    'output/pdf/accounting-print-verification.json',
    JSON.stringify(evidence, null, 2),
  )
  console.log(JSON.stringify(evidence))
} finally {
  await browser.close()
}
