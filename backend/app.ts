import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import { environment } from './config/environment.js'
import {
  createSupabaseAuthClient,
  createSupabaseAdminDataClient,
} from './config/supabaseServer.js'
import {
  requireAuthentication,
  requireRoles,
} from './modules/auth/authMiddleware.js'
import { createAuthRouter } from './modules/auth/authRoutes.js'
import { AuthService } from './modules/auth/authService.js'
import { SupabaseAuthProvider } from './modules/auth/supabaseAuthProvider.js'
import {
  SupabaseFinancialTransactionRepository,
  type FinancialTransactionRepository,
} from './modules/finance/financialRepository.js'
import { createFinancialRouter } from './modules/finance/financialRoutes.js'
import { FinancialService } from './modules/finance/financialService.js'
import {
  createDemoFinancialTransactions,
  MemoryFinancialTransactionRepository,
} from './modules/finance/memoryFinancialRepository.js'
import { ResilientFinancialTransactionRepository } from './modules/finance/resilientFinancialRepository.js'
import { HttpError } from './shared/HttpError.js'
import { createFiscalRouter } from './modules/fiscal/fiscalRoutes.js'
import { createContentRouter } from './modules/content/contentRoutes.js'
import { ContentService } from './modules/content/contentService.js'
import { OpenAiContentProvider } from './modules/content/openAiContentProvider.js'

interface AppOptions {
  authService?: AuthService
  financialRepository?: FinancialTransactionRepository
  contentService?: ContentService
}

export function createApp(options: AppOptions = {}) {
  const app = express()
  const authService =
    options.authService ??
    new AuthService(new SupabaseAuthProvider(createSupabaseAuthClient))
  const financialRepository =
    options.financialRepository ??
    (environment.allowDemoFallback
      ? new ResilientFinancialTransactionRepository(
          new SupabaseFinancialTransactionRepository(
            createSupabaseAdminDataClient(),
          ),
          new MemoryFinancialTransactionRepository(
            createDemoFinancialTransactions(),
          ),
        )
      : new SupabaseFinancialTransactionRepository(
          createSupabaseAdminDataClient(),
        ))
  const financialService = new FinancialService(financialRepository)
  const contentService =
    options.contentService ??
    new ContentService(
      new OpenAiContentProvider(
        environment.openAiApiKey,
        environment.openAiTextModel,
      ),
    )

  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || environment.isAllowedOrigin(origin)) {
          callback(null, true)
          return
        }

        callback(new HttpError(403, 'Origem não autorizada.'))
      },
    }),
  )
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    const storage =
      financialRepository instanceof ResilientFinancialTransactionRepository
        ? financialRepository.getMode()
        : options.financialRepository
          ? 'test'
          : 'supabase'
    response.json({
      data: { status: 'ok', service: 'PostFlow API', storage },
    })
  })

  app.use('/api/auth', createAuthRouter(authService))
  app.use(
    '/api/content',
    requireAuthentication(authService),
    createContentRouter(
      contentService,
      requireRoles(authService, 'owner', 'admin', 'editor'),
    ),
  )
  app.use(
    '/api/fiscal',
    requireAuthentication(authService),
    createFiscalRouter(
      financialService,
      requireRoles(authService, 'owner', 'admin', 'editor'),
    ),
  )
  app.use('/api/finance', requireAuthentication(authService))
  app.use(
    '/api/finance',
    createFinancialRouter(
      financialService,
      requireRoles(authService, 'owner', 'admin', 'editor'),
    ),
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
    const isExpectedError = error instanceof HttpError
    const statusCode = isExpectedError ? error.statusCode : 500
    const message = isExpectedError
      ? error.message
      : 'Erro interno da aplicação.'

    if (!isExpectedError) {
      console.error('Erro não tratado na API:', error)
    }

    response.status(statusCode).json({ error: message })
  }

  app.use(errorHandler)
  return app
}
