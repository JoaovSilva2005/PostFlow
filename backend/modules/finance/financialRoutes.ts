import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../../shared/HttpError.js'
import type { FinancialService } from './financialService.js'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.string().trim().min(2, 'Informe uma categoria válida.'),
  description: z.string().trim().min(3, 'Informe uma descrição válida.'),
  amount: z.number().positive('O valor deve ser maior que zero.'),
  dueDate: z.iso.date('Informe uma data válida no formato AAAA-MM-DD.'),
  status: z.enum(['pending', 'paid']).default('pending'),
})

const updateTransactionSchema = transactionSchema
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    'Informe pelo menos um campo para atualizar.',
  )

const statusSchema = z.object({
  status: z.enum(['pending', 'paid']),
})

const idSchema = z.uuid('Informe um identificador válido.')

function validate<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)

  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Dados inválidos.'
    throw new HttpError(400, message)
  }

  return result.data
}

const allowWrite: RequestHandler = (_request, _response, next) => next()

export function createFinancialRouter(
  service: FinancialService,
  authorizeWrite: RequestHandler = allowWrite,
) {
  const router = Router()

  router.get('/transactions', async (_request, response) => {
    response.json({ data: await service.list() })
  })

  router.get('/summary', async (_request, response) => {
    response.json({ data: await service.summary() })
  })

  router.post('/transactions', authorizeWrite, async (request, response) => {
    const input = validate(transactionSchema, request.body)
    response.status(201).json({ data: await service.create(input) })
  })

  router.patch(
    '/transactions/:id',
    authorizeWrite,
    async (request, response) => {
      const input = validate(updateTransactionSchema, request.body)
      const id = validate(idSchema, request.params.id)
      response.json({ data: await service.update(id, input) })
    },
  )

  router.patch(
    '/transactions/:id/status',
    authorizeWrite,
    async (request, response) => {
      const { status } = validate(statusSchema, request.body)
      const id = validate(idSchema, request.params.id)
      response.json({
        data: await service.updateStatus(id, status),
      })
    },
  )

  router.delete(
    '/transactions/:id',
    authorizeWrite,
    async (request, response) => {
      const id = validate(idSchema, request.params.id)
      await service.delete(id)
      response.status(204).send()
    },
  )

  return router
}
