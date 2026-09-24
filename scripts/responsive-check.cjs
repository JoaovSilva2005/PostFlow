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
function dateInCurrentMonth(day) {
  const date = new Date()
  date.setDate(1)
  date.setHours(12, 0, 0, 0)
  date.setDate(
    Math.min(
      day,
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
    ),
  )
  return date.toISOString().slice(0, 10)
}

const drafts = [
  {
    id: 'draft-1',
    title: 'Uma nova forma de criar',
    scheduled_at: dateInCurrentMonth(14) + 'T12:00:00Z',
    status: 'draft',
    social_platforms: { name: 'Instagram' },
  },
  {
    id: 'draft-2',
    title: 'Bastidores da nossa marca',
    scheduled_at: dateInCurrentMonth(20) + 'T12:00:00Z',
    status: 'draft',
    social_platforms: { name: 'LinkedIn' },
  },
  {
    id: 'draft-3',
    title: 'Ideias que conectam',
    scheduled_at: dateInCurrentMonth(26) + 'T12:00:00Z',
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
  const state = { batchInput: null, generatedBatch: null, persistedBatch: null }
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
        workspace: { id: 'workspace-qa', role: 'owner' },
        platformRole: 'platform_owner',
        billingStatus: 'active',
      }
    } else if (path.endsWith('/health'))
      data = { status: 'ok', storage: 'supabase' }
    else if (path.includes('/workspaces/') && path.endsWith('/brand'))
      data = {
        name: brand.name,
        segment: brand.segment,
        toneOfVoice: brand.tone_of_voice,
        primaryColor: brand.primary_color,
      }
    else if (path.includes('/workspaces/') && path.endsWith('/drafts/batch')) {
      state.persistedBatch = JSON.parse(route.request().postData() || '[]')
      data = state.persistedBatch
    } else if (path.includes('/workspaces/') && path.endsWith('/drafts'))
      data = drafts.map((draft) => ({
        id: draft.id,
        title: draft.title,
        caption: draft.caption,
        hashtags: draft.post_hashtags.map((tag) => tag.hashtag),
        platform: draft.social_platforms.name,
        date: draft.scheduled_at.slice(0, 10),
        status: draft.status,
        visualText: draft.visual_text,
        color: draft.color,
      }))
    else if (path.endsWith('/finance/summary')) data = summary
    else if (path.endsWith('/finance/transactions')) data = transactions
    else if (path.endsWith('/content/generate-batch')) {
      state.batchInput = JSON.parse(route.request().postData() || '{}')
      const requestBody = state.batchInput
      const formatData = () => ({
        kind: 'reels',
        hook: 'Uma ideia simples para começar.',
        durationSeconds: 20,
        scenes: [
          {
            shot: 'Apresente a ideia para a câmera.',
            narration: requestBody.prompt,
            onScreenText: 'Uma dica prática',
          },
          {
            shot: 'Mostre um exemplo relacionado.',
            narration: 'Use um exemplo que sua marca possa confirmar.',
            onScreenText: 'Veja um exemplo',
          },
          {
            shot: 'Encerre olhando para a câmera.',
            narration: 'Convide o público a continuar a conversa.',
            onScreenText: 'Conte sua opinião',
          },
        ],
        closingCta: 'Compartilhe sua experiência.',
      })
      state.generatedBatch = requestBody.dates.flatMap((date) =>
        requestBody.platforms.map((platform, index) => ({
          id: `generated-${date}-${index}`,
          title: `Ideia para ${platform}`,
          caption: `${requestBody.prompt} — ${platform}.`,
          hashtags: ['#PostFlow'],
          platform,
          date,
          status: 'draft',
          visualText: 'Uma dica prática',
          color: brand.primary_color,
          format: requestBody.format,
          formatData: formatData(),
          persona: requestBody.persona,
          time: requestBody.time,
          timezone: requestBody.timezone,
        })),
      )
      data = state.generatedBatch
    } else if (path.endsWith('/content/generate'))
      data = {
        id: 'generated-qa',
        title: 'Uma nova forma de criar',
        caption: 'Conheça uma nova forma de criar conteúdo para sua marca.',
        hashtags: ['#PostFlow', '#Conteúdo'],
        platform: 'Instagram',
        date: '2026-09-22',
        status: 'draft',
        visualText: 'Ideias que conectam.',
        color: '#4F46E5',
      }
    else if (path.endsWith('/fiscal/report'))
      data = {
        period: '2026-09',
        taxRate: 6,
        sales: [
          {
            ...transactions[0],
            brandId: 'qa',
            gross: 3500,
            tax: 210,
            net: 3290,
            taxRate: 6,
            receiptReference: 'PF-QA-1',
            createdAt: '2026-09-16',
            updatedAt: '2026-09-16',
            paidAt: '2026-09-16',
          },
        ],
        totals: {
          gross: 3500,
          tax: 210,
          net: 3290,
          received: 3500,
          pending: 0,
        },
      }
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
  return state
}

