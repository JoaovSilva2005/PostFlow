// Browser integration with deterministic HTTP fixtures; never calls paid AI.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:4173'
const imageUrl = 'https://fixtures.postflow.test/calendar-cover.svg'
const brand = {
  name: 'Studio Aurora',
  segment: 'Tecnologia',
  toneOfVoice: 'Profissional',
  primaryColor: '#4F46E5',
}
const report = []

function formatData(format) {
  if (format === 'carousel')
    return {
      kind: format,
      slides: [1, 2, 3].map((i) => ({
        headline: `Ideia ${i}`,
        copy: 'Planeje seu conteúdo com antecedência.',
        visualDirection: 'Composição editorial com calendário.',
      })),
    }
  if (format === 'reels')
    return {
      kind: format,
      hook: 'Organize sua semana',
      durationSeconds: 20,
      scenes: [1, 2, 3].map(() => ({
        shot: 'Pessoa organizando agenda',
        narration: 'Planeje com antecedência.',
        onScreenText: 'Planeje sua semana',
      })),
      closingCta: 'Salve esta dica.',
    }
  return {
    kind: 'static',
    headline: 'Organize sua semana',
    visualDirection: 'Calendário em uma mesa de trabalho.',
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  fs.mkdirSync('output/playwright/calendar-generation', { recursive: true })
  try {
    for (const width of [390, 1440])
      for (const format of ['static', 'carousel', 'reels']) {
        const page = await browser.newPage({
          viewport: { width, height: 950 },
          locale: 'pt-BR',
        })
        const errors = []
        const state = { drafts: [], texts: 0, images: 0, writes: 0 }
        page.on('pageerror', (error) => errors.push(error.message))
        await page.route(imageUrl, (route) =>
          route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#4F46E5"/><rect x="200" y="180" width="624" height="640" rx="35" fill="#fff"/><path d="M260 360H764M260 500H764M260 640H764M400 280V740M600 280V740" stroke="#4F46E5" stroke-width="18"/></svg>',
          }),
        )
        await page.route('**/api/**', async (route) => {
          const path = new URL(route.request().url()).pathname
          const method = route.request().method()
          let data
          if (path.includes('/auth/'))
            data = {
              user: { id: 'qa', displayName: 'QA', email: 'qa@example.com' },
              workspace: { id: 'workspace-qa', role: 'owner' },
              platformRole: 'platform_owner',
              billingStatus: 'active',
            }
          else if (path.endsWith('/brands'))
            data = [
              {
                id: 'workspace-qa',
                role: 'owner',
                billingStatus: 'active',
                brand,
              },
            ]
          else if (path.endsWith('/health'))
            data = { status: 'ok', storage: 'test' }
          else if (path.endsWith('/brand')) data = brand
          else if (path.endsWith('/generate-batch')) {
            state.texts++
            const input = route.request().postDataJSON()
            assert.equal(input.format, format)
            data = input.dates.flatMap((date) =>
              input.platforms.map((platform, i) => ({
                id: `draft-${date}-${i}`,
                title: `Planejamento ${platform}`,
                caption: `Uma dica para ${platform}: organize sua semana.`,
                hashtags: ['#Planejamento'],
                visualText: 'Organize sua semana',
                platform,
                date,
                status: 'draft',
                color: '#4F46E5',
                format,
                formatData: formatData(format),
                persona: input.persona,
                time: input.time,
                timezone: input.timezone,
              })),
            )
          } else if (path.endsWith('/generate-image')) {
            state.images++
            assert.equal(
              state.writes,
              0,
              'Posts must be saved with their image',
            )
            assert.equal(route.request().postDataJSON().format, format)
            await new Promise((resolve) => setTimeout(resolve, 120))
            data = imageUrl
          } else if (path.endsWith('/drafts') && method === 'POST') {
            data = { ...route.request().postDataJSON(), imageAvailable: true }
            assert.equal(data.imageUrl, imageUrl)
            state.writes++
            state.drafts.push(data)
          } else if (path.endsWith('/drafts')) data = state.drafts
          else throw new Error(`Unexpected API request ${method} ${path}`)
          await route.fulfill({ json: { data } })
        })
        await page.goto(`${base}/calendar`)
        await page
          .getByLabel('Ideia do conteúdo na agenda')
          .fill('Dicas de planejamento de conteúdo para a semana')
        await page
          .getByRole('button', { name: 'Gerar conteúdo', exact: true })
          .click()
        const dialog = page.getByRole('dialog', { name: 'Configurar geração' })
        await dialog.getByRole('button', { name: /^Facebook$/ }).click()
        await dialog.getByRole('button', { name: /^X \/ Twitter$/ }).click()
        await dialog
          .getByRole('button', {
            name: new RegExp(
              `^${{ static: 'Estático', carousel: 'Carrossel', reels: 'Reels' }[format]}`,
            ),
          })
          .click()
        await dialog
          .getByRole('button', { name: 'Gerar 3 rascunhos e imagens' })
          .click()
        await page
          .getByRole('status')
          .filter({ hasText: '3 rascunhos com imagens salvos' })
          .waitFor()
        assert.equal(state.texts, 1)
        assert.equal(state.images, 1)
        assert.equal(state.writes, 3)
        assert.equal(
          new Set(state.drafts.map((draft) => draft.caption)).size,
          3,
        )
        assert.equal(
          new Set(state.drafts.map((draft) => draft.imageUrl)).size,
          1,
        )
        await page.reload()
        await page.getByRole('button', { name: 'Lista', exact: true }).click()
        await page
          .getByRole('button', { name: /Planejamento Instagram/ })
          .click()
        const preview = page
          .getByRole('article', { name: 'Post para Instagram' })
          .getByRole('region', { name: 'Prévia do post' })
        const image = preview.getByRole('img', {
          name: 'Imagem gerada para o post',
        })
        await image.waitFor()
        assert.equal(
          await image.evaluate((img) => img.complete && img.naturalWidth > 0),
          true,
        )
        assert.equal(
          await image.evaluate((img) => getComputedStyle(img).objectFit),
          'contain',
        )
        await page.screenshot({
          path: `output/playwright/calendar-generation/${format}-${width}.png`,
          fullPage: true,
        })
        assert.deepEqual(errors, [])
        report.push({
          width,
          format,
          texts: state.texts,
          images: state.images,
          saved: state.writes,
          sharedImage: true,
          captionsPerPlatform: true,
          reload: 'passed',
          imageLoaded: true,
          errors,
        })
        await page.close()
      }
  } finally {
    fs.writeFileSync(
      'output/playwright/calendar-generation/report.json',
      JSON.stringify({ base, fixtures: true, cases: report }, null, 2),
    )
    await browser.close()
  }
  console.log(JSON.stringify(report))
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
