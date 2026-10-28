// @vitest-environment node
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'
import { AuthService } from '../auth/authService.js'
import {
  InMemoryAuthProvider,
  TEST_ACCESS_TOKEN,
} from '../../test/InMemoryAuthProvider.js'
import { InMemoryFinancialRepository } from '../../test/InMemoryFinancialRepository.js'
import { InMemoryWorkspaceAccessRepository } from '../tenancy/workspaceRepository.js'
import type { PlatformRole } from '../tenancy/workspaceTypes.js'
import type { AiUsageRepository } from './aiUsageRepository.js'
import { AiUsageService } from './aiUsageService.js'

function testApp(platformRole: PlatformRole | null, months: string[]) {
  const repository: AiUsageRepository = {
    insert: async () => undefined,
    monthlyReport: async (monthStart) => {
      months.push(monthStart)
      return []
    },
  }

  return createApp({
    authService: new AuthService(new InMemoryAuthProvider()),
    financialRepository: new InMemoryFinancialRepository(),
    workspaceAccessRepository: new InMemoryWorkspaceAccessRepository(
      'test-workspace',
      'editor',
      platformRole,
    ),
    aiUsageService: new AiUsageService(repository),
  })
}

describe('acesso administrativo ao uso de IA', () => {
  it('rejeita acesso anônimo e contas sem papel de plataforma', async () => {
    const months: string[] = []
    const app = testApp(null, months)

    const anonymous = await request(app).get(
      '/api/admin/ai-usage/monthly?month=2026-09',
    )
    const regularUser = await request(app)
      .get('/api/admin/ai-usage/monthly?month=2026-09')
      .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)

    expect(anonymous.status).toBe(401)
    expect(regularUser.status).toBe(403)
    expect(months).toEqual([])
  })

  it('permite ao administrador financeiro consultar o mês selecionado', async () => {
    const months: string[] = []
    const app = testApp('finance_admin', months)
    const response = await request(app)
      .get('/api/admin/ai-usage/monthly?month=2026-09')
      .set('Authorization', `Bearer ${TEST_ACCESS_TOKEN}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      month: '2026-09',
      users: [],
    })
    expect(months).toEqual(['2026-09-01'])
  })
})