;(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  })
  const output = process.env.QA_OUTPUT || 'docs/screenshots/responsive'
  fs.mkdirSync(output, { recursive: true })
  let checked = 0
  try {
    for (const width of (process.env.QA_WIDTHS || '320,390,768,1024,1440')
      .split(',')
      .map(Number)) {
      for (const name of (
        process.env.QA_PAGES ||
        'login,brand,chat,calendar,finance,fiscal,admin-plans'
      ).split(',')) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          locale: 'pt-BR',
          reducedMotion: 'reduce',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        const mock = await mockNetwork(page, name)
        const routePath = name === 'admin-plans' ? 'admin/plans' : name
        console.log(`QA ${width}px · ${name}`)
        await page.goto('http://127.0.0.1:5173/' + routePath)
        try {
          await page.locator('h1').waitFor({ timeout: 10_000 })
        } catch (error) {
          const body = (await page.locator('body').innerText()).slice(0, 400)
          await page.screenshot({
            path: output + '/failed-' + name + '-' + width + '.png',
            fullPage: true,
          })
          throw new Error(
            `Não carregou título em ${name} a ${width}px. URL: ${page.url()}. ` +
              `Erros: ${errors.join('; ')}. Página: ${body}`,
            { cause: error },
          )
        }
        await page.evaluate(() => document.fonts.ready)
        if (name !== 'login') {
          let navigation = page
          if (width <= 760) {
            await page.getByRole('button', { name: 'Abrir menu' }).click()
            navigation = page.getByRole('dialog', { name: 'Menu principal' })
          }
          await navigation
            .getByRole('link', { name: 'Financeiro', exact: true })
            .waitFor()
          await navigation
            .getByRole('link', { name: 'Fiscal', exact: true })
            .waitFor()
          if (width <= 760) {
            await page.keyboard.press('Escape')
            await page.getByRole('button', { name: 'Abrir menu' }).waitFor()
          }
        }
        if (name === 'finance')
          await page
            .getByText('Consultoria de conteúdo', { exact: true })
            .waitFor()
        if (name === 'calendar')
          await page
            .getByRole('button', { name: /Uma nova forma de criar/ })
            .waitFor()
        if (name === 'calendar') {
          await page
            .getByLabel('Ideia do conteúdo na agenda')
            .fill('Compartilhe uma dica prática para organizar a semana')
          await page
            .getByRole('button', { name: 'Gerar conteúdo', exact: true })
            .click()
          const dialog = page.getByRole('dialog', {
            name: 'Configurar geração',
          })
          await dialog.waitFor()
          await page
            .getByLabel('Público ou persona (opcional)')
            .fill('Pessoas que estão começando')
          await page.getByLabel('Horário de Brasília').fill('09:45')
          await page.getByLabel('Próximos 7 dias').check()
          await dialog.getByRole('button', { name: /^Reels/ }).click()
          await dialog
            .getByRole('button', { name: 'Facebook', exact: true })
            .click()
          assert.equal(
            await page.getByLabel('Horário de Brasília').getAttribute('value'),
            '09:45',
          )
          await dialog
            .getByRole('button', { name: 'Gerar 14 rascunhos' })
            .waitFor()
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            'painel de geração: overflow em ' + width,
          )
          await page.screenshot({
            path: output + '/calendar-generator-' + width + '.png',
            fullPage: true,
          })
          await dialog
            .getByRole('button', { name: 'Gerar 14 rascunhos' })
            .click()
          await page
            .getByText(
              '14 rascunhos salvos na agenda para revisão. A publicação é manual.',
              { exact: true },
            )
            .waitFor()
          assert.equal(mock.batchInput.dates.length, 7)
          assert.deepEqual(mock.batchInput.platforms, ['Instagram', 'Facebook'])
          assert.equal(mock.batchInput.time, '09:45')
          assert.equal(mock.batchInput.timezone, 'America/Sao_Paulo')
          assert.equal(mock.batchInput.format, 'reels')
          assert.equal(mock.generatedBatch.length, 14)
          assert.equal(mock.persistedBatch.length, 14)
          assert.equal(
            new Set(
              mock.persistedBatch.map(
                (draft) => `${draft.date}|${draft.platform}`,
              ),
            ).size,
            14,
          )
        }
        if (name === 'chat') {
          await page.screenshot({
            path: output + '/chat-empty-' + width + '.png',
            fullPage: true,
          })
          await page
            .getByLabel('Pedido para a IA')
            .fill('Apresente uma novidade da nossa marca')
          await page
            .getByRole('button', { name: 'Gerar post', exact: true })
            .click()
          if (width <= 1100) {
            // The responsive studio opens the review panel automatically after generation.
            await page
              .getByRole('heading', { name: 'Revise seu rascunho' })
              .waitFor()
          } else {
            await page
              .getByRole('button', { name: /Revisar rascunho/ })
              .waitFor()
            await page.getByRole('button', { name: /Revisar rascunho/ }).click()
            await page
              .getByRole('heading', { name: 'Revise seu rascunho' })
              .waitFor()
          }
        }
        if (name === 'fiscal')
          await page.getByRole('button', { name: /Ver comprovante/ }).waitFor()
        if (name === 'brand') {
          await page.getByRole('tab', { name: /Contexto da IA/ }).click()
          await page
            .getByLabel('O que a marca faz?')
            .fill('Uma marca com uma proposta clara.')
          await page.getByRole('tab', { name: /Direção editorial/ }).click()
          await page
            .getByLabel('Chamada para ação padrão')
            .fill('Conheça a marca')
          await page.getByRole('tab', { name: /Essencial/ }).click()
          await page.getByRole('button', { name: 'Adicionar cor' }).click()
          await page
            .getByRole('textbox', { name: 'Cor de apoio 1', exact: true })
            .waitFor()
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
        if (name === 'chat') {
          await page.getByRole('button', { name: 'Editar conteúdo' }).click()
          await page.getByLabel('Título do post').fill('Conteúdo revisado')
          await page.screenshot({
            path: output + '/chat-edit-' + width + '.png',
            fullPage: true,
          })
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          )
        }
        if (name === 'fiscal') {
          await page.getByRole('button', { name: /Ver comprovante/ }).click()
          await page
            .getByRole('region', { name: 'Comprovante de venda de serviço' })
            .waitFor()
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          )
          await page.screenshot({
            path: output + '/fiscal-detail-' + width + '.png',
            fullPage: true,
          })
          if (width === 1440) {
            await page.emulateMedia({ media: 'print' })
            await page.screenshot({
              path: output + '/receipt-print.png',
              fullPage: true,
            })
            await page.emulateMedia({ media: 'screen' })
          }
        }
        if (name === 'admin-plans') {
          await page.getByText('Entenda e simule o custo do plano').click()
          await page.getByLabel('Gerações de imagem').fill('1000')
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          )
          await page.screenshot({
            path: output + '/admin-plans-detail-' + width + '.png',
            fullPage: true,
          })
        }
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
