// Network fixtures isolate visual QA from real accounts and production data.
const { chromium } = require('playwright')
const fs = require('node:fs')
const assert = require('node:assert/strict')

const brand = {
  id: 'brand-qa',
  name: 'Studio Aurora',
  segment: 'Tecnologia',
  tone_of_voice: 'Profissional e objetivo',
  primary_color: '#4F46E5',
}
const drafts = [
  {
    id: 'draft-1',
    title: 'Uma nova forma de criar',
    scheduled_at: '2026-08-14T12:00:00Z',
    status: 'draft',
    social_platforms: { name: 'Instagram' },
  },
  {
    id: 'draft-2',
    title: 'Bastidores da nossa marca',
    scheduled_at: '2026-08-20T12:00:00Z',
    status: 'draft',
    social_platforms: { name: 'LinkedIn' },
  },
  {
    id: 'draft-3',
    title: 'Ideias que conectam',
    scheduled_at: '2026-08-26T12:00:00Z',
    status: 'scheduled',
    social_platforms: { name: 'Instagram' },
  },
].map((draft) => ({
  ...draft,
  caption: 'Conheça o próximo capítulo da nossa história.',
  color: '#4F46E5',
  visual_text: 'Ideias que conectam.',
  post_hashtags: [],
}))
const transactions = [
  {
    id: '1',
    description: 'Consultoria de conteúdo',
    category: 'Serviços',
    type: 'income',
    amount: 3500,
    dueDate: '2026-09-15',
    status: 'paid',
  },
  {
    id: '2',
    description: 'Assinatura de ferramentas',
    category: 'Software',
    type: 'expense',
    amount: 280,
    dueDate: '2026-09-18',
    status: 'paid',
  },
  {
    id: '3',
    description: 'Campanha de lançamento',
    category: 'Marketing',
    type: 'expense',
    amount: 650,
    dueDate: '2026-09-25',
    status: 'pending',
  },
]
const summary = {
  paidIncome: 3500,
  paidExpenses: 280,
  balance: 3220,
  pendingIncome: 0,
  pendingExpenses: 650,
  pendingCount: 1,
}

async function mockNetwork(page, name) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    let data
    if (path.includes('/auth/')) {
      if (name === 'login')
        return route.fulfill({
          status: 401,
          json: { error: 'Sessão de teste anônima' },
        })
      data = {
        user: {
          id: 'qa',
          displayName: 'João Silva',
          email: 'qa@example.com',
          role: 'member',
        },
      }
    } else if (path.endsWith('/health'))
      data = { status: 'ok', storage: 'supabase' }
    else if (path.endsWith('/finance/summary')) data = summary
    else if (path.endsWith('/finance/transactions')) data = transactions
    else
      return route.fulfill({
        status: 503,
        json: { error: 'Endpoint fora da validação visual' },
      })
    return route.fulfill({ json: { data } })
  })
  await page.route('**/*.supabase.co/**', (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith('/brands')
        ? [brand]
        : drafts,
    }),
  )
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  })
  const output = 'docs/screenshots/responsive'
  fs.mkdirSync(output, { recursive: true })
  let checked = 0
  try {
    for (const width of (process.env.QA_WIDTHS || '320,390,768,1024,1440')
      .split(',')
      .map(Number)) {
      for (const name of (
        process.env.QA_PAGES || 'login,brand,chat,calendar,finance'
      ).split(',')) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          locale: 'pt-BR',
          reducedMotion: 'reduce',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await mockNetwork(page, name)
        await page.goto('http://127.0.0.1:5173/' + name)
        await page.locator(name === 'login' ? 'h2' : 'h1').waitFor()
        await page.evaluate(() => document.fonts.ready)
        if (name === 'finance')
          await page
            .getByText('Consultoria de conteúdo', { exact: true })
            .waitFor()
        if (name === 'calendar')
          await page
            .getByRole('button', { name: /Uma nova forma de criar/ })
            .waitFor()
        if (name === 'chat') {
          await page
            .getByLabel('Pedido para a IA')
            .fill('Apresente uma novidade da nossa marca')
          await page
            .getByRole('button', { name: 'Gerar post', exact: true })
            .click()
          await page.getByText('Rascunho gerado', { exact: true }).waitFor()
        }
        assert.deepEqual(errors, [], name + ' runtime errors')
        if (process.env.QA_DEBUG) {
          console.log(
            await page.evaluate(() =>
              [...document.querySelectorAll('body *')]
                .filter(
                  (element) =>
                    element.getBoundingClientRect().right > innerWidth,
                )
                .map((element) => ({
                  tag: element.tagName,
                  class: element.className,
                  right: element.getBoundingClientRect().right,
                  width: element.getBoundingClientRect().width,
                })),
            ),
          )
          await page.screenshot({ path: output + '/debug.png', fullPage: true })
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          name + ': overflow em ' + width,
        )
        await page.screenshot({
          path: output + '/' + name + '-' + width + '.png',
          fullPage: true,
        })
        if (width === 390 && name === 'brand') {
          await page.getByRole('button', { name: 'Abrir menu' }).click()
          await page.getByLabel('Buscar seção').fill('Agenda')
          await page
            .getByRole('link', { name: 'Agenda', exact: true })
            .waitFor()
          await page.screenshot({
            path: output + '/navigation-mobile.png',
            fullPage: true,
          })
          await page.getByRole('link', { name: 'Agenda', exact: true }).click()
          await page
            .getByRole('heading', { name: 'Agenda de conteúdo' })
            .waitFor()
          assert.equal(
            await page
              .getByRole('button', { name: 'Abrir menu' })
              .getAttribute('aria-expanded'),
            'false',
          )
        }
        if (name === 'calendar' && (width === 390 || width === 1440)) {
          await page
            .getByRole('button', { name: /Uma nova forma de criar/ })
            .click()
          await page.getByRole('dialog').waitFor()
          await page.screenshot({
            path: output + '/edit-draft-' + width + '.png',
            fullPage: true,
          })
          await page.keyboard.press('Escape')
          assert.equal(await page.getByRole('dialog').count(), 0)
        }
        if (name === 'finance') {
          await page.getByLabel('Buscar lançamentos').fill('Software')
          assert.equal(
            await page
              .getByText('Consultoria de conteúdo', { exact: true })
              .count(),
            0,
          )
          await page
            .getByText('Assinatura de ferramentas', { exact: true })
            .waitFor()
        }
        await page.close()
        checked++
      }
    }
    console.log(
      JSON.stringify({
        checked,
        overflowFailures: 0,
        runtimeErrors: 0,
        mobileNavigation: 'passed',
        financeSearch: 'passed',
        dialogEscape: 'passed',
      }),
    )
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
