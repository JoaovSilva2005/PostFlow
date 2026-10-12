// Browser integration with local API fixtures; this script never publishes to a real network.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDirectory = 'output/playwright/social-publishing'
const imageUrl = 'https://fixtures.postflow.test/social-cover.svg'
const brand = {
  name: 'Studio Aurora',
  segment: 'Tecnologia',
  toneOfVoice: 'Profissional',
  primaryColor: '#4F46E5',
}
const report = []

function provider(id, label, configured, missingConfiguration = []) {
  return {
    id,
    label,
    configured,
    missingConfiguration,
    formats: ['static'],
    setupUrl:
      id === 'tiktok'
        ? 'https://developers.tiktok.com/'
        : 'https://developers.facebook.com/',
  }
}

function connection(id, providerId, displayName) {
  return {
    id,
    provider: providerId,
    externalAccountId: `${providerId}-external-account`,
    displayName,
    accountType: providerId === 'facebook' ? 'page' : 'creator',
    status: 'connected',
    expiresAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
  }
}

function staticDraft(date) {
  return {
    id: 'draft-static',
    title: 'Social smoke estático',
    caption: 'Legenda aprovada para o TikTok.',
    hashtags: ['#Aurora', '#TesteSocial'],
    visualText: 'Planeje com clareza',
    platform: 'TikTok',
    date,
    time: '12:00',
    timezone: 'America/Sao_Paulo',
    status: 'draft',
    color: '#4F46E5',
    imageUrl,
    imageAvailable: true,
    format: 'static',
    formatData: {
      kind: 'static',
      headline: 'Planeje com clareza',
      visualDirection: 'Uma mesa organizada com agenda aberta.',
    },
  }
}

function carouselDraft(date) {
  return {
    ...staticDraft(date),
    id: 'draft-carousel',
    title: 'Social smoke carrossel',
    format: 'carousel',
    formatData: {
      kind: 'carousel',
      slides: [
        {
          headline: 'Passo 1',
          copy: 'Defina seu objetivo.',
          visualDirection: 'Card editorial azul.',
        },
        {
          headline: 'Passo 2',
          copy: 'Organize a pauta.',
          visualDirection: 'Card editorial azul.',
        },
      ],
    },
  }
}

function socialOverview(mode, state) {
  if (mode === 'unconfigured') {
    return {
      providers: [
        provider('instagram', 'Instagram', false, ['META_CLIENT_ID']),
        provider('facebook', 'Facebook', false, ['META_CLIENT_SECRET']),
        provider('linkedin', 'LinkedIn', false, ['LINKEDIN_CLIENT_ID']),
        provider('tiktok', 'TikTok', false, ['TIKTOK_CLIENT_KEY']),
      ],
      connections: [],
      pending: [],
      publications: [],
    }
  }
  if (mode === 'pending') {
    return {
      providers: [
        provider('facebook', 'Facebook', true),
        provider('instagram', 'Instagram', false),
        provider('linkedin', 'LinkedIn', false),
        provider('tiktok', 'TikTok', false),
      ],
      connections: state.connections,
      pending: state.pending,
      publications: [],
    }
  }
  return {
    providers: [
      provider('tiktok', 'TikTok', true),
      provider('facebook', 'Facebook', true),
      provider('instagram', 'Instagram', false),
      provider('linkedin', 'LinkedIn', false),
    ],
    connections: [
      connection('connection-tiktok', 'tiktok', 'Aurora TikTok'),
      connection('connection-facebook', 'facebook', 'Aurora Facebook'),
    ],
    pending: [],
    publications: state.publications,
  }
}

function todayLocal() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

