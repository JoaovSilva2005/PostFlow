import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { billingApi } from './billingApi'

vi.mock('./billingApi', () => ({
  billingApi: { overview: vi.fn(), invoices: vi.fn() },
}))

describe('BillingPage', () => {
  beforeEach(() => {
    vi.mocked(billingApi.overview).mockResolvedValue({
      workspaceId: 'brand-1',
      demoMode: true,
      plan: {
        id: 'essential',
        name: 'PostFlow Essencial',
        price: 79.9,
        limits: { text: 100, image: 30 },
      },
      subscription: {
        id: 'subscription-1',
        status: 'active',
        currentPeriodStart: '2026-09-01',
        currentPeriodEnd: '2026-09-30',
      },
      usage: { period: '2026-09', textUsed: 18, imageUsed: 4 },
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

    expect(await screen.findByText('PostFlow Essencial')).toBeInTheDocument()
    expect(billingApi.overview).toHaveBeenCalledWith('brand-1', expect.any(AbortSignal))
    expect(screen.getByText('18 de 100')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver comprovante' }))

    const receipt = screen.getByRole('region', { name: 'Comprovante acadêmico' })
    expect(
      within(receipt).getByText(/Documento demonstrativo sem validade fiscal/),
    ).toBeInTheDocument()
    expect(within(receipt).getByText('R$ 4,79')).toBeInTheDocument()
  })
})
