// Standalone visual and interaction check for the light/dark theme.
// All API traffic is handled by local Playwright fixtures; no real account,
// generation service, publication, or write endpoint is reached.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const { mockNetwork } = require('./responsive-check.cjs')

const BASE_URL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const OUTPUT_DIR =
  process.env.QA_OUTPUT || path.resolve('output/playwright/themes')
const THEME_KEY = 'postflow.theme'
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]
const EXTRA_CASES = [
  ...['login', 'brand', 'chat', 'calendar', 'finance', 'integrations'].map(
    (page) => ({ page, width: 320, height: 800 }),
  ),
  ...[
    'finance',
    'fiscal',
    'accounting',
    'billing',
    'admin-plans',
    'integrations',
  ].map((page) => ({ page, width: 2560, height: 1440 })),
]
const SCREEN_ROUTES = [
  'login',
  'login-register',
  'brand',
  'chat',
  'calendar',
  'finance',
  'fiscal',
  'accounting',
  'billing',
  'admin-plans',
  'integrations',
]
const CARD_SELECTORS = {
  login: '[class*="_card_"]',
  'login-register': '[class*="_card_"]',
  brand: '[class*="formCard"], [class*="previewCard"]',
  chat: '[class*="workspace"]',
  calendar: '[class*="calendarCard"], [class*="creationStudio"]',
  finance: '[class*="summaryCard"], [class*="tableCard"], [class*="formCard"]',
  fiscal: '[class*="summary"], [class*="panel"], [class*="plan"]',
  accounting: '[class*="report"]',
  billing:
    '[class*="offer"], [class*="checkout"], [class*="panel"], [class*="summary"] article',
  'admin-plans': '[class*="plan"]',
  integrations: '[class*="integrationCard"], [class*="activityPanel"]',
}

const month = new Date().toISOString().slice(0, 7)
const accountingReport = {
  storage: 'test',
  period: month,
  basis: 'due_date',
  taxRate: 6,
  totals: {
    sales: 3500,
    taxes: 210,
    netRevenue: 3290,
    expenses: 280,
    result: 3010,
    excludedIncome: 0,
  },
  outcome: 'profit',
  sales: [
    {
      id: 'theme-sale-1',
      brandId: 'workspace-qa',
      description: 'Consultoria de conteúdo',
      category: 'Serviços',
      type: 'income',
      sourceType: 'sale_service',
      amount: 3500,
      dueDate: `${month}-15`,
      status: 'paid',
      gross: 3500,
      tax: 210,
      net: 3290,
      taxRate: 6,
      receiptReference: 'PF-THEME-1',
      createdAt: `${month}-16`,
      updatedAt: `${month}-16`,
      paidAt: `${month}-16`,
    },
  ],
  expenses: [
    {
      id: 'theme-expense-1',
      description: 'Assinatura de ferramentas',
      category: 'Software',
      type: 'expense',
      amount: 280,
      dueDate: `${month}-18`,
      status: 'paid',
    },
  ],
  excludedIncome: [],
}
const socialOverview = {
  providers: [
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
    ['linkedin', 'LinkedIn'],
    ['tiktok', 'TikTok'],
  ].map(([id, label]) => ({
    id,
    label,
    configured: true,
    missingConfiguration: [],
    formats: ['static'],
    setupUrl: `https://www.${id}.com/`,
  })),
  connections: [
    {
      id: 'theme-connection-1',
      provider: 'instagram',
      externalAccountId: 'ig-theme-qa',
      displayName: '@studioaurora.qa',
      accountType: 'business',
      status: 'connected',
      expiresAt: null,
      createdAt: new Date().toISOString(),
    },
  ],
  pending: [],
  publications: [
    {
      id: 'theme-publication-1',
      draftId: 'draft-1',
      connectionId: 'theme-connection-1',
      provider: 'instagram',
      title: 'Uma nova forma de criar',
      status: 'published',
      scheduledAt: new Date().toISOString(),
      remotePostId: 'remote-theme-1',
      remoteUrl: 'https://www.instagram.com/',
      error: null,
      attempts: 1,
      cancellable: false,
      createdAt: new Date().toISOString(),
    },
  ],
}

function routeFor(name) {
  return name === 'login-register'
    ? '/login'
    : name === 'admin-plans'
      ? '/admin/plans'
      : name === 'finance'
        ? '/admin/finance'
        : name === 'fiscal'
          ? '/admin/fiscal'
          : name === 'accounting'
            ? '/admin/accounting'
            : `/${name}`
}

