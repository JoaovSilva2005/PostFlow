import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { createSupabaseServerClient } from './config/supabaseServer'
import {
  SupabaseFinancialTransactionRepository,
  type FinancialTransactionRepository,
} from './finance/financialRepository'
import { createFinancialRouter } from './finance/financialRoutes'
import { FinancialService } from './finance/financialService'
import {
  createDemoFinancialTransactions,
  MemoryFinancialTransactionRepository,
} from './finance/memoryFinancialRepository'
import { ResilientFinancialTransactionRepository } from './finance/resilientFinancialRepository'
import { HttpError } from './shared/HttpError'

export function createApp(repository?: FinancialTransactionRepository) {
  const app = express()
  const financialRepository = repository
    ? repository
    : new ResilientFinancialTransactionRepository(
        new SupabaseFinancialTransactionRepository(
          createSupabaseServerClient(),
        ),
        new MemoryFinancialTransactionRepository(
          createDemoFinancialTransactions(),
        ),
      )

  app.use(cors({ origin: true }))
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    const storage =
      financialRepository instanceof ResilientFinancialTransactionRepository
        ? financialRepository.getMode()
        : 'test'
    response.json({
      data: { status: 'ok', service: 'PostFlow API', storage },
    })
  })

  app.use(
    '/api/finance',
    createFinancialRouter(new FinancialService(financialRepository)),
  )

  app.use((_request, response) => {
    response.status(404).json({ error: 'Rota não encontrada.' })
  })

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    const statusCode = error instanceof HttpError ? error.statusCode : 500
    const message =
      error instanceof Error ? error.message : 'Erro interno da aplicação.'

    response.status(statusCode).json({ error: message })
  }

  app.use(errorHandler)
  return app
}
