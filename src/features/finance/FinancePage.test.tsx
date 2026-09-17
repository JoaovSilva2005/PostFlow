import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { financialApi } from './financialApi'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { createTestAuthGateway } from '../../test/testAuthGateway'

vi.mock('./financialApi', () => ({
  financialApi: {
    health: vi.fn(),
    list: vi.fn(),
    summary: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
  },
}))

const transaction = {
  id: 'transaction-1',
  brandId: 'brand-1',
  type: 'income' as const,
  category: 'Assinaturas',
  description: 'Plano mensal',
  amount: 3500,
  dueDate: '2026-09-15',
  status: 'paid' as const,
  paidAt: '2026-09-15T12:00:00.000Z',
  createdAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-15T12:00:00.000Z',
}

const summary = {
  paidIncome: 3500,
  paidExpenses: 800,
  balance: 2700,
  pendingIncome: 1200,
  pendingExpenses: 450,
  pendingCount: 2,
}

describe('FinancePage', () => {
  beforeEach(() => {
    vi.mocked(financialApi.health).mockResolvedValue({
      status: 'ok',
      service: 'PostFlow API',
      storage: 'supabase',
    })
    vi.mocked(financialApi.list).mockResolvedValue([transaction])
    vi.mocked(financialApi.summary).mockResolvedValue(summary)
    vi.mocked(financialApi.create).mockResolvedValue(transaction)
    vi.mocked(financialApi.update).mockResolvedValue(transaction)
    vi.mocked(financialApi.updateStatus).mockResolvedValue(transaction)
    vi.mocked(financialApi.delete).mockResolvedValue(undefined)
  })

  it('apresenta o resumo calculado e os dados vindos da API', async () => {
    authenticateDemo()
    renderApp('/admin/finance')

    expect(await screen.findByText('R$ 2.700,00')).toBeInTheDocument()
    expect(screen.getByText('Plano mensal')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('envia um novo lançamento para a API', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/admin/finance')
    await screen.findByText('Plano mensal')

    await user.type(screen.getByLabelText('Descrição'), 'Consultoria mensal')
    await user.type(screen.getByLabelText('Categoria'), 'Serviços')
    await user.type(screen.getByLabelText('Valor (R$)'), '1200')
    await user.click(
      screen.getByRole('button', { name: 'Adicionar lançamento' }),
    )

    await waitFor(() => {
      expect(financialApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'income',
          description: 'Consultoria mensal',
          category: 'Serviços',
          amount: 1200,
        }),
      )
    })
  })

  it('não apresenta saldo zero como confirmado quando o carregamento falha', async () => {
    vi.mocked(financialApi.list).mockRejectedValue(
      new Error('Conexão indisponível'),
    )
    authenticateDemo()
    renderApp('/admin/finance')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Conexão indisponível',
    )
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('filtra por descrição e status sem alterar os totais financeiros', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/admin/finance')
    await screen.findByText('Plano mensal')
    await user.type(screen.getByLabelText('Buscar lançamentos'), 'inexistente')
    expect(screen.queryByText('Plano mensal')).not.toBeInTheDocument()
    expect(
      screen.getByText('Nenhum lançamento corresponde aos filtros.'),
    ).toBeInTheDocument()
    expect(screen.getByText('R$ 2.700,00')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Buscar lançamentos'))
    await user.selectOptions(
      screen.getByLabelText('Filtrar por status'),
      'pending',
    )
    expect(screen.queryByText('Plano mensal')).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Filtrar por status'),
      'paid',
    )
    expect(screen.getByText('Plano mensal')).toBeInTheDocument()
  })

  it('mantém suporte em modo somente leitura', async () => {
    authenticateDemo()
    renderApp(
      '/admin/finance',
      undefined,
      createTestAuthGateway({
        user: {
          id: 'support-user',
          email: 'suporte@postflow.com',
          displayName: 'Suporte',
        },
        workspace: null,
        platformRole: 'support',
        billingStatus: 'none',
      }),
    )

    expect(await screen.findByText('Plano mensal')).toBeInTheDocument()
    expect(screen.getByText('Acesso somente leitura')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Adicionar lançamento' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar Plano mensal/ }),
    ).not.toBeInTheDocument()
  })
})
