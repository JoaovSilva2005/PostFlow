import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { buildFiscalReport, toFiscalSale } from '../../domain/fiscal'
import type { FinancialTransaction } from '../../domain/finance'
import { fiscalApi } from './fiscalApi'

vi.mock('./fiscalApi', async (original) => ({
  ...(await original<typeof import('./fiscalApi')>()),
  fiscalApi: { report: vi.fn(), create: vi.fn() },
}))
const transaction: FinancialTransaction = {
  id: '1',
  brandId: 'b',
  type: 'income',
  category: 'Serviços',
  description: 'Plano do cliente Aurora',
  amount: 79.9,
  dueDate: '2026-09-18',
  status: 'pending',
  paidAt: null,
  createdAt: '2026-09-16',
  updatedAt: '2026-09-16',
}

describe('FiscalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fiscalApi.report).mockResolvedValue(
      buildFiscalReport([transaction], '2026-09'),
    )
    vi.mocked(fiscalApi.create).mockResolvedValue(toFiscalSale(transaction))
    authenticateDemo()
  })
  it('mostra imposto e comprovante acadêmico pendente', async () => {
    const user = userEvent.setup()
    renderApp('/admin/fiscal')
    await screen.findByText(transaction.description)
    await user.click(screen.getByRole('button', { name: /Ver comprovante/ }))
    const receipt = screen.getByRole('region', {
      name: 'Comprovante de venda de serviço',
    })
    expect(
      within(receipt).getByText('Pendente — não comprova pagamento'),
    ).toBeInTheDocument()
    expect(within(receipt).getByText('R$ 4,79')).toBeInTheDocument()
    expect(
      within(receipt).getByText('Documento acadêmico sem validade fiscal.'),
    ).toBeInTheDocument()
  })
  it('registra uma única venda e atualiza relatório sem enviar imposto do cliente', async () => {
    const user = userEvent.setup()
    renderApp('/admin/fiscal')
    await screen.findByText(transaction.description)
    fireEvent.change(screen.getByLabelText('Vencimento da venda'), {
      target: { value: '2026-09-18' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Registrar no financeiro' }),
    )
    await waitFor(() => expect(fiscalApi.create).toHaveBeenCalledTimes(1))
    expect(fiscalApi.create).toHaveBeenCalledWith({
      description: 'PostFlow Essencial',
      amount: 79.9,
      dueDate: '2026-09-18',
      status: 'pending',
    })
    expect(
      await screen.findByText(/Venda registrada no financeiro/),
    ).toBeInTheDocument()
  })
  it('não apresenta totais inventados quando o banco falha', async () => {
    vi.mocked(fiscalApi.report).mockRejectedValue(
      new Error('Banco indisponível'),
    )
    renderApp('/admin/fiscal')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Banco indisponível',
    )
    const summary = screen.getByRole('region', { name: 'Resumo fiscal' })
    expect(within(summary).getAllByText('—')).toHaveLength(5)
  })
  it('não mistura o simulador de custos com o módulo fiscal', async () => {
    renderApp('/admin/fiscal')
    await screen.findByText(transaction.description)
    expect(
      screen.queryByText('Entenda e simule o custo do plano'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Valor bruto (R$)')).toHaveValue(79.9)
  })
})
