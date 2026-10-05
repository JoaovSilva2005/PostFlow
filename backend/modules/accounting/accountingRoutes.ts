import { Router } from 'express'
import { z } from 'zod'
import { buildAccountingReport } from '../../../shared/domain/accounting.js'
import { HttpError } from '../../shared/HttpError.js'
import type { FinancialService } from '../finance/financialService.js'

export function createAccountingRouter(
  service: FinancialService,
  storage: () => 'supabase' | 'demo' | 'test' = () => 'supabase',
) {
  const router = Router()
  router.get('/report', async (request, response) => {
    const period = z
      .string()
      .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
      .safeParse(request.query.period)
    if (!period.success)
      throw new HttpError(400, 'Informe um período válido no formato AAAA-MM.')
    const report = buildAccountingReport(await service.list(null), period.data)
    response.json({ data: { ...report, storage: storage() } })
  })
  return router
}
