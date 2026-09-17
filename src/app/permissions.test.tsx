import { screen } from '@testing-library/react'
import { authenticateDemo, renderApp } from '../test/testUtils'
import { createTestAuthGateway } from '../test/testAuthGateway'

const clientSession = {
  user: {
    id: 'client-user',
    email: 'cliente@postflow.com',
    displayName: 'Cliente PostFlow',
  },
  workspace: { id: 'brand-client', role: 'owner' as const },
  platformRole: null,
}

describe('limites de autorização da interface', () => {
  it('nega acesso direto do cliente ao backoffice', async () => {
    authenticateDemo()
    renderApp('/admin/plans', undefined, createTestAuthGateway(clientSession))

    expect(
      await screen.findByRole('heading', { name: 'Acesso não autorizado' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Erro 403')).toBeInTheDocument()
  })

  it('não mostra Financeiro, Fiscal ou custos no menu do cliente', async () => {
    authenticateDemo()
    renderApp('/brand', undefined, createTestAuthGateway(clientSession))

    expect(
      await screen.findByRole('link', { name: 'Assinatura e cobrança' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Financeiro' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Fiscal' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Planos e custos' })).toBeNull()
  })

  it('permite que suporte abra a administração sem conceder role de workspace', async () => {
    authenticateDemo()
    const supportSession = {
      ...clientSession,
      workspace: null,
      platformRole: 'support' as const,
    }
    renderApp('/admin/plans', undefined, createTestAuthGateway(supportSession))

    expect(
      await screen.findByRole('heading', { name: 'Planos e custos' }),
    ).toBeInTheDocument()
  })
})
