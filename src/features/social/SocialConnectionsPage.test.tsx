import { act, render, screen, waitFor, within } from '@testing-library/react'
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
import { SOCIAL_PLATFORMS } from '../../../shared/domain/socialPlatforms'
import { SOCIAL_PROVIDERS } from '../../../shared/domain/socialPublishing'
import { integrationCatalog } from './integrationCatalog'

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
  demoMode: false,
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
      simulated: false,
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
    const networkPanel = screen.getByRole('region', {
      name: 'Disponibilidade das redes',
    })
    expect(within(networkPanel).getAllByRole('article')).toHaveLength(4)
    expect(integrationCatalog.map((item) => item.provider).sort()).toEqual(
      [...SOCIAL_PROVIDERS].sort(),
    )
    for (const item of integrationCatalog) {
      expect(SOCIAL_PLATFORMS).toContain(item.name)
      expect(
        within(networkPanel).getByRole('heading', { name: item.name }),
      ).toBeInTheDocument()
    }
    for (const name of [
      'X / Twitter',
      'Canva',
      'Threads',
      'Pinterest',
      'YouTube',
      'WordPress',
    ]) {
      expect(
        within(networkPanel).queryByRole('heading', { name }),
      ).not.toBeInTheDocument()
    }
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
      screen.queryByRole('button', {
        name: /Editar acesso|Reconectar|Desconectar/,
      }),
    ).not.toBeInTheDocument()
  })
  describe('modo demonstração', () => {
    const demoNotice =
      'Modo demonstração: as conexões e publicações são simuladas e nada é enviado às redes sociais.'

    it('demoMode true mostra o aviso exato', async () => {
      vi.mocked(socialApi.overview).mockResolvedValue({
        ...overview,
        demoMode: true,
      })
      renderConnections()
      expect(await screen.findByText(demoNotice)).toBeInTheDocument()
    })

    it('demoMode false não mostra o aviso', async () => {
      renderConnections()
      await screen.findByText('Na fila')
      expect(screen.queryByText(demoNotice)).not.toBeInTheDocument()
    })

    it('publicação published com simulated mostra "Publicado (simulado)"', async () => {
      vi.mocked(socialApi.overview).mockResolvedValue({
        ...overview,
        publications: [
          {
            ...overview.publications[0],
            status: 'published',
            simulated: true,
            remotePostId: 'demo-1',
          },
        ],
      })
      renderConnections()
      expect(
        await screen.findByText('Publicado (simulado)'),
      ).toBeInTheDocument()
    })

    it('published sem simulated mostra "Publicado"', async () => {
      vi.mocked(socialApi.overview).mockResolvedValue({
        ...overview,
        publications: [
          {
            ...overview.publications[0],
            status: 'published',
            simulated: false,
          },
        ],
      })
      renderConnections()
      expect(await screen.findByText('Publicado')).toBeInTheDocument()
      expect(screen.queryByText('Publicado (simulado)')).not.toBeInTheDocument()
    })

    it('conexão demo mostra o selo "Demonstração"', async () => {
      vi.mocked(socialApi.overview).mockResolvedValue({
        ...overview,
        demoMode: true,
        connections: [
          {
            ...overview.connections[0],
            status: 'connected',
            externalAccountId: 'demo-facebook',
            displayName: 'Facebook — conta de demonstração',
            accountType: 'demo',
          },
        ],
      })
      renderConnections()
      expect(await screen.findByText('Demonstração')).toBeInTheDocument()
    })

    describe('autorização de demonstração', () => {
      const assign = vi.fn()
      const demoOverview: SocialOverview = {
        ...overview,
        demoMode: true,
        providers: overview.providers.map((provider) => ({
          ...provider,
          configured: true,
        })),
        connections: [],
        pending: [],
        publications: [],
      }
      const origin = window.location.origin

      async function clickConnect(provider: 'Instagram' | 'Facebook') {
        const user = userEvent.setup()
        renderConnections()
        await screen.findByText(
          'Modo demonstração: as conexões e publicações são simuladas e nada é enviado às redes sociais.',
        )
        const card = screen
          .getByRole('heading', { name: provider })
          .closest('article') as HTMLElement
        await waitFor(() =>
          expect(
            within(card).getByRole('button', { name: 'Conectar conta' }),
          ).toBeEnabled(),
        )
        await user.click(
          within(card).getByRole('button', { name: 'Conectar conta' }),
        )
      }

      beforeEach(() => {
        assign.mockReset()
        vi.stubGlobal('location', { origin, assign })
      })
      afterEach(() => {
        vi.unstubAllGlobals()
      })

      it('demo ligado + callback do próprio domínio navega', async () => {
        vi.mocked(socialApi.overview).mockResolvedValue(demoOverview)
        const url = `${origin}/api/social/oauth/instagram/callback?code=demo-code&state=abc`
        vi.mocked(socialApi.beginOAuth).mockResolvedValue({
          authorizationUrl: url,
        })
        await clickConnect('Instagram')
        await waitFor(() => expect(assign).toHaveBeenCalledWith(url))
      })

      it('demo desligado + mesma URL é rejeitada', async () => {
        vi.mocked(socialApi.overview).mockResolvedValue({
          ...demoOverview,
          demoMode: false,
        })
        vi.mocked(socialApi.beginOAuth).mockResolvedValue({
          authorizationUrl: `${origin}/api/social/oauth/instagram/callback?code=demo-code&state=abc`,
        })
        const user = userEvent.setup()
        renderConnections()
        const card = (
          await screen.findByRole('heading', { name: 'Instagram' })
        ).closest('article') as HTMLElement
        await waitFor(() =>
          expect(
            within(card).getByRole('button', { name: 'Conectar conta' }),
          ).toBeEnabled(),
        )
        await user.click(
          within(card).getByRole('button', { name: 'Conectar conta' }),
        )
        expect(
          await screen.findByText(/destino de autorização inválido/),
        ).toBeInTheDocument()
        expect(assign).not.toHaveBeenCalled()
      })

      it.each([
        ['outro caminho', `${origin}/api/social/oauth/instagram/other`],
        [
          'outro provedor',
          `${origin}/api/social/oauth/facebook/callback?code=demo-code`,
        ],
        [
          'outra origem',
          'https://evil.example/api/social/oauth/instagram/callback',
        ],
      ])('demo ligado + %s é rejeitado', async (_name, url) => {
        vi.mocked(socialApi.overview).mockResolvedValue(demoOverview)
        vi.mocked(socialApi.beginOAuth).mockResolvedValue({
          authorizationUrl: url,
        })
        await clickConnect('Instagram')
        expect(
          await screen.findByText(/destino de autorização inválido/),
        ).toBeInTheDocument()
        expect(assign).not.toHaveBeenCalled()
      })
    })
  })

  describe('atualização automática', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })
    const published = {
      ...overview,
      publications: [
        {
          ...overview.publications[0],
          status: 'published' as const,
          simulated: true,
        },
      ],
    }

    it('atualiza a cada 15 s enquanto há publicação pendente e para ao concluir', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(socialApi.overview)
        .mockResolvedValueOnce(overview)
        .mockResolvedValue(published)
      renderConnections()
      expect(await screen.findByText('Na fila')).toBeInTheDocument()
      expect(socialApi.overview).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14_000)
      })
      expect(socialApi.overview).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(
        await screen.findByText('Publicado (simulado)'),
      ).toBeInTheDocument()
      expect(socialApi.overview).toHaveBeenCalledTimes(2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(socialApi.overview).toHaveBeenCalledTimes(2)
    })

    it('não atualiza com a aba oculta e limpa o intervalo ao desmontar', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const visibility = vi
        .spyOn(document, 'visibilityState', 'get')
        .mockReturnValue('hidden')
      const { unmount } = renderConnections()
      expect(await screen.findByText('Na fila')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(45_000)
      })
      expect(socialApi.overview).toHaveBeenCalledTimes(1)
      visibility.mockReturnValue('visible')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })
      expect(socialApi.overview).toHaveBeenCalledTimes(2)
      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(socialApi.overview).toHaveBeenCalledTimes(2)
    })
  })
})
