// Browser check of the calendar day modal layout (SCRUM-66) with local HTTP
// fixtures only. Every API call is answered by this script, every other
// non-local request is aborted, and nothing is ever published to a network.
//
// Usage (after `npm run build` with test env values):
//   node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173
//   node scripts/calendar-day-layout-check.cjs
// Screenshots go to .superpowers/screens/ (git-ignored).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDirectory = path.join('.superpowers', 'screens')
const imageUrl = 'https://fixtures.postflow.test/halloween-cover.svg'
const brand = {
  name: 'Studio Aurora',
  segment: 'Tecnologia',
  toneOfVoice: 'Profissional',
  primaryColor: '#4F46E5',
}

function todayLocal() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const date = todayLocal()
const sharedArt = {
  imageUrl,
  imageAvailable: true,
  format: 'static',
  formatData: {
    kind: 'static',
    headline: 'Um Halloween conectado',
    visualDirection: 'Abóbora iluminada com circuitos em tons de violeta.',
  },
  color: '#4F46E5',
  timezone: 'America/Sao_Paulo',
  date,
}
const drafts = [
  {
    ...sharedArt,
    id: 'draft-instagram',
    title: 'Um Halloween conectado',
    caption:
      'Neste Halloween, que a única surpresa seja a diversão. Boa noite de travessuras e boas ideias! 🎃',
    hashtags: ['#Halloween', '#Tecnologia'],
    visualText: 'Um Halloween conectado',
    platform: 'Instagram',
    time: '16:30',
    status: 'published',
  },
  {
    ...sharedArt,
    id: 'draft-facebook',
    title: 'Halloween para negócios',
    caption:
      'Halloween chegou! Que tal transformar a noite de hoje em uma ótima ideia para o seu negócio? Conte para a gente como você vai comemorar.',
    hashtags: ['#Halloween', '#Negócios', '#Marketing'],
    visualText: 'Um Halloween conectado',
    platform: 'Facebook',
    time: '18:00',
    status: 'draft',
  },
]

function provider(id, label) {
  return {
    id,
    label,
    configured: true,
    missingConfiguration: [],
    formats: ['static'],
    setupUrl: 'https://developers.facebook.com/',
  }
}
function connection(id, providerId, displayName) {
  return {
    id,
    provider: providerId,
    externalAccountId: `${providerId}-demo`,
    displayName,
    accountType: providerId === 'facebook' ? 'page' : 'business',
    status: 'connected',
    expiresAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
  }
}
const overview = {
  demoMode: true,
  providers: [
    provider('instagram', 'Instagram'),
    provider('facebook', 'Facebook'),
  ],
  connections: [
    connection('connection-instagram', 'instagram', 'Aurora Instagram'),
    connection('connection-facebook', 'facebook', 'Página Aurora'),
  ],
  pending: [],
  publications: [],
}

