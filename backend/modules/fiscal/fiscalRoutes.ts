import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { buildFiscalReport, toFiscalSale } from '../../../src/domain/fiscal.js'
import { HttpError } from '../../shared/HttpError.js'
import type { FinancialService } from '../finance/financialService.js'

const saleSchema = z
  .object({
    description: z.string().trim().min(3).max(240),
    amount: z
      .number()
      .positive()
      .max(999999999.99)
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
        'Use no máximo duas casas decimais.',
      ),
    dueDate: z.iso.date(),
    status: z.enum(['pending', 'paid']),
  })
  .strict()

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues[0]?.message || 'Dados inválidos.',
    )
  return result.data
}

export function createFiscalRouter(
  service: FinancialService,
  authorizeWrite: RequestHandler,
) {
  const router = Router()
  router.get('/report', async (request, response) => {
    const period = parse(
      z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      request.query.period,
    )
    response.json({ data: buildFiscalReport(await service.list(), period) })
  })
  router.get('/receipts/:id', async (request, response) => {
    const id = parse(z.uuid(), request.params.id)
    const sale = (await service.list()).find(
      (item) => item.id === id && item.type === 'income',
    )
    if (!sale) throw new HttpError(404, 'Venda não encontrada.')
    response.json({ data: toFiscalSale(sale) })
  })
  router.post('/sales', authorizeWrite, async (request, response) => {
    const input = parse(saleSchema, request.body)
    const sale = await service.create({
      ...input,
      type: 'income',
      category: 'Serviços PostFlow',
    })
    response.status(201).json({ data: toFiscalSale(sale) })
  })
  return router
}