async function preparePage(
  browser,
  width,
  { mode = 'unconfigured', drafts = [] } = {},
) {
  const page = await browser.newPage({
    viewport: { width, height: 960 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const errors = []
  const apiState = {
    mode,
    drafts: structuredClone(drafts),
    connections: [],
    pending: [],
    publications: [],
    publicationRequests: [],
    connectionRequests: [],
    unexpectedRequests: [],
  }
  apiState.pending =
    mode === 'pending'
      ? [
          {
            id: 'oauth-session-qa',
            provider: 'facebook',
            accounts: [
              {
                externalAccountId: 'facebook-page-qa',
                displayName: 'Página Aurora QA',
                accountType: 'page',
              },
            ],
          },
        ]
      : []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(imageUrl, (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#4F46E5"/><rect x="180" y="160" width="664" height="700" rx="32" fill="#fff"/><text x="240" y="360" font-size="64" fill="#202426">Planeje</text></svg>',
    }),
  )
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    let data
    if (path.endsWith('/auth/me')) {
      data = {
        user: { id: 'qa', displayName: 'QA', email: 'qa@example.com' },
        workspace: { id: 'workspace-qa', role: 'owner' },
        platformRole: null,
        billingStatus: 'active',
      }
    } else if (path.endsWith('/brands') && method === 'GET') {
      data = [
        {
          id: 'workspace-qa',
          role: 'owner',
          billingStatus: 'active',
          brand,
        },
      ]
    } else if (path.endsWith('/health')) {
      data = { status: 'ok', storage: 'fixture' }
    } else if (path.endsWith('/brand')) {
      data = brand
    } else if (path.endsWith('/drafts') && method === 'GET') {
      data = apiState.drafts
    } else if (path.endsWith('/social/overview') && method === 'GET') {
      data = socialOverview(mode, apiState)
    } else if (path.endsWith('/social/connections') && method === 'POST') {
      const input = request.postDataJSON()
      assert.deepEqual(input, {
        sessionId: 'oauth-session-qa',
        externalAccountId: 'facebook-page-qa',
      })
      apiState.connectionRequests.push(input)
      const result = {
        ...connection(
          'connection-facebook-pending',
          'facebook',
          'Página Aurora QA',
        ),
        externalAccountId: input.externalAccountId,
      }
      apiState.connections.push(result)
      apiState.pending = []
      data = result
    } else if (path.endsWith('/creator-info') && method === 'GET') {
      data = {
        creatorUsername: '@aurora_qa',
        creatorNickname: 'Aurora TikTok',
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: 180,
      }
    } else if (path.endsWith('/social/publications') && method === 'POST') {
      const input = request.postDataJSON()
      apiState.publicationRequests.push(input)
      assert.equal(input.draftId, 'draft-static')
      assert.equal(input.connectionId, 'connection-tiktok')
      assert.equal(input.consent, true)
      assert.deepEqual(input.expectedDraft, {
        title: 'Social smoke estático',
        caption: 'Legenda aprovada para o TikTok.',
        hashtags: ['#Aurora', '#TesteSocial'],
        imageUrl,
      })
      assert.equal(input.tiktok.privacyLevel, 'PUBLIC_TO_EVERYONE')
      assert.equal(input.tiktok.isAiGenerated, false)
      const publication = {
        id: `publication-${apiState.publicationRequests.length}`,
        draftId: input.draftId,
        connectionId: input.connectionId,
        provider: 'tiktok',
        title: input.expectedDraft.title,
        status: 'queued',
        scheduledAt: input.scheduledAt ?? new Date().toISOString(),
        remotePostId: null,
        remoteUrl: null,
        error: null,
        attempts: 0,
        createdAt: new Date().toISOString(),
      }
      apiState.publications.push(publication)
      data = publication
    } else {
      apiState.unexpectedRequests.push(`${method} ${path}`)
      return route.fulfill({
        status: 500,
        json: { error: `Unexpected API request ${method} ${path}` },
      })
    }
    return route.fulfill({ json: { data } })
  })
  return { page, apiState, errors }
}

