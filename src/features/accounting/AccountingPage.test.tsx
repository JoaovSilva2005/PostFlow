import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { buildAccountingReport } from '../../../shared/domain/accounting'
import type { FinancialTransaction } from '../../../shared/domain/financial'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { createTestAuthGateway } from '../../test/testAuthGateway'
import { accountingApi } from './accountingApi'

vi.mock('./accountingApi', () => ({ accountingApi: { report: vi.fn() } }))
const sale: FinancialTransaction = {
  id: 'sale',
  brandId: null,
  sourceType: 'sale_service',
  type: 'income',
  category: 'Serviços',
  description: 'Serviço de conteúdo',
  amount: 100,
  dueDate: '2026-10-05',
  status: 'pending',
  paidAt: null,
  createdAt: '',
  updatedAt: '',
}
const expense: FinancialTransaction = {
  ...sale,
  id: 'expense',
  type: 'expense',
  sourceType: 'manual',
  description: 'Hospedagem mensal',
  amount: 50,
}
const report = buildAccountingReport([sale, expense], '2026-10')

describe('AccountingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateDemo()
    vi.mocked(accountingApi.report).mockResolvedValue(report)
  })
  it('mostra DRE, fontes, critério e navegação dos módulos', async () => {
    renderApp('/admin/accounting')
    expect(await screen.findByText('Lucro')).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Demonstrativo do resultado' }),
      ).getByText('R$ 44,00'),
    ).toBeInTheDocument()
    expect(screen.getByText('Hospedagem mensal')).toBeInTheDocument()
    expect(screen.getByText(/inclui pagos e pendentes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir fiscal' })).toHaveAttribute(
      'href',
      '/admin/fiscal',
    )
  })
  it('troca o período e consulta novamente ao sincronizar', async () => {
    const user = userEvent.setup()
    renderApp('/admin/accounting')
    await screen.findByText('Lucro')
    fireEvent.change(screen.getByLabelText('Período contábil'), {
      target: { value: '2026-09' },
    })
    await waitFor(() =>
      expect(accountingApi.report).toHaveBeenLastCalledWith(
        '2026-09',
        expect.any(AbortSignal),
      ),
    )
    await screen.findByText('Lucro')
    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))
    await waitFor(() => expect(accountingApi.report).toHaveBeenCalledTimes(3))
  })
  it('limpa resultado anterior se uma atualização falhar e permite tentar de novo', async () => {
    const user = userEvent.setup()
    renderApp('/admin/accounting')
    await screen.findByText('Lucro')
    vi.mocked(accountingApi.report).mockRejectedValueOnce(
      new Error('Banco indisponível'),
    )
    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Banco indisponível',
    )
    expect(
      within(
        screen.getByRole('region', { name: 'Demonstrativo do resultado' }),
      ).getAllByText('—'),
    ).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Imprimir DRE' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Sincronizar' }))
    expect(await screen.findByText('Lucro')).toBeInTheDocument()
  })
  it('informa prejuízo, mês vazio e entradas excluídas', async () => {
    vi.mocked(accountingApi.report).mockResolvedValue(
      buildAccountingReport(
        [
          sale,
          { ...expense, amount: 150 },
          { ...sale, id: 'capital', sourceType: 'manual', amount: 1000 },
        ],
        '2026-10',
      ),
    )
    renderApp('/admin/accounting')
    expect(await screen.findByText('Prejuízo')).toBeInTheDocument()
    expect(
      screen.getByText(/Receitas manuais fora das vendas/),
    ).toHaveTextContent('R$ 1.000,00')
    vi.mocked(accountingApi.report).mockResolvedValue(
      buildAccountingReport([], '2026-11'),
    )
    fireEvent.change(screen.getByLabelText('Período contábil'), {
      target: { value: '2026-11' },
    })
    expect(
      await screen.findByText('Sem vendas ou despesas neste período.'),
    ).toBeInTheDocument()
  })
  it('nega acesso ao cliente sem role de plataforma antes de consultar a API', async () => {
    renderApp(
      '/admin/accounting',
      undefined,
      createTestAuthGateway({
        user: {
          id: 'client',
          email: 'cliente@example.com',
          displayName: 'Cliente',
        },
        workspace: { id: 'brand', role: 'owner' },
        platformRole: null,
        billingStatus: 'active',
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Acesso não autorizado' }),
    ).toBeInTheDocument()
    expect(accountingApi.report).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Contábil' })).toBeNull()
  })
  it('identifica fallback demonstrativo explicitamente', async () => {
    vi.mocked(accountingApi.report).mockResolvedValue({
      ...report,
      storage: 'demo',
    })
    renderApp('/admin/accounting')
    expect(
      await screen.findByText(/Dados demonstrativos: esta DRE/),
    ).toBeInTheDocument()
  })
  it('descarta resposta antiga quando o usuário muda o período', async () => {
    let finishOld: (data: typeof report) => void = () => {}
    vi.mocked(accountingApi.report).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve
        }),
    )
    renderApp('/admin/accounting')
    await screen.findByRole('heading', { name: 'Contábil · DRE simples' })
    fireEvent.change(screen.getByLabelText('Período contábil'), {
      target: { value: '2026-11' },
    })
    await screen.findByText('Lucro')
    finishOld({
      ...report,
      outcome: 'loss',
      totals: { ...report.totals, result: -999 },
    })
    await waitFor(() => expect(screen.queryByText('Prejuízo')).toBeNull())
    expect(screen.getByText('R$ 44,00')).toBeInTheDocument()
  })
})
