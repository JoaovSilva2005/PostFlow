import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { createApp } from '../../backend/app.js'
import { createSupabaseAdminDataClient } from '../../backend/config/supabaseServer.js'
import { AuthService } from '../../backend/modules/auth/authService.js'
import { SupabaseFinancialTransactionRepository } from '../../backend/modules/finance/financialRepository.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../backend/test/InMemoryAuthProvider.js'
import { InMemoryWorkspaceAccessRepository } from '../../backend/modules/tenancy/workspaceRepository.js'

// Browser → real Express routes → real PostgreSQL. Authentication is controlled;
// auth/session and the unrelated brand list use fixtures. No financial fixture.
const repository = new SupabaseFinancialTransactionRepository(
  createSupabaseAdminDataClient(),
)
const app = createApp({
  financialRepository: repository,
  authService: new AuthService(new InMemoryAuthProvider()),
  workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
    'test-workspace',
    'viewer',
    'finance_admin',
  ),
})
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const address = server.address()
assert.ok(address && typeof address !== 'string')
const apiOrigin = `http://127.0.0.1:${address.port}`
const period = '2098-12'
const runId = randomUUID()
const saleDescription = `QA navegador venda ${runId}`
const expenseDescription = `QA navegador despesa ${runId}`
const createdIds = new Set<string>()
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  locale: 'pt-BR',
})
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
const frontend = process.env.QA_BASE_URL || 'http://127.0.0.1:5174'
const headers = { Authorization: `Bearer ${TEST_ACCESS_TOKEN}` }
const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  )
const readDre = async () => {
  const response = await page.request.get(
    `${apiOrigin}/api/admin/accounting/report?period=${period}`,
    { headers },
  )
  assert.equal(response.status(), 200)
  return (await response.json()).data
}
try {
  await repository.checkHealth()
  const baseline = await readDre()
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/'))
      return route.fulfill({
        json: {
          data: {
            user: {
              id: 'qa',
              displayName: 'Admin QA',
              email: 'qa@example.com',
            },
            workspace: null,
            platformRole: 'finance_admin',
            billingStatus: 'none',
          },
        },
      })
    if (url.pathname.endsWith('/brands'))
      return route.fulfill({ json: { data: [] } })
    const response = await route.fetch({
      url: apiOrigin + url.pathname + url.search,
      headers: { ...route.request().headers(), ...headers },
    })
    if (route.request().method() === 'POST' && response.status() === 201) {
      const body = await response.json()
      if (body.data?.id) createdIds.add(body.data.id)
    }
    await route.fulfill({ response })
  })
  await page.goto(frontend + '/admin/fiscal')
  await page.getByRole('heading', { name: 'Fiscal e faturamento' }).waitFor()
  await page.getByLabel('Período fiscal').fill(period)
  await page.getByLabel('Serviço e cliente').fill(saleDescription)
  await page.getByLabel('Valor bruto (R$)').fill('100')
  await page.getByLabel('Vencimento da venda').fill(period + '-05')
  await page.getByRole('button', { name: 'Registrar no financeiro' }).click()
  await page.getByText(/Venda registrada no financeiro/).waitFor()
  await page.getByText(saleDescription, { exact: true }).waitFor()
  const sale = (await repository.list(null)).find(
    (item) => item.description === saleDescription,
  )
  assert.ok(sale)
  assert.equal(sale.amount, 100)
  assert.equal(sale.sourceType, 'sale_service')
  await page.getByRole('link', { name: 'Abrir financeiro' }).click()
  await page.getByRole('heading', { name: 'Controle financeiro' }).waitFor()
  await page.getByLabel('Tipo', { exact: true }).selectOption('expense')
  await page.getByLabel('Descrição', { exact: true }).fill(expenseDescription)
  await page.getByLabel('Categoria', { exact: true }).fill('QA navegador')
  await page.getByLabel('Valor (R$)', { exact: true }).fill('50')
  await page.getByLabel('Vencimento', { exact: true }).fill(period + '-10')
  await page.getByRole('button', { name: 'Adicionar lançamento' }).click()
  await page.getByText('Lançamento adicionado ao financeiro.').waitFor()
  const expense = (await repository.list(null)).find(
    (item) => item.description === expenseDescription,
  )
  assert.ok(expense)
  assert.equal(expense.amount, 50)
  assert.equal(createdIds.size, 2)
  await page.getByRole('link', { name: 'Contábil', exact: true }).click()
  await page.getByLabel('Período contábil').fill(period)
  await page.getByText(expenseDescription, { exact: true }).waitFor()
  const reportRegion = page.getByRole('region', {
    name: 'Demonstrativo do resultado',
  })
  await reportRegion
    .getByText(currency(baseline.totals.result + 44), { exact: true })
    .waitFor()
  const initial = await readDre()
  assert.equal(
    Math.round((initial.totals.result - baseline.totals.result) * 100),
    4400,
  )
  assert.equal(
    Math.round((initial.totals.taxes - baseline.totals.taxes) * 100),
    600,
  )
  mkdirSync('output/accounting-retest', { recursive: true })
  await page.screenshot({
    path: 'output/accounting-retest/browser-real-database.png',
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Abrir financeiro' }).click()
  await page
    .getByRole('button', { name: `Editar ${expenseDescription}` })
    .click()
  await page.getByLabel('Valor (R$)', { exact: true }).fill('150')
  await page.getByRole('button', { name: 'Salvar alteração' }).click()
  await page.getByText('Lançamento atualizado.').waitFor()
  await page
    .getByRole('button', { name: `Marcar ${saleDescription} como pago` })
    .click()
  await page
    .getByRole('button', { name: `Marcar ${saleDescription} como pendente` })
    .waitFor()
  await page.getByRole('link', { name: 'Contábil', exact: true }).click()
  await page.getByLabel('Período contábil').fill(period)
  await page.getByText(expenseDescription, { exact: true }).waitFor()
  await reportRegion
    .getByText(currency(baseline.totals.result - 56), { exact: true })
    .waitFor()
  const updated = await readDre()
  assert.equal(
    Math.round((updated.totals.result - baseline.totals.result) * 100),
    -5600,
  )
  await page.getByRole('link', { name: 'Abrir financeiro' }).click()
  page.on('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('button', { name: `Excluir ${expenseDescription}` })
    .click()
  await page.getByText('Lançamento excluído.').waitFor()
  await page.getByRole('button', { name: `Excluir ${saleDescription}` }).click()
  await page
    .getByRole('button', { name: `Excluir ${saleDescription}` })
    .waitFor({ state: 'detached' })
  const restored = await readDre()
  assert.deepEqual(restored.totals, baseline.totals)
  assert.deepEqual(errors, [])
  console.log(
    'Browser + API + PostgreSQL reais: cadastro de venda/despesa, lucro 44, edição para −56, pagamento, exclusão e restauração dos totais aprovados. Autenticação controlada.',
  )
} finally {
  try {
    // Defensive discovery also cleans records if a UI response was interrupted.
    const remaining = await repository.list(null)
    for (const item of remaining) {
      if (
        createdIds.has(item.id) ||
        item.description === saleDescription ||
        item.description === expenseDescription
      )
        assert.equal(await repository.delete(item.id, null), true)
    }
  } finally {
    try {
      await browser.close()
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  }
  console.log(
    'Limpeza dos registros desta execução e encerramento da API temporária concluídos.',
  )
}
