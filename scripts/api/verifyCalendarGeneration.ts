import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import request from 'supertest'
import { createApp } from '../../backend/app.js'
import { createSupabaseAdminDataClient } from '../../backend/config/supabaseServer.js'
import { AuthService } from '../../backend/modules/auth/authService.js'
import { InMemoryWorkspaceAccessRepository } from '../../backend/modules/tenancy/workspaceRepository.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../backend/test/InMemoryAuthProvider.js'
import { InMemoryContentQuotaService } from '../../backend/test/InMemoryContentQuotaService.js'
import { ContentService } from '../../backend/modules/content/contentService.js'
import { createCalendarGenerationTask } from '../../src/features/calendar/calendarGeneration.js'
import type { GenerationService } from '../../src/features/content/generationService.js'
import type { PostDraft } from '../../src/domain/models.js'

// PostgreSQL and Storage are always real; auth/plan/quota are test fixtures.
// Opt-in POSTFLOW_VERIFY_REAL_AI=true adds one real text batch and paid image.
const useRealAi = process.env.POSTFLOW_VERIFY_REAL_AI === 'true'
const db = createSupabaseAdminDataClient()
const brandId = randomUUID()
const createdIds: string[] = []
const quota = new InMemoryContentQuotaService()
const app = createApp({
  authService: new AuthService(new InMemoryAuthProvider()),
  workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
    brandId,
    'owner',
  ),
  contentQuotaService: quota,
  contentService: useRealAi
    ? undefined
    : new ContentService({
        async generate() {
          throw new Error('Use batch')
        },
        async generateBatch(input) {
          return input.items.map((item) => ({
            key: item.key,
            title: 'Organize sua semana',
            caption: `Planeje seu conteúdo para ${item.platform}. Salve esta dica.`,
            hashtags: ['#Planejamento'],
            visualText: 'Calendário organizado',
            formatData: {
              kind: 'static',
              headline: 'Organize sua semana',
              visualDirection: 'Uma agenda em uma mesa de trabalho.',
            },
          }))
        },
        async generateImage() {
          return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII='
        },
      }),
})
const auth = (test: request.Test) =>
  test.set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)
const report: Record<string, unknown> = {
  realAi: useRealAi,
  realDatabase: true,
  realStorage: true,
  authAndQuotaFixtures: true,
}
const originalFetch = globalThis.fetch
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args)
  if (String(args[0]).startsWith('https://api.openai.com/') && !response.ok) {
    const body = await response
      .clone()
      .json()
      .catch(() => ({}))
    report.providerError = {
      status: response.status,
      code: body.error?.code,
      type: body.error?.type,
      param: body.error?.param,
    }
  }
  return response
}
const brand = {
  name: 'QA agenda',
  segment: 'Planejamento de conteúdo',
  toneOfVoice: 'Profissional e direto',
  primaryColor: '#4F46E5',
}
const workspacePath = `/api/workspaces/${brandId}`
let brandCreated = false
let textCalls = 0
let imageCalls = 0