async function installFixtures(page, name) {
  const mock = await mockNetwork(page, name)

  // These exact routes run after the shared fixture and take precedence only
  // for endpoints the responsive fixture intentionally does not provide.
  await page.route('**/api/admin/accounting/report**', async (route) => {
    const requestedPeriod = new URL(route.request().url()).searchParams.get(
      'period',
    )
    return route.fulfill({
      json: { data: { ...accountingReport, period: requestedPeriod || month } },
    })
  })
  await page.route('**/api/workspaces/*/social/overview', (route) =>
    route.fulfill({ json: { data: socialOverview } }),
  )
  return mock
}

async function preparePage(context, name, width, height, preference) {
  const page = await context.newPage()
  await page.setViewportSize({ width, height })
  if (preference) {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: THEME_KEY, value: preference },
    )
  }
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const mock = await installFixtures(page, name)
  await page.goto(BASE_URL + routeFor(name), { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  return { page, errors, mock }
}

function parseColor(color) {
  const rgb = color.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean)
    return parts.slice(0, 3).map((part) => Number.parseFloat(part))
  }
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const value =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((index) =>
      Number.parseInt(value.slice(index, index + 2), 16),
    )
  }
  return null
}

function luminance(color) {
  const components = parseColor(color)
  assert.ok(components, `Não foi possível interpretar cor ${color}`)
  const linear = components.map((component) => {
    const value = component / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  )
  return (light + 0.05) / (dark + 0.05)
}

async function inspectTheme(page, pageName) {
  return page.evaluate((cardSelector) => {
    const root = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    const token = (name) => root.getPropertyValue(name).trim()
    const cards = [...document.querySelectorAll(`main ${cardSelector}`)]
      .filter((element) => {
        const style = getComputedStyle(element)
        const hasPaintedBackground =
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          style.backgroundImage !== 'none'
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          hasPaintedBackground
        )
      })
      .map((element) => ({
        selector:
          typeof element.className === 'string'
            ? element.className.split(' ')[0]
            : element.tagName,
        background: getComputedStyle(element).backgroundColor,
        backgroundImage: getComputedStyle(element).backgroundImage,
      }))
    return {
      theme: document.documentElement.dataset.theme,
      colorScheme: root.colorScheme,
      bodyBackground: body.backgroundColor,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content,
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      tokens: {
        background: token('--color-background'),
        surface: token('--color-surface'),
        elevated: token('--color-elevated'),
        text: token('--color-text'),
        muted: token('--color-muted'),
        primary: token('--color-primary'),
        success: token('--color-success'),
        danger: token('--color-danger'),
        warning: token('--color-warning'),
        info: token('--color-info'),
        primaryMuted: token('--color-primary-muted'),
        successMuted: token('--color-success-muted'),
        dangerMuted: token('--color-danger-muted'),
        warningMuted: token('--color-warning-muted'),
        infoMuted: token('--color-info-muted'),
        subtle: token('--color-subtle'),
      },
      cards,
    }
  }, CARD_SELECTORS[pageName])
}

function assertThemeHealth(result, { checkCard = true } = {}) {
  assert.ok(['dark', 'light'].includes(result.theme), 'data-theme não definido')
  assert.equal(result.colorScheme, result.theme, 'color-scheme diverge do tema')
  assert.equal(
    result.bodyBackground,
    rgb(result.tokens.background),
    'fundo do body não corresponde ao token de fundo',
  )
  const expectedMeta = result.theme === 'light' ? '#f3f4f5' : '#101112'
  assert.equal(
    result.themeColor.toLowerCase(),
    expectedMeta,
    'meta theme-color não acompanha o tema',
  )
  if (checkCard && result.cards.length) {
    const themedBackgrounds = new Set([
      rgb(result.tokens.surface),
      rgb(result.tokens.elevated),
      rgb(result.tokens.primaryMuted),
      rgb(result.tokens.successMuted),
      rgb(result.tokens.dangerMuted),
      rgb(result.tokens.warningMuted),
      rgb(result.tokens.infoMuted),
    ])
    const outside = result.cards.filter(
      (card) =>
        card.backgroundImage === 'none' &&
        !themedBackgrounds.has(card.background),
    )
    assert.deepEqual(
      outside,
      [],
      `fundos de cartão não usam tokens de tema: ${JSON.stringify(outside)}`,
    )
  }
  if (checkCard) {
    assert.ok(
      result.cards.length > 0,
      'nenhuma superfície de conteúdo foi verificada',
    )
  }
  const solidBackgrounds = [result.tokens.background, result.tokens.surface]
  const textContrast = []
  for (const foreground of [result.tokens.text, result.tokens.muted]) {
    for (const background of solidBackgrounds) {
      const ratio = contrast(foreground, background)
      textContrast.push({
        foreground,
        background,
        ratio: Number(ratio.toFixed(2)),
      })
      assert.ok(
        ratio >= 4.5,
        `contraste de texto ${foreground} em ${background}: ${ratio.toFixed(2)} (< 4.5)`,
      )
    }
  }
  const semanticPairs = [
    [result.tokens.primary, result.tokens.background],
    [result.tokens.success, result.tokens.successMuted],
    [result.tokens.danger, result.tokens.dangerMuted],
    [result.tokens.warning, result.tokens.warningMuted],
    [result.tokens.info, result.tokens.infoMuted],
  ]
  const semanticContrast = semanticPairs.map(([foreground, background]) => {
    const ratio = contrast(foreground, background)
    assert.ok(
      ratio >= 3,
      `contraste semântico ${foreground} em ${background}: ${ratio.toFixed(2)} (< 3)`,
    )
    return { foreground, background, ratio: Number(ratio.toFixed(2)) }
  })
  return { textContrast, semanticContrast }
}

