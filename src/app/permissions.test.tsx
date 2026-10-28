import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../test/testUtils'
import { createTestAuthGateway } from '../test/testAuthGateway'
import { createTestRepository } from '../test/testRepository'
import {
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_MESSAGE,
} from '../services/apiClient'

const clientSession = {
  user: {
    id: 'client-user',
    email: 'cliente@postflow.com',
    displayName: 'Cliente PostFlow',
  },
  workspace: { id: 'brand-client', role: 'owner' as const },
  platformRole: null,
  billingStatus: 'active' as const,
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
      billingStatus: 'none' as const,
    }
    renderApp('/admin/plans', undefined, createTestAuthGateway(supportSession))

    expect(
      await screen.findByRole('heading', { name: 'Planos e custos' }),
    ).toBeInTheDocument()
  })

  it('direciona cliente sem plano para cobrança e oculta o produto', async () => {
    authenticateDemo()
    const withoutPlan = {
      ...clientSession,
      billingStatus: 'none' as const,
    }
    renderApp('/brand', undefined, createTestAuthGateway(withoutPlan))

    expect(
      await screen.findByRole('heading', { name: 'Assinatura e cobrança' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Criar com IA' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Agenda' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Minha marca' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Assinatura e cobrança' }),
    ).toBeInTheDocument()
  })

  it('mantém acesso ao produto usando o plano ativo de outra marca acessível', async () => {
    authenticateDemo()
    const workspaceWithoutPlan = {
      ...clientSession,
      billingStatus: 'none' as const,
    }
    const repository = createTestRepository()
    repository.listWorkspaces = async () => [
      {
        id: 'brand-client',
        role: 'owner',
        billingStatus: 'none',
        brand: {
          name: 'Marca de conteúdo',
          segment: 'Marketing',
          toneOfVoice: 'Profissional',
          primaryColor: '#123456',
        },
      },
      {
        id: 'paid-workspace',
        role: 'owner',
        billingStatus: 'active',
        brand: {
          name: 'Workspace com plano',
          segment: 'Marketing',
          toneOfVoice: 'Profissional',
          primaryColor: '#654321',
        },
      },
    ]
    renderApp(
      '/calendar',
      repository,
      createTestAuthGateway(workspaceWithoutPlan),
    )

    expect(
      await screen.findByRole('link', { name: 'Criar com IA' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Agenda de conteúdo' }),
    ).toBeInTheDocument()
  })

  it('encerra a sessão expirada, informa o motivo e volta à tela anterior após login', async () => {
    const user = userEvent.setup()
    authenticateDemo()
    renderApp('/calendar')

    expect(
      await screen.findByRole('heading', { name: 'Agenda de conteúdo' }),
    ).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)))

    expect(
      await screen.findByRole('heading', { name: 'Bem-vindo de volta' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(SESSION_EXPIRED_MESSAGE)

    await user.type(screen.getByLabelText('E-mail'), 'aluno@postflow.com')
    await user.type(screen.getByLabelText('Senha'), '123456')
    await user.click(
      screen.getByRole('button', { name: 'Entrar no PostFlow' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Agenda de conteúdo' }),
    ).toBeInTheDocument()
  })

  it('permite que platform_owner acesse todas as telas mesmo sem plano', async () => {
    authenticateDemo()
    const administrator = {
      ...clientSession,
      platformRole: 'platform_owner' as const,
      billingStatus: 'none' as const,
    }
    renderApp('/brand', undefined, createTestAuthGateway(administrator))

    expect(
      await screen.findByRole('heading', { name: 'Identidade da marca' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Financeiro' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Criar com IA' }),
    ).toBeInTheDocument()
  })

  it('permite preparar o workspace quando a conta ainda não possui membership', async () => {
    const user = userEvent.setup()
    const withoutWorkspace = {
      ...clientSession,
      workspace: null,
      billingStatus: 'none' as const,
    }
    const provisioned = {
      ...withoutWorkspace,
      workspace: { id: 'brand-new', role: 'owner' as const },
    }
    const authGateway = createTestAuthGateway(withoutWorkspace)
    let currentUserCalls = 0
    authGateway.currentUser = async () => {
      currentUserCalls += 1
      return currentUserCalls === 1 ? withoutWorkspace : provisioned
    }

    authenticateDemo()
    renderApp('/brand', undefined, authGateway)

    await user.click(
      await screen.findByRole('button', { name: 'Preparar meu workspace' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Assinatura e cobrança' }),
    ).toBeInTheDocument()
  })
})
