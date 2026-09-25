import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { createTestAuthGateway } from '../../test/testAuthGateway'
import { createTestRepository } from '../../test/testRepository'
import { billingApi } from './billingApi'

vi.mock('./billingApi', () => ({
  billingApi: {
    plans: vi.fn(),
    overview: vi.fn(),
    invoices: vi.fn(),
    subscribe: vi.fn(),
    payInvoice: vi.fn(),
  },
}))

describe('BillingPage', () => {
  beforeEach(() => {
    vi.mocked(billingApi.plans).mockResolvedValue([
      {
        id: 'professional',
        code: 'professional',
        name: 'Profissional',
        price: 79.9,
        limits: { text: 100, image: 30 },
      },
    ])
    vi.mocked(billingApi.overview).mockResolvedValue({
      workspaceId: 'brand-1',
      demoMode: true,
      plan: {
        id: 'professional',
        code: 'professional',
        name: 'Profissional',
        price: 79.9,
        limits: { text: 100, image: 30 },
      },
      subscription: {
        id: 'subscription-1',
        status: 'active',
        currentPeriodStart: '2026-09-01',
        currentPeriodEnd: '2026-09-30',
      },
      usage: {
        period: '2026-09',
        textUsed: 18,
        imageUsed: 4,
        textReserved: 2,
        imageReserved: 1,
      },
    })
    vi.mocked(billingApi.invoices).mockResolvedValue([
      {
        id: 'invoice-1',
        number: 'PF-2026-0001',
        amount: 79.9,
        status: 'paid',
        dueDate: '2026-09-10',
        paidAt: '2026-09-08T12:00:00Z',
        receipt: {
          reference: 'PF-REC-0001',
          documentNumber: 'SIM-20260908-0001',
          verificationCode: 'ABC123SIMULADO',
          environment: 'simulation',
          issuer: {
            legalName: 'PostFlow Tecnologia Ltda. — emissor simulado',
            document: '00.000.000/0001-00',
            municipalRegistration: '00000000',
            city: 'Curitiba/PR',
          },
          recipient: {
            name: 'Aurora Conteúdo',
            document: 'Não informado — simulação acadêmica',
            email: 'cliente@postflow.test',
          },
          service: {
            code: '01.03',
            description:
              'Licenciamento mensal de plataforma SaaS para planejamento e geração assistida de conteúdo digital.',
            municipality: 'Curitiba/PR',
          },
          taxRate: 6,
          taxAmount: 4.79,
          netAmount: 75.11,
          issuedAt: '2026-09-08T12:00:00Z',
          legalValidity: 'academic_only',
        },
      },
    ])
  })

  it('mostra apenas plano, consumo, faturas e comprovante do workspace atual', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/billing')

    expect(await screen.findByText('Profissional')).toBeInTheDocument()
    expect(billingApi.overview).toHaveBeenCalledWith(
      'brand-1',
      expect.any(AbortSignal),
    )
    expect(screen.getByText('20 de 100')).toBeInTheDocument()
    expect(screen.getByText('18 consumidos; 2 em andamento')).toBeInTheDocument()
    expect(screen.getByText('5 de 30')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver nota simulada' }))

    const receipt = screen.getByRole('region', {
      name: 'Nota Fiscal de Serviço eletrônica simulada',
    })
    expect(
      within(receipt).getByText(/NFS-e sem validade jurídica/),
    ).toBeInTheDocument()
    expect(within(receipt).getByText('Aurora Conteúdo')).toBeInTheDocument()
    expect(within(receipt).getByText('ABC123SIMULADO')).toBeInTheDocument()
    expect(within(receipt).getByText('R$ 4,79')).toBeInTheDocument()
  })

  it('apresenta o plano Profissional e confirma a assinatura sem coletar pagamento', async () => {
    vi.mocked(billingApi.overview).mockResolvedValueOnce({
      workspaceId: 'brand-1',
      demoMode: true,
      plan: null,
      subscription: null,
      usage: {
        period: '2026-09',
        textUsed: 0,
        imageUsed: 0,
        textReserved: 0,
        imageReserved: 0,
      },
    })
    vi.mocked(billingApi.subscribe).mockResolvedValue({
      id: 'invoice-2',
      number: 'PF-2026-0002',
      amount: 79.9,
      status: 'pending',
      dueDate: '2026-09-17',
      paidAt: null,
      receipt: null,
    })
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/billing')

    expect(await screen.findByText('PostFlow Profissional')).toBeInTheDocument()
    expect(screen.getByText('100 textos')).toBeInTheDocument()
    expect(screen.getByText('30 imagens')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Escolher Profissional' }),
    )
    await user.click(screen.getByRole('button', { name: 'Ver resumo' }))
    expect(
      screen.getByText(/Simulação acadêmica: ao confirmar/),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar assinatura demonstrativa',
      }),
    )

    expect(
      await screen.findByText('Fatura demonstrativa emitida'),
    ).toBeInTheDocument()
    expect(billingApi.subscribe).toHaveBeenCalledWith(
      'brand-1',
      'professional',
      expect.any(String),
    )
    expect(
      screen.queryByLabelText(/cartão|cvv|dados financeiros/i),
    ).not.toBeInTheDocument()
  })

  it('registra o pagamento de uma fatura pendente como demonstração', async () => {
    const pendingInvoice = {
      id: 'invoice-pending',
      number: 'PF-2026-0003',
      amount: 79.9,
      status: 'pending' as const,
      dueDate: '2026-09-20',
      paidAt: null,
      receipt: null,
    }
    const paidInvoice = {
      id: 'invoice-pending',
      number: 'PF-2026-0003',
      amount: 79.9,
      status: 'paid' as const,
      dueDate: '2026-09-20',
      paidAt: '2026-09-17T12:00:00Z',
      receipt: {
        reference: 'PF-REC-0003',
        documentNumber: 'SIM-20260917-0003',
        verificationCode: 'PAYMENTSIMULATED',
        environment: 'simulation' as const,
        issuer: {
          legalName: 'PostFlow Tecnologia Ltda. — emissor simulado',
          document: '00.000.000/0001-00',
          municipalRegistration: '00000000',
          city: 'Curitiba/PR',
        },
        recipient: {
          name: 'Aurora Conteúdo',
          document: 'Não informado — simulação acadêmica',
          email: 'cliente@postflow.test',
        },
        service: {
          code: '01.03',
          description: 'Licenciamento mensal de plataforma SaaS.',
          municipality: 'Curitiba/PR',
        },
        taxRate: 6,
        taxAmount: 4.79,
        netAmount: 75.11,
        issuedAt: '2026-09-17T12:00:00Z',
        legalValidity: 'academic_only' as const,
      },
    }
    vi.mocked(billingApi.invoices)
      .mockResolvedValueOnce([pendingInvoice])
      .mockResolvedValue([paidInvoice])
    vi.mocked(billingApi.payInvoice).mockResolvedValue(paidInvoice)
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/billing')

    await user.click(
      await screen.findByRole('button', { name: 'Pagar em demonstração' }),
    )

    expect(billingApi.payInvoice).toHaveBeenCalledWith(
      'brand-1',
      'invoice-pending',
      expect.any(String),
    )
    expect(await screen.findByText('Paga')).toBeInTheDocument()
    expect(
      screen.getByRole('region', {
        name: 'Nota Fiscal de Serviço eletrônica simulada',
      }),
    ).toBeInTheDocument()
  })

  it('mantém editor e viewer em modo somente leitura', async () => {
    vi.mocked(billingApi.overview).mockResolvedValueOnce({
      workspaceId: 'brand-1',
      demoMode: true,
      plan: null,
      subscription: null,
      usage: {
        period: '2026-09',
        textUsed: 0,
        imageUsed: 0,
        textReserved: 0,
        imageReserved: 0,
      },
    })
    vi.mocked(billingApi.invoices).mockResolvedValueOnce([
      {
        id: 'invoice-pending',
        number: 'PF-2026-0004',
        amount: 79.9,
        status: 'pending',
        dueDate: '2026-09-20',
        paidAt: null,
        receipt: null,
      },
    ])
    authenticateDemo()
    const authGateway = createTestAuthGateway({
      user: {
        id: 'viewer-1',
        email: 'viewer@postflow.com',
        displayName: 'Viewer PostFlow',
      },
      workspace: { id: 'brand-1', role: 'viewer' },
      platformRole: null,
      billingStatus: 'none',
    })
    renderApp('/billing', createTestRepository(), authGateway)

    expect(
      await screen.findByText(/Somente owner ou admin pode contratar/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Escolher Profissional/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Pagar em demonstração' }),
    ).not.toBeInTheDocument()
  })

  it('não inventa preço quando a API não possui plano disponível', async () => {
    vi.mocked(billingApi.plans).mockResolvedValueOnce([])
    vi.mocked(billingApi.overview).mockResolvedValueOnce({
      workspaceId: 'brand-1',
      demoMode: true,
      plan: null,
      subscription: null,
      usage: {
        period: '2026-09',
        textUsed: 0,
        imageUsed: 0,
        textReserved: 0,
        imageReserved: 0,
      },
    })
    authenticateDemo()
    renderApp('/billing')

    expect(
      await screen.findByText(/Nenhum plano está disponível/),
    ).toBeInTheDocument()
    expect(screen.queryByText('PostFlow Profissional')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Escolher Profissional/ }),
    ).not.toBeInTheDocument()
  })
})
