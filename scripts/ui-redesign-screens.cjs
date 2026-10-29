// Screenshots of the redesigned brand page, shell, calendar and billing with
// local HTTP fixtures only. Every API call is answered by this script, every
// other non-local request is aborted, and nothing reaches a real backend.
//
// Usage (after `npm run build` with test env values):
//   node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173
//   node scripts/ui-redesign-screens.cjs
// Screenshots go to .superpowers/screens-redesign/ (git-ignored).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDirectory = path.join('.superpowers', 'screens-redesign')

const newBrand = {
  name: 'Workspace de QA',
  segment: 'A definir',
  toneOfVoice: 'Próximo e acolhedor',
  primaryColor: '#4F46E5',
}
const fullBrand = {
  name: 'Café Aurora',
  segment: 'Alimentação e bebidas',
  toneOfVoice: 'Próximo e acolhedor',
  primaryColor: '#B4532A',
  colorPalette: ['#B4532A', '#F2E3C9', '#2F3B2F'],
  description:
    'Torrefação artesanal que entrega cafés especiais de pequenos produtores do sul de Minas.',
  targetAudience:
    'Adultos de 25 a 45 anos que preparam café em casa e valorizam origem.',
  productsOrServices: 'Café em grãos, kits de degustação e assinatura mensal.',
  differentials: 'Torra semanal e envio em até 24h.',
  contentGoals: 'Ensinar sobre café especial e gerar pedidos no site.',
  keywords: 'torra fresca, origem, café especial',
  avoidTopics: 'promessas de saúde',
  defaultCta: 'Peça pelo site',
}

function todayLocal() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
const date = todayLocal()
const drafts = [
  {
    id: 'draft-instagram',
    title: 'Café coado em casa',
    caption:
      'Três passos para um coado equilibrado: moagem média, água a 92 °C e paciência.',
    hashtags: ['#cafeespecial', '#torrafresca'],
    visualText: 'Café coado em casa',
    platform: 'Instagram',
    date,
    time: '09:00',
    timezone: 'America/Sao_Paulo',
    status: 'scheduled',
    color: '#B4532A',
    format: 'static',
    formatData: {
      kind: 'static',
      headline: 'Café coado em casa',
      visualDirection: 'Xícara e coador sobre bancada de madeira.',
    },
  },
  {
    id: 'draft-facebook',
    title: 'Assinatura mensal',
    caption:
      'Receba cafés diferentes todo mês, torrados na semana do envio. Conheça os planos.',
    hashtags: ['#assinatura', '#cafeespecial'],
    visualText: 'Assinatura mensal',
    platform: 'Facebook',
    date,
    time: '18:00',
    timezone: 'America/Sao_Paulo',
    status: 'draft',
    color: '#B4532A',
    format: 'static',
    formatData: {
      kind: 'static',
      headline: 'Assinatura mensal',
      visualDirection: 'Caixa de assinatura aberta com pacotes de café.',
    },
  },
]
const overview = {
  demoMode: true,
  providers: [],
  connections: [],
  pending: [],
  publications: [],
}
const billing = {
  workspaceId: 'workspace-qa',
  demoMode: true,
  plan: {
    id: 'plan-qa',
    code: 'professional',
    name: 'Profissional',
    price: 99,
    limits: { text: 100, image: 20 },
  },
  subscription: {
    id: 'subscription-qa',
    status: 'active',
    currentPeriodStart: '2026-10-01',
    currentPeriodEnd: '2026-11-01',
  },
  usage: {
    period: '2026-10',
    textUsed: 12,
    imageUsed: 3,
    textReserved: 0,
    imageReserved: 0,
  },
}
const plans = [billing.plan]
const invoices = [
  {
    id: 'invoice-qa',
    number: 'PF-2026-001',
    amount: 99,
    status: 'paid',
    dueDate: '2026-10-10',
    paidAt: '2026-10-09',
    receipt: null,
  },
]

