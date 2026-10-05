// Visual QA follows the repository's existing Playwright script convention.
// Network fixtures verify the UI; verifyAccounting.ts checks real PostgreSQL.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const output = 'output/playwright/accounting'
  fs.mkdirSync(output, { recursive: true })
  try {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        locale: 'pt-BR',
      })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      let unavailable = false
      let lastPeriod = ''
      const sale = {
        id: 'sale',
        brandId: null,
        type: 'income',
        sourceType: 'sale_service',
        category: 'Serviços',
        description: 'Consultoria de conteúdo',
        amount: 100,
        gross: 100,
        tax: 6,
        net: 94,
        taxRate: 6,
        receiptReference: 'PF-QA',
        status: 'pending',
        dueDate: '2026-10-05',
        paidAt: null,
        createdAt: '',
        updatedAt: '',
      }
      const expense = {
        ...sale,
        id: 'expense',
        type: 'expense',
        sourceType: 'manual',
        category: 'Infraestrutura',
        description: 'Hospedagem mensal',
        amount: 50,
      }
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url())
        const path = url.pathname
        let data
        if (path.includes('/auth/'))
          data = {
            user: {
              id: 'qa',
              displayName: 'Admin QA',
              email: 'qa@example.com',
            },
            workspace: null,
            platformRole: 'finance_admin',
            billingStatus: 'none',
          }
        else if (path.endsWith('/brands')) data = []
        else if (path.endsWith('/health'))
          data = { status: 'ok', storage: 'supabase' }
        else if (path.endsWith('/accounting/report')) {
          lastPeriod = url.searchParams.get('period')
          if (unavailable)
            return route.fulfill({
              status: 503,
              json: { error: 'Banco indisponível' },
            })
          data = {
            period: url.searchParams.get('period'),
            basis: 'due_date',
            storage: 'supabase',
            taxRate: 6,
            outcome: 'profit',
            totals: {
              sales: 100,
              taxes: 6,
              netRevenue: 94,
              expenses: 50,
              result: 44,
              excludedIncome: 0,
            },
            sales: [sale],
            expenses: [expense],
            excludedIncome: [],
          }
        } else if (path.endsWith('/fiscal/report'))
          data = {
            period: url.searchParams.get('period'),
            taxRate: 6,
            sales: [sale],
            totals: { gross: 100, tax: 6, net: 94, received: 0, pending: 100 },
          }
        else if (path.endsWith('/finance/transactions')) data = [sale, expense]
        else if (path.endsWith('/finance/summary'))
          data = {
            paidIncome: 0,
            paidExpenses: 0,
            balance: 0,
            pendingIncome: 100,
            pendingExpenses: 50,
            pendingCount: 2,
          }
        else
          return route.fulfill({
            status: 503,
            json: { error: 'Endpoint fora da validação visual' },
          })
        await route.fulfill({ json: { data } })
      })
      await page.goto(
        (process.env.QA_BASE_URL || 'http://127.0.0.1:5174') +
          '/admin/accounting',
      )
      await page.getByText('Lucro', { exact: true }).waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.getByText('R$ 44,00', { exact: true }).waitFor()
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      )
      await page.screenshot({
        path: `${output}/accounting-${width}.png`,
        fullPage: true,
      })
      if (width === 1440) {
        await page.emulateMedia({ media: 'print' })
        await page.screenshot({
          path: `${output}/accounting-print.png`,
          fullPage: true,
        })
        await page.emulateMedia({ media: 'screen' })
      }
      await page.getByLabel('Período contábil').fill('2026-09')
      await page
        .getByRole('heading', { name: 'Demonstração do resultado · 2026-09' })
        .waitFor()
      await page.getByText('Lucro', { exact: true }).waitFor()
      assert.equal(lastPeriod, '2026-09')
      await page.getByRole('link', { name: 'Abrir fiscal' }).click()
      await page
        .getByRole('heading', { name: 'Fiscal e faturamento' })
        .waitFor()
      if (width <= 900)
        await page.getByRole('button', { name: 'Abrir menu' }).click()
      await page.getByRole('link', { name: 'Contábil', exact: true }).click()
      await page.getByText('Lucro', { exact: true }).waitFor()
      await page.getByRole('link', { name: 'Abrir financeiro' }).click()
      await page.getByRole('heading', { name: 'Controle financeiro' }).waitFor()
      if (width <= 900)
        await page.getByRole('button', { name: 'Abrir menu' }).click()
      await page.getByRole('link', { name: 'Contábil', exact: true }).click()
      await page.getByText('Lucro', { exact: true }).waitFor()
      unavailable = true
      await page.getByRole('button', { name: 'Sincronizar' }).click()
      await page.getByRole('alert').waitFor()
      assert.equal(await page.getByText('R$ 44,00', { exact: true }).count(), 0)
      assert.equal(
        await page.getByRole('button', { name: 'Imprimir DRE' }).isDisabled(),
        true,
      )
      unavailable = false
      await page.getByRole('button', { name: 'Sincronizar' }).click()
      await page.getByText('Lucro', { exact: true }).waitFor()
      assert.deepEqual(errors, [])
      await page.close()
    }
    console.log(
      'DRE UI: 320/390/768/1440px; sem overflow/erros; período, navegação Financeiro/Fiscal/Contábil, falha e recuperação aprovados.',
    )
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
