import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppProvider } from '../../app/AppContext'
import { authenticateDemo } from '../../test/testUtils'
import { createTestAuthGateway } from '../../test/testAuthGateway'
import { createTestRepository } from '../../test/testRepository'
import { socialApi } from './socialApi'
import { SocialConnectionsPage } from './SocialConnectionsPage'
import type { SocialOverview } from '../../../shared/domain/socialPublishing'

vi.mock('./socialApi', async (original) => ({
  ...(await original<typeof import('./socialApi')>()),
  socialApi: {
    overview: vi.fn(),
    beginOAuth: vi.fn(),
    completeConnection: vi.fn(),
    disconnect: vi.fn(),
    creatorInfo: vi.fn(),
    publish: vi.fn(),
    cancel: vi.fn(),
  },
}))

const overview: SocialOverview = {
  providers: [
    {
      id: 'instagram',
      label: 'Instagram',
      configured: false,
      missingConfiguration: ['App Meta não configurado'],
      formats: ['static'],
      setupUrl: 'https://developers.facebook.com/',
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      configured: false,
      missingConfiguration: ['Auditoria pendente'],
      formats: ['static'],
      setupUrl: 'https://developers.tiktok.com/',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      configured: true,
      missingConfiguration: [],
      formats: ['static'],
      setupUrl: 'https://developers.facebook.com/',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      configured: false,
      missingConfiguration: ['Integração indisponível'],
      formats: ['static'],
      setupUrl: 'https://learn.microsoft.com/linkedin/',
    },
  ],
  connections: [
    {
      id: 'c1',
      provider: 'facebook',
      externalAccountId: 'page-1',
      displayName: 'Página Aurora',
      accountType: 'page',
      status: 'needs_reconnect',
      expiresAt: null,
      createdAt: '2026-10-01T12:00:00Z',
    },
  ],
  pending: [
    {
      id: 'p1',
      provider: 'facebook',
      accounts: [
        {
          externalAccountId: 'page-2',
          displayName: 'Aurora Loja',
          accountType: 'page',
        },
      ],
    },
  ],
  publications: [
    {
      id: 'pub1',
      draftId: 'draft1',
      connectionId: 'c1',
      provider: 'facebook',
      title: 'Campanha',
      status: 'queued',
      scheduledAt: '2026-10-13T12:00:00Z',
      remotePostId: null,
      remoteUrl: null,
      error: null,
      attempts: 0,
      createdAt: '2026-10-12T12:00:00Z',
    },
  ],
}

function renderConnections(
  role: 'owner' | 'viewer' = 'owner',
  platformRole: 'platform_owner' | null = null,
) {
  authenticateDemo()
  return render(
    <MemoryRouter>
      <AppProvider
        authGateway={createTestAuthGateway({
          user: { id: 'u1', email: 'a@b.com', displayName: 'User' },
          workspace: { id: 'workspace-1', role },
          platformRole,
          billingStatus: 'active',
        })}
        repository={createTestRepository()}
      >
        <SocialConnectionsPage />
      </AppProvider>
    </MemoryRouter>,
  )
}

describe('SocialConnectionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(socialApi.overview).mockResolvedValue(overview)
    vi.mocked(socialApi.completeConnection).mockResolvedValue(
      overview.connections[0],
    )
  })

  it('explica configuração pendente, recuperação de autorização e fila sem declarar post como publicado', async () => {
    renderConnections('owner', 'platform_owner')
    expect(
      await screen.findByText('App Meta não configurado'),
    ).toBeInTheDocument()
    expect(screen.getByText('Auditoria pendente')).toBeInTheDocument()
    expect(screen.getByText('Reconexão necessária')).toBeInTheDocument()
    expect(screen.getByText('Na fila')).toBeInTheDocument()
    expect(screen.queryByText('Publicado')).not.toBeInTheDocument()
  })

  it('oculta detalhes internos das credenciais dos clientes e não inicia OAuth', async () => {
    renderConnections()
    const missing = (
      await screen.findAllByText(
        /A integração está pendente de configuração administrativa/,
      )
    )[0]
    const providerCard = missing.closest('article')
    expect(providerCard).not.toBeNull()
    expect(
      within(providerCard as HTMLElement).queryByText(
        'App Meta não configurado',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(providerCard as HTMLElement).getByRole('button', {
        name: 'Configuração pendente',
      }),
    ).toBeDisabled()
    expect(socialApi.beginOAuth).not.toHaveBeenCalled()
  })

  it('associa a conta escolhida sem solicitar senha ou token ao usuário', async () => {
    const user = userEvent.setup()
    renderConnections()
    const pending = await screen.findByRole('region', {
      name: 'Autorizações pendentes',
    })
    await user.click(
      within(pending).getByRole('button', {
        name: /^Conectar conta$/,
      }),
    )
    await waitFor(() =>
      expect(socialApi.completeConnection).toHaveBeenCalledWith('workspace-1', {
        sessionId: 'p1',
        externalAccountId: 'page-2',
      }),
    )
    expect(
      screen.queryByLabelText(/senha|token|chave/i),
    ).not.toBeInTheDocument()
  })

  it('mantém edição de conexões restrita a owner/admin', async () => {
    renderConnections('viewer')
    expect(
      await screen.findByText(/Somente responsáveis e administradores/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Conectar conta$/ }),
    ).not.toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Disponibilidade das redes' }),
      ).queryByRole('button'),
    ).not.toBeInTheDocument()
  })
})