async function runSocialUnavailable(browser, width, theme = 'dark') {
  const { page, errors } = await preparePage(browser, width, {
    mode: 'unconfigured',
  })
  try {
    await page.addInitScript((theme) => {
      localStorage.setItem('postflow.theme', theme)
    }, theme)
    await page.goto(
      `${base}/social${width === 1440 ? '?oauth=connected&workspace=workspace-qa' : ''}`,
    )
    await page
      .getByRole('heading', { name: 'Conecte suas redes sociais' })
      .waitFor()
    const setupMessage = page
      .getByText(/configuração administrativa da PostFlow/)
      .first()
    await setupMessage.waitFor()
    assert.equal(
      await page.getByText('META_CLIENT_ID', { exact: true }).count(),
      0,
    )
    const disabledButtons = page.getByRole('button', {
      name: 'Configuração pendente',
    })
    assert.equal(await disabledButtons.count(), 4)
    for (const button of await disabledButtons.all())
      assert.equal(await button.isDisabled(), true)
    await page.waitForURL(/\/integrations(?:\?.*)?$/)
    if (width === 1440) {
      const redirected = new URL(page.url())
      assert.equal(redirected.searchParams.get('oauth'), 'connected')
      assert.equal(redirected.searchParams.get('workspace'), 'workspace-qa')
    }
    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-integration]')]
      const rects = cards.map((card) => card.getBoundingClientRect())
      return {
        cards: cards.length,
        networks: cards.map((card) => card.dataset.integration),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        columns: new Set(rects.map((rect) => Math.round(rect.left))).size,
        cardOverflow: cards.some(
          (card) => card.scrollWidth > card.clientWidth + 1,
        ),
      }
    })
    assert.equal(layout.cards, 4)
    assert.deepEqual(layout.networks, [
      'facebook',
      'instagram',
      'linkedin',
      'tiktok',
    ])
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    assert.equal(layout.overflow, false)
    assert.equal(layout.cardOverflow, false)
    assert.equal(layout.columns, width <= 600 ? 1 : 2)
    await page.getByRole('tab', { name: /^Publicações/ }).click()
    await page.getByRole('heading', { name: 'Publicações recentes' }).waitFor()
    await page.getByRole('tab', { name: 'Contas', exact: true }).click()
    await page
      .getByRole('tab', { name: 'Contas', exact: true })
      .press('ArrowRight')
    assert.equal(
      await page
        .getByRole('tab', { name: /^Publicações/ })
        .getAttribute('aria-selected'),
      'true',
    )
    await page.getByRole('tab', { name: /^Publicações/ }).press('Home')
    await page.screenshot({
      path: `${outputDirectory}/social-unconfigured-${theme}-${width}.png`,
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    report.push({
      name: 'social-unconfigured',
      width,
      theme,
      providersBlocked: 4,
      secretsHidden: true,
      layout,
      errors,
    })
  } finally {
    await page.close()
  }
}

