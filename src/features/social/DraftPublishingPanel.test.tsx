import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { AppProvider } from '../../app/AppContext'
import type { PostDraft } from '../../domain/models'
import type { SocialOverview } from '../../../shared/domain/socialPublishing'
import { authenticateDemo } from '../../test/testUtils'
import { createTestAuthGateway } from '../../test/testAuthGateway'
import { createTestRepository } from '../../test/testRepository'
import { socialApi } from './socialApi'
import { DraftPublishingPanel } from './DraftPublishingPanel'

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

const draft: PostDraft = {
  id: 'draft-1',
  title: 'Post',
  caption: 'Legenda revisada',
  hashtags: ['#marca'],
  platform: 'TikTok',
  date: '2026-10-14',
  status: 'draft',
  visualText: 'Chamada',
  color: '#fff',
  imageUrl: 'https://cdn.example/image.jpg',
  format: 'static',
}
const connection = {
  id: 'tt1',
  provider: 'tiktok' as const,
  externalAccountId: 'u1',
  displayName: 'Aurora TikTok',
  accountType: 'creator',
  status: 'connected' as const,
  expiresAt: null,
  createdAt: '2026-10-01T00:00:00Z',
}
const sameNetworkConnection = {
  ...connection,
  id: 'tt2',
  externalAccountId: 'u2',
  displayName: 'Aurora TikTok 2',
}
const otherNetworkConnection = {
  ...connection,
  id: 'fb1',
  provider: 'facebook' as const,
  externalAccountId: 'page1',
  displayName: 'Aurora Facebook',
  accountType: 'page',
}
const overview: SocialOverview = {
  demoMode: false,
  providers: [
    {
      id: 'tiktok',
      label: 'TikTok',
      configured: true,
      missingConfiguration: [],
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
  ],
  connections: [connection, sameNetworkConnection, otherNetworkConnection],
  pending: [],
  publications: [],
}

function renderPanel(post: PostDraft = draft, unsaved = false) {
  authenticateDemo()
  return render(
    <MemoryRouter>
      <AppProvider
        authGateway={createTestAuthGateway()}
        repository={createTestRepository()}
      >
        <DraftPublishingPanel draft={post} hasUnsavedChanges={unsaved} />
      </AppProvider>
    </MemoryRouter>,
  )
}

describe('DraftPublishingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(socialApi.overview).mockResolvedValue(overview)
    vi.mocked(socialApi.creatorInfo).mockResolvedValue({
      creatorUsername: '@aurora',
      creatorNickname: 'Aurora',
      privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    })
    vi.mocked(socialApi.publish).mockResolvedValue({
      id: 'pub1',
      draftId: draft.id,
      connectionId: connection.id,
      provider: 'tiktok',
      title: 'Post',
      status: 'queued',
      scheduledAt: '2026-10-12T12:00:00Z',
      remotePostId: null,
      remoteUrl: null,
      error: null,
      attempts: 0,
      simulated: false,
      createdAt: '2026-10-12T12:00:00Z',
    })
  })

  it('exige privacidade escolhida, declaração de IA e consentimento, e deixa o post na fila sem marcá-lo como publicado', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByLabelText('Aurora TikTok'))
    await screen.findByLabelText('Privacidade')
    expect(screen.getByLabelText('Privacidade')).toHaveValue('')
    expect(screen.getByLabelText('Esta mídia foi gerada por IA?')).toHaveValue(
      '',
    )
    await user.selectOptions(
      screen.getByLabelText('Privacidade'),
      'PUBLIC_TO_EVERYONE',
    )
    await user.selectOptions(
      screen.getByLabelText('Esta mídia foi gerada por IA?'),
      'yes',
    )
    await user.click(
      screen.getByLabelText(/Confirmo a publicação desta prévia/),
    )
    await user.click(screen.getByRole('button', { name: 'Publicar agora' }))
    await waitFor(() =>
      expect(socialApi.publish).toHaveBeenCalledWith(
        'brand-1',
        expect.objectContaining({
          consent: true,
          expectedDraft: {
            title: 'Post',
            caption: 'Legenda revisada',
            hashtags: ['#marca'],
            imageUrl: 'https://cdn.example/image.jpg',
          },
          tiktok: expect.objectContaining({
            privacyLevel: 'PUBLIC_TO_EVERYONE',
            isAiGenerated: true,
          }),
        }),
      ),
    )
    expect(
      await screen.findByText(/Acompanhe a confirmação da rede/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Solicitação registrada: queued.'),
    ).toBeInTheDocument()
  })

  it('bloqueia carrossel, reels e edição não salva no publicador estático', async () => {
    const carousel = { ...draft, format: 'carousel' as const }
    const { rerender } = renderPanel(carousel)
    await screen.findByText(/Publicação de imagem estática não é compatível/)
    expect(
      screen.getByRole('button', { name: 'Publicar agora' }),
    ).toBeDisabled()
    const reel = { ...draft, format: 'reels' as const }
    rerender(
      <MemoryRouter>
        <AppProvider
          authGateway={createTestAuthGateway()}
          repository={createTestRepository()}
        >
          <DraftPublishingPanel draft={reel} hasUnsavedChanges />
        </AppProvider>
      </MemoryRouter>,
    )
    expect(
      await screen.findByText(/Salve as alterações do rascunho/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Publicar agora' }),
    ).toBeDisabled()
  })

  it('limita destinos à plataforma do rascunho e permite duas contas da mesma rede', async () => {
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByLabelText('Aurora TikTok')).toBeInTheDocument()
    expect(screen.getByLabelText('Aurora TikTok 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Aurora Facebook')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Aurora TikTok'))
    await user.click(screen.getByLabelText('Aurora TikTok 2'))
    expect(await screen.findAllByLabelText('Privacidade')).toHaveLength(2)
  })

  it('envia horário apenas quando o usuário escolhe agendar', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(await screen.findByLabelText('Aurora TikTok'))
    await user.selectOptions(
      await screen.findByLabelText('Privacidade'),
      'SELF_ONLY',
    )
    await user.selectOptions(
      screen.getByLabelText('Esta mídia foi gerada por IA?'),
      'no',
    )
    await user.click(
      screen.getByLabelText(/Confirmo a publicação desta prévia/),
    )
    expect(screen.getByLabelText(/Agendar \(opcional\)/)).toHaveValue('')
    fireEvent.change(screen.getByLabelText(/Agendar \(opcional\)/), {
      target: { value: '2099-01-02T15:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Agendar publicação' }))
    await waitFor(() =>
      expect(socialApi.publish).toHaveBeenCalledWith(
        'brand-1',
        expect.objectContaining({
          scheduledAt: expect.stringContaining('2099-01-02'),
        }),
      ),
    )
  })
  it('demoMode true mostra aviso curto e acompanhamento "Publicado (simulado)"', async () => {
    const user = userEvent.setup()
    vi.mocked(socialApi.overview).mockResolvedValue({
      ...overview,
      demoMode: true,
    })
    vi.mocked(socialApi.publish).mockResolvedValue({
      id: 'pub-demo',
      draftId: draft.id,
      connectionId: otherNetworkConnection.id,
      provider: 'facebook',
      title: 'Post',
      status: 'published',
      scheduledAt: '2026-10-12T12:00:00Z',
      remotePostId: 'demo-1',
      remoteUrl: null,
      error: null,
      attempts: 1,
      simulated: true,
      createdAt: '2026-10-12T12:00:00Z',
    })
    renderPanel({ ...draft, platform: 'Facebook' })
    expect(
      await screen.findByText(
        'Modo demonstração: nada é enviado às redes sociais.',
      ),
    ).toBeInTheDocument()
    await user.click(await screen.findByLabelText('Aurora Facebook'))
    await user.click(
      screen.getByLabelText(/Confirmo a publicação desta prévia/),
    )
    await user.click(screen.getByRole('button', { name: 'Publicar agora' }))
    expect(
      await screen.findByText(/Publicado \(simulado\)/),
    ).toBeInTheDocument()
  })

  it('demoMode false não mostra o aviso curto', async () => {
    renderPanel()
    await screen.findByLabelText('Aurora TikTok')
    expect(screen.queryByText(/Modo demonstração/)).not.toBeInTheDocument()
  })
})
