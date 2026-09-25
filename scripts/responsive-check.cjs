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
    id: 'draft-4',
    title: 'Uma dica para compartilhar',
    scheduled_at: dateInCurrentMonth(14) + 'T15:00:00Z',
    status: 'scheduled',
    social_platforms: { name: 'Facebook' },
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
      if (name.startsWith('login'))
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
    else if (path.endsWith('/brands'))
      data = [
        {
          id: 'workspace-qa',
          role: 'owner',
          billingStatus: 'active',
          brand: {
            name: 'PostFlow Administração',
            segment: 'Tecnologia',
            toneOfVoice: 'Profissional e objetivo',
            primaryColor: '#4F46E5',
          },
        },
        {
          id: 'workspace-qa-2',
          role: 'owner',
          billingStatus: 'none',
          brand: {
            name: 'Studio Aurora',
            segment: 'Tecnologia',
            toneOfVoice: 'Profissional e objetivo',
            primaryColor: '#4F46E5',
          },
        },
      ]
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
    } else if (
      path.includes('/workspaces/') &&
      /\/drafts\/[^/]+$/.test(path) &&
      route.request().method() === 'PATCH'
    ) {
      state.updatedDraft = JSON.parse(route.request().postData() || '{}')
      const original = drafts.find(({ id }) => path.endsWith(`/drafts/${id}`))
      data = {
        id: original?.id,
        title: original?.title,
        caption: original?.caption,
        hashtags: original?.post_hashtags.map((tag) => tag.hashtag) ?? [],
        platform: original?.social_platforms.name,
        date: original?.scheduled_at.slice(0, 10),
        time: '12:00',
        timezone: 'America/Sao_Paulo',
        status: original?.status,
        visualText: original?.visual_text,
        color: original?.color,
        ...state.updatedDraft,
      }
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
    else if (path.endsWith('/billing/plans'))
      data = [
        {
          id: 'plan-qa',
          code: 'professional',
          name: 'Profissional',
          price: 99,
          limits: { text: 100, image: 20 },
        },
      ]
    else if (path.endsWith('/billing'))
      data = {
        workspaceId: 'workspace-qa',
        demoMode: true,
        plan:
          name === 'billing-empty'
            ? null
            : {
                id: 'plan-qa',
                code: 'professional',
                name: 'Profissional',
                price: 99,
                limits: { text: 100, image: 20 },
              },
        subscription:
          name === 'billing-empty'
            ? null
            : {
                id: 'subscription-qa',
                status: 'active',
                currentPeriodStart: '2026-09-01',
                currentPeriodEnd: '2026-10-01',
              },
        usage: {
          period: '2026-09',
          textUsed: 12,
          imageUsed: 3,
          textReserved: 0,
          imageReserved: 0,
        },
      }
    else if (path.endsWith('/invoices'))
      data =
        name === 'billing-empty'
          ? []
          : [
              {
                id: 'invoice-qa',
                number: 'PF-2026-001',
                amount: 99,
                status: 'paid',
                dueDate: '2026-09-10',
                paidAt: '2026-09-09',
                receipt: null,
              },
            ]
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
    } else if (path.endsWith('/content/generate')) {
      const input = JSON.parse(route.request().postData() || '{}')
      data = {
        id: `generated-${input.platform}`,
        title: `Uma nova forma de criar para ${input.platform}`,
        caption: `Conheça uma nova forma de criar conteúdo para ${input.platform}.`,
        hashtags: ['#PostFlow', '#Conteúdo'],
        platform: input.platform,
        date: input.date,
        status: 'draft',
        visualText: 'Ideias que conectam.',
        color: '#4F46E5',
      }
    } else if (path.endsWith('/fiscal/report'))
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
        'login,login-register,brand,brand-new,chat,calendar,finance,fiscal,billing,billing-empty,admin-plans'
      ).split(',')) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          locale: 'pt-BR',
          reducedMotion: 'reduce',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        const mock = await mockNetwork(page, name)
        const routePath =
          name === 'admin-plans'
            ? 'admin/plans'
            : name === 'billing-empty'
              ? 'billing'
              : name === 'login-register'
                ? 'login'
                : name === 'brand-new'
                  ? 'brand/new'
                  : name
        console.log(`QA ${width}px · ${name}`)
        await page.goto(
          (process.env.QA_BASE_URL || 'http://127.0.0.1:5173') +
            '/' +
            routePath,
        )
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
        if (!name.startsWith('login')) {
          let navigation = page
          if (width <= 900) {
            await page.getByRole('button', { name: 'Abrir menu' }).click()
            navigation = page.getByRole('dialog', { name: 'Menu principal' })
          }
          await navigation
            .getByRole('link', { name: 'Financeiro', exact: true })
            .waitFor()
          await navigation
            .getByRole('link', { name: 'Fiscal', exact: true })
            .waitFor()
          if (width <= 900) {
            await page.keyboard.press('Escape')
            await page.getByRole('button', { name: 'Abrir menu' }).waitFor()
          }
        }
        if (name === 'finance')
          await page
            .getByText('Consultoria de conteúdo', { exact: true })
            .waitFor()
        if (name === 'login-register') {
          await page.getByRole('button', { name: 'Criar conta' }).click()
          await page.getByRole('heading', { name: 'Criar conta' }).waitFor()
        }
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

          await page
            .getByRole('button', { name: /Uma nova forma de criar/ })
            .click()
          const postDialog = page.getByRole('dialog')
          assert.equal(await postDialog.getByRole('article').count(), 2)
          const postPositions = await postDialog
            .getByRole('article')
            .evaluateAll((cards) =>
              cards.map((card) => card.getBoundingClientRect().top),
            )
          assert.ok(
            postPositions[1] > postPositions[0],
            'posts do mesmo dia devem aparecer um abaixo do outro em ' + width,
          )
          const dayListMetrics = await postDialog
            .locator('[class*="_dayPosts_"]')
            .evaluate((list) => ({
              clientHeight: list.clientHeight,
              scrollHeight: list.scrollHeight,
            }))
          assert.ok(
            dayListMetrics.scrollHeight > dayListMetrics.clientHeight,
            'lista de posts da data deve rolar em ' + width,
          )
          const activePost = postDialog.locator('[data-draft-id="draft-1"]')
          const firstPost = postDialog.getByRole('article').first()
          await activePost
            .getByRole('textbox', { name: 'Legenda', exact: true })
            .waitFor()
          await firstPost.getByText('Prévia', { exact: true }).waitFor()
          const previewBox = await firstPost
            .getByLabel('Prévia do post')
            .boundingBox()
          assert.ok(
            previewBox && previewBox.y >= 0 && previewBox.y < 900,
            'prévia do post visível ao abrir em ' + width,
          )
          await page.screenshot({
            path: output + '/calendar-post-detail-open-' + width + '.png',
            fullPage: false,
          })
          const tomorrow = new Date()
          tomorrow.setDate(tomorrow.getDate() + 1)
          const tomorrowKey = [
            tomorrow.getFullYear(),
            String(tomorrow.getMonth() + 1).padStart(2, '0'),
            String(tomorrow.getDate()).padStart(2, '0'),
          ].join('-')
          await activePost.locator('input[type="date"]').fill(tomorrowKey)
          await activePost.locator('input[type="time"]').fill('16:45')
          await activePost
            .getByRole('button', { name: 'Salvar como agendado' })
            .click()
          await activePost.locator('[data-status="scheduled"]').waitFor()
          assert.equal(mock.updatedDraft.date, tomorrowKey)
          assert.equal(mock.updatedDraft.time, '16:45')
          assert.equal(mock.updatedDraft.status, 'scheduled')
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            'detalhes do post: overflow em ' + width,
          )
          await page.screenshot({
            path: output + '/calendar-post-detail-' + width + '.png',
            fullPage: false,
          })
          await postDialog
            .getByRole('button', { name: 'Fechar detalhes do dia' })
            .click()
        }
        if (name === 'chat') {
          const briefLayout = await page
            .locator('[class*="_brief_"]')
            .first()
            .evaluate((brief) => {
              const boxes = [...brief.children].map((child) => {
                const { left, top, right, bottom, width, height } =
                  child.getBoundingClientRect()
                return { left, top, right, bottom, width, height }
              })
              const collisions = []
              for (let i = 0; i < boxes.length; i++) {
                if (boxes[i].width < 40) collisions.push(`item ${i} comprimido`)
                for (let j = i + 1; j < boxes.length; j++) {
                  const horizontal =
                    Math.min(boxes[i].right, boxes[j].right) -
                    Math.max(boxes[i].left, boxes[j].left)
                  const vertical =
                    Math.min(boxes[i].bottom, boxes[j].bottom) -
                    Math.max(boxes[i].top, boxes[j].top)
                  if (horizontal > 2 && vertical > 2)
                    collisions.push(`itens ${i} e ${j} sobrepostos`)
                }
              }
              return collisions
            })
          assert.equal(
            await page
              .locator('[class*="_brief_"]')
              .first()
              .locator(':scope > *')
              .count(),
            5,
          )
          assert.deepEqual(briefLayout, [], `configuração da IA em ${width}px`)
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
        if (name === 'billing' || name === 'billing-empty')
          await page.getByRole('heading', { name: 'Faturas' }).waitFor()
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
        if (name === 'billing-empty') {
          await page
            .getByRole('button', { name: 'Escolher Profissional' })
            .click()
          await page.getByRole('button', { name: 'Ver resumo' }).click()
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            'resumo de assinatura: overflow em ' + width,
          )
          await page.screenshot({
            path: output + '/billing-checkout-' + width + '.png',
            fullPage: true,
          })
        }
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
          if (width === 390) {
            await page
              .getByRole('button', { name: 'Conversa', exact: true })
              .click()
            await page.getByRole('button', { name: 'Nova criação' }).click()
            await page
              .getByRole('button', { name: 'Descartar e começar' })
              .click()
            await page.locator('[class*="_platformPicker_"] summary').click()
            await page.getByRole('checkbox', { name: 'Facebook' }).check()
            await page.getByRole('checkbox', { name: 'LinkedIn' }).check()
            await page.screenshot({
              path: output + '/chat-platforms-' + width + '.png',
              fullPage: true,
            })
            await page.locator('[class*="_platformPicker_"] summary').click()
            await page.getByLabel('Pedido para a IA').fill('Uma dica da marca')
            await page.getByRole('button', { name: 'Gerar 3 posts' }).click()
            await page
              .getByRole('heading', { name: 'Revise seus rascunhos' })
              .waitFor()
            await page
              .getByRole('button', { name: 'Revisar rascunho de LinkedIn' })
              .click()
            await page.screenshot({
              path: output + '/chat-multi-' + width + '.png',
              fullPage: true,
            })
            await page
              .getByRole('button', { name: 'Adicionar 3 à agenda' })
              .click()
            await page.getByText(/3 rascunhos adicionados à agenda/).waitFor()
            assert.deepEqual(
              mock.persistedBatch.map((draft) => draft.platform),
              ['Instagram', 'Facebook', 'LinkedIn'],
            )
            assert.equal(
              new Set(mock.persistedBatch.map((draft) => draft.id)).size,
              3,
            )
          }
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