async function runPendingConnection(browser, width) {
  const { page, apiState, errors } = await preparePage(browser, width, {
    mode: 'pending',
  })
  try {
    await page.goto(`${base}/social`)
    const pending = page.getByRole('region', { name: 'Autorizações pendentes' })
    await pending.getByText('Página Aurora QA').waitFor()
    await pending.getByRole('button', { name: 'Conectar conta' }).click()
    await page
      .getByRole('status')
      .filter({ hasText: 'Facebook conectado.' })
      .waitFor()
    assert.deepEqual(apiState.connectionRequests, [
      { sessionId: 'oauth-session-qa', externalAccountId: 'facebook-page-qa' },
    ])
    assert.deepEqual(apiState.unexpectedRequests, [])
    await page.screenshot({
      path: `${outputDirectory}/social-pending-${width}.png`,
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    report.push({
      name: 'pending-account-selection',
      width,
      connectionCreated: true,
      credentialsRequested: false,
      errors,
    })
  } finally {
    await page.close()
  }
}

async function runCalendar(browser, width, scenario) {
  const date = todayLocal()
  const drafts = [staticDraft(date), carouselDraft(date)]
  const { page, apiState, errors } = await preparePage(browser, width, {
    mode: 'publishing',
    drafts,
  })
  try {
    await page.goto(`${base}/calendar`)
    const draftButton = page
      .getByRole('button', { name: 'Social smoke estático', exact: false })
      .first()
    await draftButton.waitFor()
    await draftButton.click()
    const staticCard = page.locator('[data-draft-id="draft-static"]')
    await staticCard.waitFor()
    const image = staticCard.getByRole('img', {
      name: 'Prévia da imagem que será publicada',
    })
    await image.waitFor()
    assert.equal(
      await image.evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    )
    const publishPanel = staticCard.getByRole('region', {
      name: 'Publicar nas redes',
    })
    assert.equal(
      await publishPanel.getByText('Legenda aprovada para o TikTok.').count(),
      1,
    )
    assert.equal(await staticCard.getByLabel('Aurora TikTok').count(), 1)
    assert.equal(await staticCard.getByLabel('Aurora Facebook').count(), 0)

    if (scenario === 'carousel') {
      const carouselCard = page.locator('[data-draft-id="draft-carousel"]')
      await carouselCard
        .getByText(/Publicação de imagem estática não é compatível/)
        .waitFor()
      assert.equal(
        await carouselCard
          .getByRole('button', { name: 'Publicar agora' })
          .isDisabled(),
        true,
      )
      await page.screenshot({
        path: `${outputDirectory}/carousel-blocked-${width}.png`,
        fullPage: true,
      })
      assert.equal(apiState.publicationRequests.length, 0)
      report.push({
        name: 'carousel-blocked',
        width,
        publicationSent: false,
        errors,
      })
      return
    }

    if (scenario === 'unsaved') {
      const caption = staticCard.getByRole('textbox', { name: 'Legenda' })
      await caption.fill('Alteração local ainda não salva')
      assert.equal(
        await staticCard
          .getByRole('button', { name: 'Publicar agora' })
          .isDisabled(),
        true,
      )
      assert.equal(apiState.publicationRequests.length, 0)
      await page.screenshot({
        path: `${outputDirectory}/unsaved-blocked-${width}.png`,
        fullPage: true,
      })
      report.push({
        name: 'unsaved-changes-blocked',
        width,
        publicationSent: false,
        errors,
      })
      return
    }

    await publishPanel.getByLabel('Aurora TikTok').check()
    await publishPanel
      .getByLabel('Privacidade')
      .selectOption('PUBLIC_TO_EVERYONE')
    await publishPanel
      .getByLabel('Esta mídia foi gerada por IA?')
      .selectOption('no')
    await publishPanel.getByLabel(/Confirmo a publicação desta prévia/).check()

    if (scenario === 'publication') {
      const caption = staticCard.getByRole('textbox', { name: 'Legenda' })
      await caption.fill('Edição local temporária')
      assert.equal(
        await publishPanel
          .getByRole('button', { name: 'Publicar agora' })
          .isDisabled(),
        true,
      )
      assert.equal(apiState.publicationRequests.length, 0)
      await caption.fill('Legenda aprovada para o TikTok.')
    }

    await publishPanel.getByRole('button', { name: 'Publicar agora' }).click()
    await publishPanel.getByText('Solicitação registrada: queued.').waitFor()
    assert.equal(apiState.publicationRequests.length, 1)
    assert.equal(apiState.publicationRequests[0].consent, true)
    assert.equal(
      apiState.publicationRequests[0].connectionId,
      'connection-tiktok',
    )
    assert.equal(
      apiState.publicationRequests[0].expectedDraft.caption,
      'Legenda aprovada para o TikTok.',
    )
    assert.equal(
      apiState.publicationRequests[0].tiktok.privacyLevel,
      'PUBLIC_TO_EVERYONE',
    )
    assert.equal(apiState.publicationRequests[0].tiktok.isAiGenerated, false)
    assert.equal(
      await staticCard
        .locator('header')
        .getByText('Rascunho', { exact: true })
        .count(),
      1,
    )
    assert.equal(
      await staticCard
        .locator('header')
        .getByText('Publicado', { exact: true })
        .count(),
      0,
    )
    assert.deepEqual(apiState.unexpectedRequests, [])
    await page.screenshot({
      path: `${outputDirectory}/calendar-publication-queued-${width}.png`,
      fullPage: true,
    })
    assert.deepEqual(errors, [])
    report.push({
      name: 'static-publication-consent',
      width,
      apiStatus: 'queued',
      correctNetworkAccount: true,
      savedSnapshotSent: true,
      tiktokPrivacyExplicit: true,
      aiDisclosureExplicit: true,
      editorialStatusRemainsDraft: true,
      errors,
    })
  } finally {
    await page.close()
  }
}

;(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      await runSocialUnavailable(browser, width)
      await runPendingConnection(browser, width)
      await runCalendar(browser, width, 'publication')
    }
    for (const width of [320, 768, 1024, 1280, 1920, 2560])
      await runSocialUnavailable(browser, width)
    for (const width of [1440, 390])
      await runSocialUnavailable(browser, width, 'light')
    await runCalendar(browser, 1440, 'carousel')
    await runCalendar(browser, 1440, 'unsaved')
  } finally {
    fs.writeFileSync(
      `${outputDirectory}/report.json`,
      JSON.stringify(
        { base, fixturesOnly: true, realNetworkCalls: 0, cases: report },
        null,
        2,
      ),
    )
    await browser.close()
  }
  console.log(JSON.stringify(report))
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
