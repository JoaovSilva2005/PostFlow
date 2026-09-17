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

function workspaceId(request: Parameters<RequestHandler>[0]) {
  if (!request.workspaceContext)
    throw new HttpError(400, 'Contexto de workspace ausente.')
  return request.workspaceContext.workspaceId
}

type ScopeResolver = (request: Parameters<RequestHandler>[0]) => string | null

export function createFiscalRouter(
  service: FinancialService,
  authorizeWrite: RequestHandler,
  resolveScope: ScopeResolver = workspaceId,
) {
  const router = Router()
  router.get('/report', async (request, response) => {
    const period = parse(
      z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      request.query.period,
    )
    const transactions = (await service.list(resolveScope(request))).filter(
      (item) =>
        item.type === 'income' &&
        (item.sourceType === 'sale_service' ||
          item.sourceType === 'subscription_revenue'),
    )
    response.json({ data: buildFiscalReport(transactions, period) })
  })
  router.get('/receipts/:id', async (request, response) => {
    const id = parse(z.uuid(), request.params.id)
    const sale = (await service.list(resolveScope(request))).find(
      (item) =>
        item.id === id &&
        item.type === 'income' &&
        (item.sourceType === 'sale_service' ||
          item.sourceType === 'subscription_revenue'),
    )
    if (!sale) throw new HttpError(404, 'Venda não encontrada.')
    response.json({ data: toFiscalSale(sale) })
  })
  router.post('/sales', authorizeWrite, async (request, response) => {
    const input = parse(saleSchema, request.body)
    const sale = await service.create(
      {
        ...input,
        type: 'income',
        category: 'Serviços PostFlow',
        sourceType: 'sale_service',
      },
      resolveScope(request),
    )
    response.status(201).json({ data: toFiscalSale(sale) })
  })
  return router
}