const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
<defs><radialGradient id="g" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#3b2a8f"/><stop offset="1" stop-color="#0d0a2b"/></radialGradient></defs>
<rect width="1024" height="1024" fill="url(#g)"/>
<ellipse cx="512" cy="600" rx="250" ry="210" fill="#ff8a1f"/>
<ellipse cx="512" cy="600" rx="120" ry="210" fill="#ffa64d" opacity="0.6"/>
<rect x="490" y="360" width="44" height="70" rx="12" fill="#3f8f3a"/>
<path d="M420 560l50-40 30 60zM604 560l-50-40-30 60z" fill="#2a1200"/>
<path d="M410 660q102 80 204 0l-30 30-30-20-30 30-30-30-30 20z" fill="#2a1200"/>
</svg>`

async function runCase(browser, { width, theme }) {
  const page = await browser.newPage({
    viewport: { width, height: width === 1440 ? 960 : 844 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const errors = []
  const unexpected = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript((value) => {
    localStorage.setItem('postflow.theme', value)
  }, theme)
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (url.href === imageUrl)
      return route.fulfill({ contentType: 'image/svg+xml', body: coverSvg })
    if (url.origin !== new URL(base).origin) {
      unexpected.push(`${method} ${url.origin}${url.pathname}`)
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const pathname = url.pathname
    let data
    if (pathname.includes('/auth/'))
      data = {
        user: { id: 'qa', displayName: 'QA', email: 'qa@example.com' },
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
    else {
      unexpected.push(`${method} ${pathname}`)
      return route.fulfill({
        status: 500,
        json: { error: `Unexpected API request ${method} ${pathname}` },
      })
    }
    return route.fulfill({ json: { data } })
  })

  const tag = `${width}-${theme}`
  try {
    await page.goto(`${base}/calendar`)
    const entry = page
      .getByRole('button', { name: /Halloween para negócios/ })
      .first()
    await entry.waitFor()
    await entry.click()
    const dayDialog = page.getByRole('dialog').first()
    await dayDialog.getByRole('heading', { name: 'Facebook' }).waitFor()
    await dayDialog.getByRole('heading', { name: 'Instagram' }).waitFor()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img')].every((img) => img.complete),
    )
    await page.waitForTimeout(250)

    const layout = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const offenders = [...dialog.querySelectorAll('*')]
        .filter((el) => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && rect.right > window.innerWidth + 1
        })
        .map((el) => el.className || el.tagName)
        .slice(0, 5)
      return {
        pageOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 1,
        offenders,
        posts: dialog.querySelectorAll('article').length,
      }
    })
    assert.equal(layout.posts, 2)
    assert.equal(layout.pageOverflow, false, 'page scrolls horizontally')
    assert.deepEqual(layout.offenders, [], 'elements overflow the viewport')

    await page.screenshot({
      path: path.join(outputDirectory, `day-${tag}.png`),
    })

    // Per-card screenshots. The day dialog scrolls internally, so on desktop
    // each card is captured as an element; on the phone the viewport is
    // captured at the card top and again at its "Mais recursos" column.
    const cards = dayDialog.locator('article')
    for (let index = 0; index < 2; index++) {
      const card = cards.nth(index)
      const name = `day-${tag}-card${index + 1}`
      if (width >= 1000) {
        await card.scrollIntoViewIfNeeded()
        await card.screenshot({
          path: path.join(outputDirectory, `${name}.png`),
        })
        continue
      }
      await card.evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(100)
      await page.screenshot({ path: path.join(outputDirectory, `${name}.png`) })
      await card
        .getByRole('region', { name: 'Mais recursos' })
        .evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(100)
      await page.screenshot({
        path: path.join(outputDirectory, `${name}-recursos.png`),
      })
    }

    const facebook = dayDialog.getByRole('article', {
      name: 'Post para Facebook',
    })
    await facebook.scrollIntoViewIfNeeded()
    await facebook
      .getByRole('button', { name: /Editar data e horário/ })
      .click()
    const editor = page.getByRole('dialog', { name: 'Agenda do post' })
    await editor.waitFor()
    await editor.getByLabel('Data').waitFor()
    await editor.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(outputDirectory, `schedule-editor-${tag}.png`),
    })
    const editorBox = await editor.boundingBox()
    assert.ok(editorBox.x >= 0 && editorBox.x + editorBox.width <= width + 1)
    await page.keyboard.press('Escape')
    await editor.waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('dialog').count(), 1)

    await facebook.getByRole('button', { name: 'Publicar nas redes' }).click()
    const publish = page.getByRole('dialog', { name: 'Publicar nas redes' })
    await publish.waitFor()
    await publish.getByText('Página Aurora').waitFor()
    await publish.getByText(/Modo demonstração/).waitFor()
    assert.equal(
      await publish.getByAltText('Prévia da imagem que será publicada').count(),
      0,
      'publish dialog must not repeat the preview',
    )
    await publish.getByRole('button', { name: 'Publicar agora' }).waitFor()
    await page.waitForTimeout(150)
    await page.screenshot({
      path: path.join(outputDirectory, `publish-dialog-${tag}.png`),
    })
    await page.keyboard.press('Escape')
    await publish.waitFor({ state: 'hidden' })
    assert.equal(await page.getByRole('dialog').count(), 1)

    assert.deepEqual(errors, [], 'page errors')
    assert.deepEqual(unexpected, [], 'unexpected requests')
    console.log(`ok ${tag}`)
  } finally {
    await page.close()
  }
}

;(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  let failed = false
  try {
    for (const width of [1440, 390])
      for (const theme of ['dark', 'light']) {
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