function rgb(color) {
  const parsed = parseColor(color)
  assert.ok(parsed, `Token de cor inválido: ${color}`)
  return `rgb(${parsed.join(', ')})`
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert.ok(
    dimensions.document <= dimensions.width &&
      dimensions.body <= dimensions.width,
    `overflow horizontal em ${label}: ${JSON.stringify(dimensions)}`,
  )
}

async function maybeScreenshot(page, filename) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, filename),
    fullPage: true,
    animations: 'disabled',
  })
}

async function runCalendarDialogs(context, width, theme, report) {
  const { page, errors } = await preparePage(
    context,
    'calendar',
    width,
    900,
    theme,
  )
  try {
    await page.getByRole('button', { name: /Uma nova forma de criar/ }).click()
    const editDialog = page.getByRole('dialog')
    await editDialog.waitFor()
    await assertNoOverflow(page, `calendar edit ${theme} ${width}`)
    await maybeScreenshot(page, `calendar-edit-${theme}-${width}.png`)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)

    await page
      .getByLabel('Ideia do conteúdo na agenda')
      .fill('Compartilhe uma dica prática para organizar a semana')
    await page
      .getByRole('button', { name: 'Gerar conteúdo', exact: true })
      .click()
    const generationDialog = page.getByRole('dialog', {
      name: 'Configurar geração',
    })
    await generationDialog.waitFor()
    await page
      .getByLabel('Público ou persona (opcional)')
      .fill('Pessoas iniciantes')
    await page.getByLabel('Horário de Brasília').fill('09:45')
    await page.getByLabel('Próximos 7 dias').check()
    await generationDialog.getByRole('button', { name: /^Reels/ }).click()
    await generationDialog
      .getByRole('button', { name: 'Facebook', exact: true })
      .click()
    await assertNoOverflow(page, `calendar generation ${theme} ${width}`)
    await maybeScreenshot(page, `calendar-generation-${theme}-${width}.png`)
    await generationDialog
      .getByRole('button', { name: 'Gerar 14 rascunhos' })
      .waitFor()
    assert.deepEqual(
      errors,
      [],
      `pageerror em calendário: ${errors.join('; ')}`,
    )
    report.interactions.push({
      page: 'calendar',
      theme,
      width,
      editDialog: 'passed',
      generationDialog: 'passed',
      generatedDrafts: 'no submit; generation modal checked only',
    })
  } finally {
    await page.close()
  }
}

