import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { generationService } from '../content/generationService'
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
      '21 rascunhos salvos na agenda para revisão. A publicação é manual.',
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
    await user.selectOptions(screen.getByLabelText('Situação'), 'scheduled')
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
      status: 'scheduled',
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

  it('gera e salva a imagem diretamente na prévia do agendamento', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    const previousGenerateImage = generationService.generateImage
    generationService.generateImage = async () =>
      'data:image/webp;base64,aW1hZ2U='

    try {
      renderApp('/calendar', repository)

      await user.click(
        await screen.findByRole('button', { name: /Café especial/ }),
      )
      await user.click(
        screen.getByRole('button', { name: 'Gerar imagem com IA' }),
      )

      await waitFor(() =>
        expect(repository.snapshot().drafts[0]).toMatchObject({
          imageUrl: 'data:image/webp;base64,aW1hZ2U=',
          imageAvailable: true,
        }),
      )
      expect(screen.getByAltText('Imagem gerada para o post')).toHaveAttribute(
        'src',
        'data:image/webp;base64,aW1hZ2U=',
      )
    } finally {
      generationService.generateImage = previousGenerateImage
    }
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
})
