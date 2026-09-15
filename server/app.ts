import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { createSupabaseServerClient } from './config/supabaseServer'
import {
  SupabaseFinancialTransactionRepository,
  type FinancialTransactionRepository,
} from './finance/financialRepository'
import { createFinancialRouter } from './finance/financialRoutes'
import { FinancialService } from './finance/financialService'
import { HttpError } from './shared/HttpError'

export function createApp(repository?: FinancialTransactionRepository) {
  const app = express()
  const financialRepository =
    repository ??
    new SupabaseFinancialTransactionRepository(createSupabaseServerClient())

  app.use(cors({ origin: true }))
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', service: 'PostFlow API' })
  })

  app.use(
    '/api/finance',
    createFinancialRouter(new FinancialService(financialRepository)),
  )

  app.use((_request, response) => {
    response.status(404).json({ error: 'Rota não encontrada.' })
  })

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message =
      error instanceof Error ? error.message : 'Erro interno da aplicação.'

    response.status(statusCode).json({ error: message })
  }

  app.use(errorHandler)
  return app
}