async function runUIThemeControls(browser, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const desktop = await preparePage(context, 'brand', 1440, 900, null)
  try {
    await desktop.page.getByLabel('Tema da aplicação').selectOption('light')
    await desktop.page.waitForFunction(
      () => document.documentElement.dataset.theme === 'light',
    )
    assert.equal(
      await desktop.page.evaluate(() => localStorage.getItem('postflow.theme')),
      'light',
    )
    await desktop.page.reload({ waitUntil: 'domcontentloaded' })
    await desktop.page.locator('h1').first().waitFor()
    assert.equal(
      await desktop.page.evaluate(() => document.documentElement.dataset.theme),
      'light',
    )
    await desktop.page
      .getByRole('link', { name: 'Agenda', exact: true })
      .click()
    await desktop.page
      .getByRole('heading', { name: 'Agenda de conteúdo' })
      .waitFor()
    assert.equal(
      await desktop.page.evaluate(() => document.documentElement.dataset.theme),
      'light',
    )
    assert.deepEqual(desktop.errors, [])
    report.interactions.push({
      page: 'brand',
      themeControl: 'desktop UI, reload, navigation passed',
    })
  } finally {
    await desktop.page.close()
    await context.close()
  }

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const mobile = await preparePage(mobileContext, 'brand', 390, 844, null)
  try {
    await mobile.page.getByRole('button', { name: 'Abrir menu' }).click()
    const menu = mobile.page.getByRole('dialog', { name: 'Menu principal' })
    await menu.getByLabel('Tema da aplicação').selectOption('light')
    await mobile.page.waitForFunction(
      () => document.documentElement.dataset.theme === 'light',
    )
    assert.equal(
      await mobile.page.evaluate(() => localStorage.getItem('postflow.theme')),
      'light',
    )
    await menu.getByRole('link', { name: 'Agenda', exact: true }).click()
    await mobile.page
      .getByRole('heading', { name: 'Agenda de conteúdo' })
      .waitFor()
    await mobile.page.getByRole('button', { name: 'Abrir menu' }).click()
    await mobile.page
      .getByRole('dialog', { name: 'Menu principal' })
      .getByRole('link', { name: 'Integrações', exact: true })
      .click()
    await mobile.page
      .getByRole('heading', { name: 'Conecte suas contas e ferramentas' })
      .waitFor()
    assert.equal(
      await mobile.page.evaluate(() => document.documentElement.dataset.theme),
      'light',
    )
    assert.deepEqual(mobile.errors, [])
    report.interactions.push({
      page: 'brand',
      themeControl: 'mobile menu, persistence, navigation passed',
    })
  } finally {
    await mobile.page.close()
    await mobileContext.close()
  }
}

async function runSystemPreference(browser, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  })
  const { page, errors } = await preparePage(
    context,
    'brand',
    1440,
    900,
    'system',
  )
  try {
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === 'light',
    )
    await maybeScreenshot(page, 'system-light-brand-1440.png')
    await context.setDefaultTimeout(5000)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === 'dark',
    )
    await maybeScreenshot(page, 'system-dark-brand-1440.png')
    assert.equal(
      await page.evaluate(() => localStorage.getItem('postflow.theme')),
      'system',
    )
    assert.deepEqual(errors, [])
    report.interactions.push({
      page: 'brand',
      systemPreference: 'live light-to-dark update passed',
    })
  } finally {
    await page.close()
    await context.close()
  }
}

async function runCrossTab(browser, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const first = await preparePage(context, 'brand', 1440, 900, 'dark')
  const second = await preparePage(context, 'finance', 1440, 900, 'dark')
  try {
    await first.page.getByLabel('Tema da aplicação').selectOption('light')
    await second.page.waitForFunction(
      () => document.documentElement.dataset.theme === 'light',
    )
    assert.equal(
      await second.page.evaluate(() => localStorage.getItem('postflow.theme')),
      'light',
    )
    assert.deepEqual(first.errors, [])
    assert.deepEqual(second.errors, [])
    await maybeScreenshot(second.page, 'cross-tab-light-finance-1440.png')
    report.interactions.push({ page: 'finance', sharedTabStorage: 'passed' })
  } finally {
    await first.page.close()
    await second.page.close()
    await context.close()
  }
}

