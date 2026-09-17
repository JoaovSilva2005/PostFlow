import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { BillingService } from './billingService.js'

const subscribeSchema = z
  .object({ planCode: z.string().trim().min(2).max(64) })
  .strict()
const planSchema = z
  .object({
    code: z.string().trim().min(2).max(64),
    name: z.string().trim().min(2).max(120),
    price: z.number().positive().max(999999.99),
    limits: z
      .object({ text: z.number().int().min(0), image: z.number().int().min(0) })
      .strict(),
  })
  .strict()

function parse<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? 'Dados inválidos.',
    )
  return result.data
}
function workspaceId(request: Parameters<RequestHandler>[0]) {
  if (!request.workspaceContext)
    throw new HttpError(400, 'Contexto de workspace ausente.')
  return request.workspaceContext.workspaceId
}
function idempotencyKey(request: Parameters<RequestHandler>[0]) {
  const value = request.header('idempotency-key')?.trim()
  if (!value || value.length > 128)
    throw new HttpError(400, 'Informe Idempotency-Key válido.')
  return value
}

export function createBillingRouter(
  service: BillingService,
  authorizeWrite: RequestHandler,
) {
  const router = Router({ mergeParams: true })
  router.get('/billing/plans', async (_request, response) =>
    response.json({ data: await service.listPlans() }),
  )
  router.get('/billing', async (request, response) =>
    response.json({ data: await service.getOverview(workspaceId(request)) }),
  )
  router.put('/billing', authorizeWrite, async (request, response) =>
    response.json({
      data: await service.subscribe(
        workspaceId(request),
        parse(subscribeSchema, request.body).planCode,
        idempotencyKey(request),
      ),
    }),
  )
  router.get('/invoices', async (request, response) =>
    response.json({ data: await service.listInvoices(workspaceId(request)) }),
  )
  router.post(
    '/invoices/:invoiceId/pay',
    authorizeWrite,
    async (request, response) => {
      const invoiceId = parse(
        z.uuid('Informe uma fatura válida.'),
        request.params.invoiceId,
      )
      response.json({
        data: await service.payInvoice(
          workspaceId(request),
          invoiceId,
          idempotencyKey(request),
        ),
      })
    },
  )
  return router
}

export function createAdminBillingRouter(
  service: BillingService,
  authorizeWrite: RequestHandler,
  authorizePlanWrite: RequestHandler,
) {
  const router = Router()
  router.get('/finance', async (_request, response) =>
    response.json({ data: await service.adminFinance() }),
  )
  router.get('/fiscal', async (_request, response) =>
    response.json({ data: await service.adminFiscal() }),
  )
  router.get('/plans', async (_request, response) =>
    response.json({ data: await service.listPlans() }),
  )
  router.post(
    '/plans',
    authorizeWrite,
    authorizePlanWrite,
    async (request, response) =>
      response.status(201).json({
        data: await service.createPlan(parse(planSchema, request.body)),
      }),
  )
  return router
}