try {
  const { data: owner, error: ownerError } = await db
    .from('users')
    .select('id')
    .eq(
      'email',
      process.env.POSTFLOW_VERIFY_OWNER_EMAIL || 'joaovsilva3530@gmail.com',
    )
    .single()
  assert.ifError(ownerError)
  const { error } = await db.from('brands').insert({
    id: brandId,
    user_id: owner.id,
    name: brand.name,
    segment: brand.segment,
    tone_of_voice: brand.toneOfVoice,
    primary_color: brand.primaryColor,
  })
  assert.ifError(error)
  brandCreated = true
  const service: GenerationService = {
    mode: 'api',
    async generate() {
      throw new Error('Use batch')
    },
    async generateBatch({ workspaceId: _workspace, ...input }) {
      textCalls++
      const response = await auth(
        request(app).post('/api/content/generate-batch'),
      )
        .set('X-Workspace-Id', brandId)
        .send(input)
      assert.equal(response.status, 200, response.body.error)
      return response.body.data
    },
    async generateImage({ workspaceId: _workspace, ...input }) {
      imageCalls++
      const response = await auth(
        request(app).post('/api/content/generate-image'),
      )
        .set('X-Workspace-Id', brandId)
        .send(input)
      assert.equal(response.status, 200, response.body.error)
      return response.body.data
    },
  }
  const run = createCalendarGenerationTask(
    {
      workspaceId: brandId,
      brand,
      dates: ['2099-12-30'],
      time: '09:00',
      timezone: 'America/Sao_Paulo',
      platforms: ['Instagram', 'Facebook', 'X / Twitter'],
      format: 'static',
      persona: 'Pequenos negócios',
      prompt:
        'Crie uma dica sobre organizar o calendário de conteúdo da semana. Não inclua notícias, preços ou estatísticas. Termine convidando a salvar a dica.',
    },
    service,
  )
  const drafts = await run(new AbortController().signal, () => {})
  assert.equal(drafts.length, 3)
  assert.equal(new Set(drafts.map((draft) => draft.caption)).size, 3)
  assert.equal(new Set(drafts.map((draft) => draft.imageUrl)).size, 1)
  const saved: PostDraft[] = []
  for (const draft of drafts) {
    const response = await auth(
      request(app).post(`${workspacePath}/drafts`),
    ).send(draft)
    assert.equal(response.status, 201, response.body.error)
    createdIds.push(response.body.data.id)
    saved.push(response.body.data)
  }
  const reloaded = await auth(request(app).get(`${workspacePath}/drafts`))
  assert.equal(reloaded.status, 200, reloaded.body.error)
  assert.equal(reloaded.body.data.length, 3)
  const hashes = []
  for (const draft of reloaded.body.data as PostDraft[]) {
    assert.equal(draft.imageAvailable, true)
    assert.ok(draft.imageUrl?.startsWith('https://'))
    const image = await fetch(draft.imageUrl!)
    assert.equal(image.status, 200)
    hashes.push(
      createHash('sha256')
        .update(Buffer.from(await image.arrayBuffer()))
        .digest('hex'),
    )
    const refreshed = await auth(
      request(app).get(`${workspacePath}/drafts/${draft.id}/image-url`),
    )
    assert.equal(refreshed.status, 200)
    assert.ok(refreshed.body.data.imageUrl)
  }
  assert.equal(new Set(hashes).size, 1)
  assert.deepEqual(quota.getUsage(brandId), {
    text: 3,
    image: 1,
    textReserved: 0,
    imageReserved: 0,
  })
  Object.assign(report, {
    status: 'passed',
    textCalls,
    imageCalls,
    saved: saved.length,
    sharedImageBytes: true,
    reload: 'passed',
    signedImageDownload: 'passed',
    signedUrlRefresh: 'passed',
  })
} catch (error) {
  report.status = 'failed'
  report.error = error instanceof Error ? error.message : String(error)
  throw error
} finally {
  for (const id of createdIds) {
    const removed = await auth(
      request(app).delete(`${workspacePath}/drafts/${id}`),
    )
    assert.equal(removed.status, 204)
  }
  if (brandCreated) {
    // Clear only objects under this newly-created UUID, including uploads whose
    // response was lost before its post ID could be recorded.
    const bucket = db.storage.from('post-draft-images')
    const { data: objects, error: listError } = await bucket.list(brandId)
    assert.ifError(listError)
    if (objects?.length) {
      const { error: removeError } = await bucket.remove(
        objects.map((object) => `${brandId}/${object.name}`),
      )
      assert.ifError(removeError)
    }
    const { error } = await db.from('brands').delete().eq('id', brandId)
    assert.ifError(error)
    const { count, error: countError } = await db
      .from('post_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
    assert.ifError(countError)
    assert.equal(count, 0)
    report.cleanup = 'passed'
  }
  mkdirSync('output/calendar-generation', { recursive: true })
  writeFileSync(
    `output/calendar-generation/${useRealAi ? 'real-ai' : 'database-storage'}-integration.json`,
    JSON.stringify(report, null, 2),
  )
  globalThis.fetch = originalFetch
  console.log(JSON.stringify(report))
}