async function openPage(browser, { width, theme, brand, anonymous = false }) {
  const page = await browser.newPage({
    viewport: { width, height: width >= 1000 ? 960 : 844 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const problems = []
  page.on('pageerror', (error) => problems.push(error.message))
  await page.addInitScript((value) => {
    localStorage.setItem('postflow.theme', value)
  }, theme)
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (url.origin !== new URL(base).origin) {
      problems.push(`external ${method} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const pathname = url.pathname
    let data
    if (pathname.includes('/auth/') && anonymous)
      return route.fulfill({ status: 401, json: { error: 'Sessão anônima' } })
    if (pathname.includes('/auth/'))
      data = {
        user: { id: 'qa', displayName: 'João Silva', email: 'qa@example.com' },
        workspace: { id: 'workspace-qa', role: 'owner' },
        platformRole: null,
        billingStatus: 'active',
      }
    else if (pathname.endsWith('/brands'))
      data = [
        { id: 'workspace-qa', role: 'owner', billingStatus: 'active', brand },
      ]
    else if (pathname.endsWith('/health'))
      data = { status: 'ok', storage: 'fixture' }
    else if (pathname.endsWith('/brand')) data = brand
    else if (pathname.endsWith('/drafts') && method === 'GET') data = drafts
    else if (pathname.endsWith('/social/overview')) data = overview
    else if (pathname.endsWith('/billing/plans')) data = plans
    else if (pathname.endsWith('/billing')) data = billing
    else if (pathname.endsWith('/invoices')) data = invoices
    else {
      problems.push(`unexpected ${method} ${pathname}`)
      return route.fulfill({ status: 500, json: { error: 'fixture' } })
    }
    return route.fulfill({ json: { data } })
  })
  return { page, problems }
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  assert.equal(overflow, false, 'page scrolls horizontally')
}

async function shot(page, name) {
  await page.waitForTimeout(200)
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) })
}

async function runCase(browser, { width, theme }) {
  const tag = `${width}-${theme}`

  // Brand setup (account brand without context)
  {
    const { page, problems } = await openPage(browser, {
      width,
      theme,
      brand: newBrand,
    })
    await page.goto(`${base}/brand`)
    await page.getByRole('heading', { name: 'Cadastre sua marca' }).waitFor()
    const name = page.getByLabel('Nome da marca')
    await name.fill('Café Aurora')
    await page.getByLabel('Cor principal').evaluate((input) => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(input, '#b4532a')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.getByLabel('Segmento').selectOption('Alimentação e bebidas')
    await assertNoOverflow(page)
    await shot(page, `brand-setup-step1-${tag}`)
    // Keyboard focus on the first palette swatch shows the solid ring.
    await page.getByLabel('Segmento').focus()
    await page.keyboard.press('Tab')
    await shot(page, `brand-setup-focus-${tag}`)
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByLabel('O que a marca faz?').fill(fullBrand.description)
    await page.getByRole('button', { name: /Continuar/ }).click()
    await page.getByLabel('Tom de voz').selectOption('Divertido e informal')
    await page
      .getByLabel('Palavras e expressões para usar')
      .fill('torra fresca, origem')
    await assertNoOverflow(page)
    await shot(page, `brand-setup-step3-${tag}`)
    if (width < 1000) {
      await page
        .getByRole('complementary', { name: 'Prévia do post' })
        .scrollIntoViewIfNeeded()
      await shot(page, `brand-setup-step3-preview-${tag}`)
    }
    assert.deepEqual(problems, [])
    await page.close()
  }

  // Brand edit with dirty save bar
  {
    const { page, problems } = await openPage(browser, {
      width,
      theme,
      brand: fullBrand,
    })
    await page.goto(`${base}/brand`)
    await page.getByRole('navigation', { name: 'Seções da marca' }).waitFor()
    await shot(page, `brand-edit-${tag}`)
    await page.getByLabel('Nome da marca').fill('Café Aurora Torrefação')
    await page.getByText('Alterações não salvas').waitFor()
    await assertNoOverflow(page)
    await shot(page, `brand-edit-dirty-${tag}`)
    if (width < 1000) {
      await page.getByRole('button', { name: 'Abrir menu' }).click()
      await page.getByRole('dialog', { name: 'Menu principal' }).waitFor()
      await shot(page, `shell-drawer-${tag}`)
      await page.keyboard.press('Escape')
    } else {
      await page.getByRole('button', { name: /Trocar de marca/ }).click()
      await shot(page, `shell-switcher-${tag}`)
      await page.keyboard.press('Escape')
    }
    assert.deepEqual(problems, [])
    await page.close()
  }

  // Calendar month and day modal
  {
    const { page, problems } = await openPage(browser, {
      width,
      theme,
      brand: fullBrand,
    })
    await page.goto(`${base}/calendar`)
    const entry = page
      .getByRole('button', { name: /Assinatura mensal/ })
      .first()
    await entry.waitFor()
    await shot(page, `calendar-month-${tag}`)
    await entry.click()
    await page
      .getByRole('dialog')
      .first()
      .getByRole('heading', { name: 'Facebook' })
      .waitFor()
    await shot(page, `calendar-day-${tag}`)
    assert.deepEqual(problems, [])
    await page.close()
  }

  // Billing
  {
    const { page, problems } = await openPage(browser, {
      width,
      theme,
      brand: fullBrand,
    })
    await page.goto(`${base}/billing`)
    await page.getByRole('heading', { name: 'Assinatura e cobrança' }).waitFor()
    await page.waitForLoadState('networkidle')
    await assertNoOverflow(page)
    await shot(page, `billing-${tag}`)
    await page.screenshot({
      path: path.join(outputDirectory, `billing-full-${tag}.png`),
      fullPage: true,
    })
    assert.deepEqual(problems, [])
    await page.close()
  }
  // Other screens: only checked for token-level regressions.
  if (process.env.QA_EXTRA) {
    for (const [route, name, anonymous] of [
      ['/chat', 'chat', false],
      ['/integrations', 'integrations', false],
      ['/login', 'login', true],
    ]) {
      const { page } = await openPage(browser, {
        width,
        theme,
        brand: fullBrand,
        anonymous,
      })
      await page.goto(`${base}${route}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(300)
      await assertNoOverflow(page)
      await shot(page, `${name}-${tag}`)
      await page.close()
    }
  }
  console.log(`ok ${tag}`)
}

;(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  let failed = false
  const widths = (process.env.QA_WIDTHS || '1440,390').split(',').map(Number)
  const themes = (process.env.QA_THEMES || 'dark,light').split(',')
  try {
    for (const width of widths)
      for (const theme of themes) {
        try {
          await runCase(browser, { width, theme })
        } catch (error) {
          failed = true
          console.error(`FAIL ${width}-${theme}:`, error.message)
        }
      }
  } finally {
    await browser.close()
  }
  if (failed) process.exitCode = 1
})()
