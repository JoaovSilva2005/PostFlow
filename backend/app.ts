import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import type {} from './types/express.js'
import { environment } from './config/environment.js'
import {
  createSupabaseAuthClient,
  createSupabaseAdminDataClient,
} from './config/supabaseServer.js'
import { requireAuthentication } from './modules/auth/authMiddleware.js'
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
import {
  InMemoryWorkspaceAccessRepository,
  SupabaseWorkspaceAccessRepository,
} from './modules/tenancy/workspaceRepository.js'
import {
  requireActiveSubscription,
  requireWorkspaceContext,
  requireWorkspaceRole,
} from './modules/tenancy/authorizationMiddleware.js'
import { requirePlatformRole } from './modules/tenancy/authorizationMiddleware.js'
import type { WorkspaceAccessRepository } from './modules/tenancy/workspaceTypes.js'
import { SupabaseBillingRepository } from './modules/billing/billingRepository.js'
import { BillingService } from './modules/billing/billingService.js'
import {
  DemoFiscalProvider,
  DemoPaymentProvider,
  type BillingRepository,
} from './modules/billing/billingTypes.js'
import {
  createAdminBillingRouter,
  createBillingRouter,
} from './modules/billing/billingRoutes.js'
import { createWorkspaceRouter } from './modules/workspace/workspaceRoutes.js'

interface AppOptions {
  authService?: AuthService
  financialRepository?: FinancialTransactionRepository
  contentService?: ContentService
  workspaceAccessRepository?: WorkspaceAccessRepository
  billingRepository?: BillingRepository
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
  const workspaceAccess =
    options.workspaceAccessRepository ??
    (options.financialRepository
      ? new InMemoryWorkspaceAccessRepository()
      : new SupabaseWorkspaceAccessRepository(createSupabaseAdminDataClient()))
  const billingService = new BillingService(
    options.billingRepository ??
      new SupabaseBillingRepository(createSupabaseAdminDataClient()),
    new DemoPaymentProvider(),
    new DemoFiscalProvider(),
  )
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

  app.get('/api/health/ready', async (_request, response) => {
    await financialRepository.checkHealth()
    response.json({
      data: {
        status: 'ready',
        database: 'connected',
      },
    })
  })

  app.use('/api/auth', createAuthRouter(authService, workspaceAccess))
  app.use(
    '/api/content',
    requireAuthentication(authService),
    requireWorkspaceContext(
      workspaceAccess,
      options.financialRepository ? 'test-workspace' : undefined,
    ),
    requireActiveSubscription(workspaceAccess),
    createContentRouter(
      contentService,
      requireWorkspaceRole('owner', 'admin', 'editor'),
    ),
  )
  app.use(
    '/api/admin/finance',
    requireAuthentication(authService),
    requirePlatformRole(
      workspaceAccess,
      'platform_owner',
      'finance_admin',
      'support',
    ),
    createFinancialRouter(
      financialService,
      requirePlatformRole(workspaceAccess, 'platform_owner', 'finance_admin'),
      () => null,
    ),
  )
  app.use(
    '/api/admin/fiscal',
    requireAuthentication(authService),
    requirePlatformRole(
      workspaceAccess,
      'platform_owner',
      'finance_admin',
      'support',
    ),
    createFiscalRouter(
      financialService,
      requirePlatformRole(workspaceAccess, 'platform_owner', 'finance_admin'),
      () => null,
    ),
  )
  // Compatibilidade exclusiva para os testes unitários que injetam o
  // repositório em memória. Em produção, os aliases antigos não existem:
  // Financeiro e Fiscal ficam somente no backoffice `/api/admin/*`.
  if (options.financialRepository) {
    app.use(
      '/api/finance',
      requireAuthentication(authService),
      requireWorkspaceContext(workspaceAccess, 'test-workspace'),
      createFinancialRouter(
        financialService,
        requireWorkspaceRole('owner', 'admin', 'editor'),
      ),
    )
    app.use(
      '/api/fiscal',
      requireAuthentication(authService),
      requireWorkspaceContext(workspaceAccess, 'test-workspace'),
      createFiscalRouter(
        financialService,
        requireWorkspaceRole('owner', 'admin', 'editor'),
      ),
    )
  }
  app.use(
    '/api/workspaces/:workspaceId',
    requireAuthentication(authService),
    requireWorkspaceContext(workspaceAccess),
    createBillingRouter(billingService, requireWorkspaceRole('owner', 'admin')),
    requireActiveSubscription(workspaceAccess),
    createWorkspaceRouter(
      createSupabaseAdminDataClient(),
      requireWorkspaceRole('owner', 'admin', 'editor'),
    ),
  )
  app.use(
    '/api/admin',
    requireAuthentication(authService),
    requirePlatformRole(
      workspaceAccess,
      'platform_owner',
      'finance_admin',
      'support',
    ),
    createAdminBillingRouter(
      billingService,
      requirePlatformRole(workspaceAccess, 'platform_owner', 'finance_admin'),
      requirePlatformRole(workspaceAccess, 'platform_owner'),
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
