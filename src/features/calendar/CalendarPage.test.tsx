import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { ApiError } from '../../services/apiClient'
import { toDateKey } from './calendarUtils'

function dateInCurrentMonth(day: number) {
  const date = new Date()
  date.setDate(1)
  date.setHours(12, 0, 0, 0)
  date.setDate(
    Math.min(
      day,
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
    ),
  )
  return toDateKey(date)
}

const drafts: PostDraft[] = [
  {
    id: 'draft-1',
    title: 'Café especial',
    caption: 'Legenda original',
    hashtags: ['#cafe'],
    platform: 'Instagram',
    date: dateInCurrentMonth(14),
    status: 'draft',
    visualText: 'Café',
    color: '#4F46E5',
  },
  {
    id: 'draft-2',
    title: 'Segundo post',
    caption: 'Não deve mudar',
    hashtags: ['#marca'],
    platform: 'LinkedIn',
    date: dateInCurrentMonth(20),
    status: 'draft',
    visualText: 'Marca',
    color: '#F97316',
  },
]

describe('CalendarPage', () => {
  it('abre a sidebar de geração e fecha com Escape e backdrop', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: 'Gerar conteúdo' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Configurar geração' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Fechar geração de conteúdo' }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Configurar geração' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gerar conteúdo' }))
    const dialog = screen.getByRole('dialog', { name: 'Configurar geração' })
    await user.click(dialog.parentElement as HTMLElement)
    expect(
      screen.queryByRole('dialog', { name: 'Configurar geração' }),
    ).not.toBeInTheDocument()
  })

  it('configura formato e plataforma, gera conteúdo e salva na agenda', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: 'Gerar conteúdo' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Configurar geração' })
    await user.type(
      screen.getByLabelText('Ideia do conteúdo na agenda'),
      'Lançamento de uma novidade',
    )
    await user.type(
      screen.getByLabelText('Público ou persona (opcional)'),
      'Pessoas que estão conhecendo a marca',
    )
    await user.clear(screen.getByLabelText('Horário de Brasília'))
    await user.type(screen.getByLabelText('Horário de Brasília'), '09:45')
    await user.click(within(dialog).getByRole('button', { name: /^Estático/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Facebook' }))
    await user.click(within(dialog).getByRole('button', { name: 'LinkedIn' }))
    expect(
      within(dialog).getByRole('button', { name: /^Estático/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(dialog).getByRole('button', { name: 'Facebook' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(dialog).getByRole('button', { name: 'LinkedIn' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(dialog).getByLabelText('Próximos 7 dias'))
    expect(
      within(dialog).getByText('7 datas × 3 destinos = 21 rascunhos'),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: 'Gerar 21 rascunhos' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      '21 rascunhos salvos na agenda para revisão. Aprove cada post para agendar a publicação.',
    )
    const created = repository.snapshot().drafts.slice(drafts.length)
    expect(created).toHaveLength(21)
    expect(
      new Set(created.map((draft) => `${draft.date}|${draft.platform}`)).size,
    ).toBe(21)
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'Facebook',
          format: 'static',
          persona: 'Pessoas que estão conhecendo a marca',
          time: '09:45',
          timezone: 'America/Sao_Paulo',
          formatData: expect.objectContaining({ kind: 'static' }),
        }),
        expect.objectContaining({
          platform: 'LinkedIn',
          format: 'static',
          time: '09:45',
        }),
      ]),
    )
  }, 10_000)

  it('permite alternar para lista e mantém o rascunho editável por teclado', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))
    await user.click(await screen.findByRole('button', { name: 'Lista' }))
    expect(screen.getByRole('button', { name: 'Lista' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: /Café especial/ }))
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Café especial/ })).toHaveFocus()
  })

  it('agrupa posts do mesmo dia e navega entre datas com conteúdo', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const groupedDrafts: PostDraft[] = [
      drafts[0],
      {
        ...drafts[0],
        id: 'draft-facebook',
        title: 'Post no Facebook',
        caption: 'Legenda para Facebook',
        platform: 'Facebook',
        time: '17:30',
      },
      drafts[1],
    ]
    renderApp('/calendar', createTestRepository({ drafts: groupedDrafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Instagram' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Facebook' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('2 posts nesta data')).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Próximo dia' }),
    )
    expect(
      within(dialog).getByRole('heading', { name: 'LinkedIn' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('heading', { name: 'Instagram' }),
    ).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Dia anterior' }),
    )
    expect(
      within(dialog).getByRole('heading', { name: 'Instagram' }),
    ).toBeInTheDocument()
  })

  it('move a data imediatamente sem salvar legenda ou horário não confirmados', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const nextDate = dateInCurrentMonth(16)
    await user.clear(screen.getByLabelText('Legenda'))
    await user.type(screen.getByLabelText('Legenda'), 'Rascunho não salvo')
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: nextDate },
    })

    await waitFor(() =>
      expect(repository.snapshot().drafts[0]).toMatchObject({
        caption: 'Legenda original',
        date: nextDate,
      }),
    )
    expect(screen.getByLabelText('Legenda')).toHaveValue('Rascunho não salvo')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Post movido para a nova data na agenda.',
    )

    await user.click(
      screen.getByRole('button', { name: 'Fechar detalhes do dia' }),
    )
    await user.click(screen.getByRole('button', { name: 'Lista' }))
    const movedCard = screen.getByRole('button', { name: /Café especial/ })
    expect(within(movedCard).getByText('16')).toBeInTheDocument()

    await user.click(movedCard)
    fireEvent.change(screen.getByLabelText('Horário'), {
      target: { value: '16:30' },
    })
    await user.clear(screen.getByLabelText('Legenda'))
    await user.type(screen.getByLabelText('Legenda'), 'Legenda revisada')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alterações salvas.',
    )
    expect(repository.snapshot().drafts[0]).toMatchObject({
      caption: 'Legenda revisada',
      date: nextDate,
      time: '16:30',
      status: 'draft',
    })
  })

  it('exibe a imagem gerada do post na prévia', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const draftWithImage = {
      ...drafts[0],
      imageUrl: 'data:image/webp;base64,aW1hZ2U=',
    }
    renderApp('/calendar', createTestRepository({ drafts: [draftWithImage] }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )

    expect(screen.getByAltText('Imagem gerada para o post')).toHaveAttribute(
      'src',
      'data:image/webp;base64,aW1hZ2U=',
    )
    expect(
      screen.getByText('Imagem gerada e salva na agenda.'),
    ).toBeInTheDocument()
  })

  it('não oferece geração manual de imagem na prévia do agendamento', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )

    expect(
      screen.queryByRole('button', { name: 'Gerar imagem com IA' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Este rascunho não tem uma imagem disponível.'),
    ).toBeInTheDocument()
  })

  it('renova um link de imagem expirado ao abrir a prévia', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({
      drafts: [
        {
          ...drafts[0],
          imageUrl: 'https://storage.example/expired',
          imageAvailable: true,
        },
      ],
    })
    repository.refreshDraftImageUrl = async () =>
      'https://storage.example/fresh'
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const image = screen.getByAltText('Imagem gerada para o post')
    fireEvent.error(image)

    await waitFor(() =>
      expect(screen.getByAltText('Imagem gerada para o post')).toHaveAttribute(
        'src',
        'https://storage.example/fresh',
      ),
    )
  })

  it('adiciona e remove hashtags no editor do agendamento', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    await user.type(screen.getByLabelText('Adicionar hashtag'), 'CafeLocal')
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(
      screen.getByRole('button', { name: 'Remover hashtag #CafeLocal' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Remover hashtag #cafe' }),
    )
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() =>
      expect(repository.snapshot().drafts[0]?.hashtags).toEqual(['#CafeLocal']),
    )
  })

  it('duplica o post com uma nova identidade e situação de rascunho', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Duplicar como rascunho' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cópia criada como rascunho.',
    )
    const saved = repository.snapshot().drafts
    expect(saved).toHaveLength(3)
    expect(saved[2]).toMatchObject({
      title: 'Café especial (cópia)',
      platform: 'Instagram',
      status: 'draft',
    })
    expect(saved[2].id).not.toBe('draft-1')
  })

  beforeEach(() => {
    authenticateDemo()
  })

  it('apresenta os rascunhos nas datas corretas e destaca a rota ativa', async () => {
    renderApp('/calendar', createTestRepository({ drafts }))
    expect(
      await screen.findByRole('button', { name: /Café especial/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Segundo post/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('edita e exclui somente o item selecionado', async () => {
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const caption = screen.getByLabelText('Legenda')
    await user.clear(caption)
    await user.type(caption, 'Legenda do café de sábado')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    let saved = repository.snapshot().drafts
    expect(
      saved.find((draft: PostDraft) => draft.id === 'draft-1'),
    ).toMatchObject({ caption: 'Legenda do café de sábado' })
    expect(
      saved.find((draft: PostDraft) => draft.id === 'draft-2'),
    ).toMatchObject({ caption: 'Não deve mudar' })

    await user.click(
      screen.getByRole('button', { name: 'Fechar detalhes do dia' }),
    )
    await user.click(screen.getByRole('button', { name: /Café especial/ }))
    await user.click(screen.getByRole('button', { name: 'Excluir post' }))
    saved = repository.snapshot().drafts
    expect(saved.map((draft: PostDraft) => draft.id)).toEqual(['draft-2'])
    expect(
      screen.getByRole('button', { name: /Segundo post/ }),
    ).toBeInTheDocument()
  })

  describe('aprovação e estados de publicação', () => {
    function postWith(overrides: Partial<PostDraft>): PostDraft {
      return { ...drafts[0], ...overrides }
    }

    it('post draft mostra "Não agendado" e o botão Aprovar', async () => {
      authenticateDemo()
      renderApp('/calendar', createTestRepository({ drafts }))

      const card = await screen.findByRole('button', { name: /Café especial/ })
      expect(card).toHaveTextContent('Não agendado')
      expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(2)
    })

    it('clicar em Aprovar envia PATCH com status scheduled', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({ drafts })
      renderApp('/calendar', repository)

      await screen.findByRole('button', { name: /Café especial/ })
      await user.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])

      await waitFor(() =>
        expect(repository.snapshot().drafts[0]).toMatchObject({
          id: 'draft-1',
          status: 'scheduled',
        }),
      )
      expect(repository.snapshot().drafts[1].status).toBe('draft')
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Café especial/ }),
        ).toHaveTextContent('Agendado'),
      )
      expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(1)
    })

    it('mostra o motivo quando a aprovação rápida é recusada pelo servidor', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({ drafts })
      vi.spyOn(repository, 'updateDraft').mockRejectedValue(
        new ApiError('Escolha um horário futuro para agendar o post.', 400),
      )
      renderApp('/calendar', repository)

      await screen.findByRole('button', { name: /Café especial/ })
      await user.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Escolha um horário futuro para agendar o post.',
      )
      expect(
        screen.getByRole('button', { name: /Café especial/ }),
      ).toHaveTextContent('Não agendado')
    })

    it('post published com publishMode demo mostra "Publicado (simulado)" e campos desabilitados', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      renderApp(
        '/calendar',
        createTestRepository({
          drafts: [
            postWith({
              status: 'published',
              publishMode: 'demo',
              publishedAt: '2026-10-28T15:00:00.000Z',
              externalPostUrl: 'https://example.com/post/1',
            }),
          ],
        }),
      )

      const card = await screen.findByRole('button', { name: /Café especial/ })
      expect(card).toHaveTextContent('Publicado (simulado)')
      expect(
        screen.queryByRole('button', { name: 'Aprovar' }),
      ).not.toBeInTheDocument()

      await user.click(card)
      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getAllByText('Publicado (simulado)').length,
      ).toBeGreaterThan(0)
      expect(within(dialog).getByLabelText('Legenda')).toBeDisabled()
      expect(within(dialog).getByLabelText('Data')).toBeDisabled()
      expect(within(dialog).getByLabelText('Horário')).toBeDisabled()
      expect(
        within(dialog).queryByRole('button', { name: 'Excluir post' }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole('button', { name: 'Salvar alterações' }),
      ).not.toBeInTheDocument()
      expect(
        within(dialog).getByRole('link', { name: /Ver publicação/ }),
      ).toHaveAttribute('href', 'https://example.com/post/1')
    })

    it('post published fora do modo demo mostra "Publicado"', async () => {
      authenticateDemo()
      renderApp(
        '/calendar',
        createTestRepository({
          drafts: [postWith({ status: 'published', publishMode: 'live' })],
        }),
      )
      const card = await screen.findByRole('button', { name: /Café especial/ })
      expect(card).toHaveTextContent(/Publicado$/)
      expect(card).not.toHaveTextContent('simulado')
    })

    it('post failed mostra o motivo da falha e permite aprovar novamente', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({
        drafts: [
          postWith({
            status: 'failed',
            publishError: 'Token da rede social expirado.',
          }),
        ],
      })
      renderApp('/calendar', repository)

      const card = await screen.findByRole('button', { name: /Café especial/ })
      expect(card).toHaveTextContent('Falhou')
      expect(card).toHaveAttribute('data-status', 'failed')
      await user.click(card)
      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText('Token da rede social expirado.'),
      ).toBeInTheDocument()
      await user.click(
        within(dialog).getByRole('button', { name: 'Aprovar novamente' }),
      )
      await waitFor(() =>
        expect(repository.snapshot().drafts[0].status).toBe('scheduled'),
      )
      expect(await within(dialog).findByRole('status')).toHaveTextContent(
        'Post aprovado e agendado.',
      )
    })

    it('"Aprovar e agendar" agenda o post e "Cancelar agendamento" o devolve a não agendado', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({ drafts })
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).queryByRole('button', { name: 'Cancelar agendamento' }),
      ).not.toBeInTheDocument()
      await user.click(
        within(dialog).getByRole('button', { name: 'Aprovar e agendar' }),
      )
      expect(await within(dialog).findByRole('status')).toHaveTextContent(
        'Post aprovado e agendado.',
      )
      expect(repository.snapshot().drafts[0].status).toBe('scheduled')

      await user.click(
        await within(dialog).findByRole('button', {
          name: 'Cancelar agendamento',
        }),
      )
      await waitFor(() =>
        expect(repository.snapshot().drafts[0].status).toBe('draft'),
      )
    })

    it('editar um post agendado o devolve a não agendado', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({
        drafts: [postWith({ status: 'scheduled' })],
      })
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      await user.type(within(dialog).getByLabelText('Legenda'), ' nova')
      await user.click(
        within(dialog).getByRole('button', { name: 'Salvar alterações' }),
      )
      await waitFor(() =>
        expect(repository.snapshot().drafts[0]).toMatchObject({
          status: 'draft',
          caption: 'Legenda original nova',
        }),
      )
      expect(
        await within(dialog).findByRole('button', {
          name: 'Aprovar e agendar',
        }),
      ).toBeInTheDocument()
    })

    it('mover a data de um post agendado envia status draft, nunca scheduled', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({
        drafts: [postWith({ status: 'scheduled' })],
      })
      const update = vi.spyOn(repository, 'updateDraft')
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      const nextDate = dateInCurrentMonth(16)
      fireEvent.change(within(dialog).getByLabelText('Data'), {
        target: { value: nextDate },
      })

      await waitFor(() =>
        expect(repository.snapshot().drafts[0]).toMatchObject({
          date: nextDate,
          status: 'draft',
        }),
      )
      expect(
        update.mock.calls.every(([, sent]) => sent.status !== 'scheduled'),
      ).toBe(true)
      expect(await within(dialog).findByRole('status')).toHaveTextContent(
        'aprove novamente',
      )
    })

    it('salvar um post agendado sem alterações não reenvia a aprovação', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({
        drafts: [postWith({ status: 'scheduled' })],
      })
      const update = vi.spyOn(repository, 'updateDraft')
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Salvar alterações' }),
      )
      expect(update).not.toHaveBeenCalled()
      expect(repository.snapshot().drafts[0].status).toBe('scheduled')
    })

    it('mostra a mensagem do servidor quando mover a data é recusado', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({ drafts })
      vi.spyOn(repository, 'updateDraft').mockRejectedValue(
        new ApiError('Este post já está em publicação.', 409),
      )
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      fireEvent.change(within(dialog).getByLabelText('Data'), {
        target: { value: dateInCurrentMonth(16) },
      })
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Este post já está em publicação.',
      )
    })

    it('mostra a mensagem do servidor quando o horário já passou', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      const repository = createTestRepository({ drafts })
      vi.spyOn(repository, 'updateDraft').mockRejectedValue(
        new ApiError('Escolha um horário futuro para agendar o post.', 400),
      )
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      await user.click(
        within(dialog).getByRole('button', { name: 'Aprovar e agendar' }),
      )
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Escolha um horário futuro para agendar o post.',
      )
    })

    it('o painel de agendamento não oferece mais a opção Publicado', async () => {
      authenticateDemo()
      const user = userEvent.setup()
      renderApp('/calendar', createTestRepository({ drafts }))

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).queryByLabelText('Situação'),
      ).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
      expect(
        within(dialog).queryByRole('option', { name: 'Publicado' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('atualização automática', () => {
    function setVisibility(value: 'visible' | 'hidden') {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => value,
      })
    }

    afterEach(() => {
      vi.useRealTimers()
      setVisibility('visible')
    })

    async function renderWithServerState() {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      authenticateDemo()
      const repository = createTestRepository({ drafts })
      let server = drafts
      const load = vi
        .spyOn(repository, 'load')
        .mockImplementation(async () => ({
          brand: null,
          drafts: server.map((draft) => ({ ...draft })),
        }))
      const view = renderApp('/calendar', repository)
      await screen.findByRole('button', { name: /Café especial/ })
      load.mockClear()
      return {
        repository,
        load,
        view,
        setServer: (next: PostDraft[]) => {
          server = next
        },
      }
    }

    async function tick(ms: number) {
      await act(async () => {
        vi.advanceTimersByTime(ms)
        await Promise.resolve()
      })
    }

    it('recarrega os posts a cada 60 s e mostra a nova situação', async () => {
      const { load, setServer } = await renderWithServerState()
      setServer([
        { ...drafts[0], status: 'published', publishMode: 'demo' },
        drafts[1],
      ])

      await tick(59_000)
      expect(load).not.toHaveBeenCalled()
      await tick(1_000)
      expect(load).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Café especial/ }),
        ).toHaveTextContent('Publicado (simulado)'),
      )
    })

    it('não recarrega com a aba oculta e recarrega ao voltar o foco', async () => {
      const { load } = await renderWithServerState()
      setVisibility('hidden')
      await tick(120_000)
      expect(load).not.toHaveBeenCalled()

      setVisibility('visible')
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
      })
      await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    })

    it('volta a atualizar depois de um erro e restaura "Serviços disponíveis"', async () => {
      const { load, repository } = await renderWithServerState()
      vi.spyOn(repository, 'updateDraft').mockRejectedValue(new Error('rede'))
      const user = userEvent.setup()
      await user.click(screen.getAllByRole('button', { name: 'Aprovar' })[0])
      expect(
        await screen.findByText('Serviços indisponíveis'),
      ).toBeInTheDocument()

      await tick(60_000)
      expect(load).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(
          screen.queryByText('Serviços indisponíveis'),
        ).not.toBeInTheDocument(),
      )
    })

    it('não empilha intervalos e para ao desmontar', async () => {
      const { load, view } = await renderWithServerState()
      await tick(60_000)
      expect(load).toHaveBeenCalledTimes(1)
      await tick(60_000)
      expect(load).toHaveBeenCalledTimes(2)

      view.unmount()
      load.mockClear()
      await tick(300_000)
      expect(load).not.toHaveBeenCalled()
    })

    it('não apaga a edição aberta no diálogo ao atualizar', async () => {
      const { setServer } = await renderWithServerState()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Café especial/ }))
      const dialog = screen.getByRole('dialog')
      await user.clear(within(dialog).getByLabelText('Legenda'))
      await user.type(within(dialog).getByLabelText('Legenda'), 'Em edição')

      setServer([
        { ...drafts[0], status: 'failed', publishError: 'Falha de rede.' },
        drafts[1],
      ])
      await tick(60_000)

      await waitFor(() =>
        expect(within(dialog).getByText('Falha de rede.')).toBeInTheDocument(),
      )
      expect(within(dialog).getByLabelText('Legenda')).toHaveValue('Em edição')
    })

    it('trava o diálogo aberto quando o post passa a publicado', async () => {
      const { setServer } = await renderWithServerState()
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Café especial/ }))
      const dialog = screen.getByRole('dialog')

      setServer([
        { ...drafts[0], status: 'published', publishMode: 'demo' },
        drafts[1],
      ])
      await tick(60_000)

      await waitFor(() =>
        expect(within(dialog).getByLabelText('Legenda')).toBeDisabled(),
      )
      expect(
        within(dialog).getAllByText('Publicado (simulado)').length,
      ).toBeGreaterThan(0)
    })
  })
})