async function runBlockedStorage(browser, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage disabled by QA fixture', 'SecurityError')
    }
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage disabled by QA fixture', 'SecurityError')
    }
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await installFixtures(page, 'login')
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('h1').first().waitFor()
  await page.getByLabel('Tema da aplicação').selectOption('light')
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === 'light',
  )
  assert.deepEqual(
    errors,
    [],
    `storage bloqueado causou erro: ${errors.join('; ')}`,
  )
  await maybeScreenshot(page, 'blocked-storage-login-light.png')
  report.interactions.push({
    page: 'login',
    blockedStorage: 'theme selector remains usable',
  })
  await page.close()
  await context.close()
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  for (const filename of fs.readdirSync(OUTPUT_DIR)) {
    if (/^failed-.*\.png$/.test(filename)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, filename))
    }
  }
  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    cases: [],
    interactions: [],
    failures: [],
  }
  let browser
  try {
    const response = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(5000),
    })
    assert.ok(response.ok, `Servidor visual indisponível em ${BASE_URL}`)
    browser = await chromium.launch({ headless: true })

    const cases = []
    for (const theme of ['dark', 'light']) {
      for (const viewport of VIEWPORTS) {
        for (const name of SCREEN_ROUTES) {
          cases.push({ name, theme, ...viewport })
        }
      }
      for (const extra of EXTRA_CASES) {
        cases.push({ name: extra.page, theme, ...extra })
      }
    }

    for (const testCase of cases) {
      const context = await browser.newContext({
        viewport: { width: testCase.width, height: testCase.height },
        locale: 'pt-BR',
        reducedMotion: 'reduce',
        colorScheme: testCase.theme,
      })
      let page
      try {
        const prepared = await preparePage(
          context,
          testCase.name,
          testCase.width,
          testCase.height,
          testCase.theme,
        )
        page = prepared.page
        const themeResult = await inspectTheme(page, testCase.name)
        const contrastEvidence = assertThemeHealth(themeResult)
        await assertNoOverflow(
          page,
          `${testCase.name} ${testCase.theme} ${testCase.width}`,
        )

        let secondaryScreenshot
        if (testCase.name === 'login-register') {
          await page.getByRole('button', { name: 'Criar conta' }).click()
          await page.getByRole('heading', { name: 'Criar conta' }).waitFor()
        }
        if (testCase.name === 'integrations') {
          secondaryScreenshot = `integrations-accounts-${testCase.theme}-${testCase.width}.png`
          await maybeScreenshot(page, secondaryScreenshot)
          await page.getByRole('tab', { name: /Publicações/ }).click()
          await page
            .getByRole('heading', { name: 'Publicações recentes' })
            .waitFor()
          await assertNoOverflow(
            page,
            `integrations publications ${testCase.theme} ${testCase.width}`,
          )
        }

        const file = `${testCase.name}-${testCase.theme}-${testCase.width}.png`
        await maybeScreenshot(page, file)
        assert.deepEqual(
          prepared.errors,
          [],
          `pageerror em ${testCase.name} ${testCase.theme} ${testCase.width}: ${prepared.errors.join('; ')}`,
        )
        report.cases.push({
          page: testCase.name,
          requestedTheme: testCase.theme,
          width: testCase.width,
          screenshot: file,
          theme: themeResult.theme,
          bodyBackground: themeResult.bodyBackground,
          documentWidth: themeResult.documentWidth,
          cardsChecked: themeResult.cards.length,
          surfaces: themeResult.cards,
          contrast: contrastEvidence,
          pageErrors: prepared.errors.length,
          visualChecks: 'passed',
          ...(secondaryScreenshot
            ? { accountsScreenshot: secondaryScreenshot }
            : {}),
        })
      } catch (error) {
        const item = {
          page: testCase.name,
          theme: testCase.theme,
          width: testCase.width,
          error: error.message,
        }
        report.failures.push(item)
        if (page) {
          const failureName = `failed-${testCase.name}-${testCase.theme}-${testCase.width}.png`
          await page
            .screenshot({
              path: path.join(OUTPUT_DIR, failureName),
              fullPage: true,
            })
            .catch(() => {})
          item.screenshot = failureName
        }
      } finally {
        await context.close()
      }
    }

    for (const theme of ['dark', 'light']) {
      for (const width of [390, 1440]) {
        try {
          await runCalendarDialogs(browser, width, theme, report)
        } catch (error) {
          report.failures.push({
            page: 'calendar-dialogs',
            theme,
            width,
            error: error.message,
          })
        }
      }
    }
    for (const [label, action] of [
      ['theme-controls', () => runUIThemeControls(browser, report)],
      ['system-preference', () => runSystemPreference(browser, report)],
      ['cross-tab-storage', () => runCrossTab(browser, report)],
      ['blocked-storage', () => runBlockedStorage(browser, report)],
    ]) {
      try {
        await action()
      } catch (error) {
        report.failures.push({ page: label, error: error.message })
      }
    }
  } catch (error) {
    report.failures.push({ page: 'runner', error: error.message })
  } finally {
    if (browser) await browser.close()
    const reportPath = path.join(OUTPUT_DIR, 'report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n')
    console.log(
      JSON.stringify({
        cases: report.cases.length,
        interactions: report.interactions.length,
        failures: report.failures.length,
        report: reportPath,
      }),
    )
    if (report.failures.length) {
      for (const failure of report.failures) console.error(failure)
      process.exitCode = 1
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
