import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'
import { generationService } from '../content/generationService'
import { onTestFinished } from 'vitest'
import { toDateKey } from './calendarUtils'

// Nome do diálogo do dia: o título com a data por extenso (ex.: 14 de outubro de 2026).
const DAY_DIALOG_NAME = /^\d{1,2} de \p{L}+ de \d{4}$/u

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
      '21 rascunhos salvos na agenda para revisão. Abra o post para revisar e publicar nas redes conectadas.',
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
    await user.click(
      screen.getByRole('button', { name: /editar data e horário/ }),
    )
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
    await user.click(
      screen.getByRole('button', { name: /editar data e horário/ }),
    )
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
  it('abre o editor compacto de agenda pela pílula de data e fecha com Escape', async () => {
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument()
    const datePill = screen.getByRole('button', {
      name: /editar data e horário/,
    })
    expect(datePill).toHaveAccessibleName(
      `${drafts[0].date.split('-').reverse().join('/')} · 12:00, editar data e horário`,
    )
    expect(datePill).toHaveAttribute('aria-expanded', 'false')
    await user.click(datePill)

    const editor = screen.getByRole('dialog', { name: 'Agenda do post' })
    expect(datePill).toHaveAttribute('aria-expanded', 'true')
    expect(within(editor).getByLabelText('Data')).toHaveValue(drafts[0].date)
    expect(within(editor).getByLabelText('Horário')).toHaveValue('12:00')
    expect(within(editor).getByLabelText('Situação')).toHaveValue('draft')
    expect(within(editor).getByText(/Fuso horário de Brasília/)).toBeVisible()
    expect(within(editor).getByLabelText('Data')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Agenda do post' }),
    ).not.toBeInTheDocument()
    expect(datePill).toHaveFocus()
    expect(
      screen.getByRole('dialog', { name: DAY_DIALOG_NAME }),
    ).toBeInTheDocument()

    const statusPill = screen.getByRole('button', {
      name: 'Rascunho, editar situação',
    })
    await user.click(statusPill)
    expect(
      screen.getByRole('dialog', { name: 'Agenda do post' }),
    ).toBeInTheDocument()
    expect(statusPill).toHaveAttribute('aria-expanded', 'true')
    expect(datePill).toHaveAttribute('aria-expanded', 'false')
    expect(datePill).not.toHaveAttribute('aria-controls')

    // Clicar na outra pílula com o editor aberto mantém o editor aberto.
    await user.click(datePill)
    expect(
      screen.getByRole('dialog', { name: 'Agenda do post' }),
    ).toBeInTheDocument()
    expect(datePill).toHaveAttribute('aria-expanded', 'true')
    expect(statusPill).toHaveAttribute('aria-expanded', 'false')
    expect(datePill).toHaveFocus()

    // Clicar de novo na mesma pílula fecha.
    await user.click(datePill)
    expect(
      screen.queryByRole('dialog', { name: 'Agenda do post' }),
    ).not.toBeInTheDocument()
  })

  it('fecha o editor de agenda quando o foco sai dele e das pílulas', async () => {
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    await user.click(
      screen.getByRole('button', { name: /editar data e horário/ }),
    )
    const editor = screen.getByRole('dialog', { name: 'Agenda do post' })
    within(editor)
      .getByRole('button', { name: 'Fechar agenda do post' })
      .focus()
    await user.tab()
    expect(
      screen.queryByRole('dialog', { name: 'Agenda do post' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: DAY_DIALOG_NAME })).toBeVisible()
  })

  it('move a data e salva horário e situação pelo editor da pílula', async () => {
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    await user.click(
      screen.getByRole('button', { name: /editar data e horário/ }),
    )
    const editor = screen.getByRole('dialog', { name: 'Agenda do post' })
    const nextDate = dateInCurrentMonth(15)
    fireEvent.change(within(editor).getByLabelText('Data'), {
      target: { value: nextDate },
    })
    await waitFor(() =>
      expect(repository.snapshot().drafts[0]).toMatchObject({
        date: nextDate,
        status: 'draft',
      }),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Post movido para a nova data na agenda.',
    )

    fireEvent.change(within(editor).getByLabelText('Horário'), {
      target: { value: '08:15' },
    })
    await user.selectOptions(
      within(editor).getByLabelText('Situação'),
      'scheduled',
    )
    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('button', { name: /^\d{2}\/\d{2}\/\d{4} · 08:15,/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Agendado, editar situação' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alterações salvas.',
    )
    expect(repository.snapshot().drafts[0]).toMatchObject({
      date: nextDate,
      time: '08:15',
      status: 'scheduled',
    })
  })

  it('abre Publicar nas redes em uma janela própria sem repetir a prévia', async () => {
    const user = userEvent.setup()
    renderApp(
      '/calendar',
      createTestRepository({
        drafts: [
          {
            ...drafts[0],
            format: 'static',
            imageUrl: 'data:image/webp;base64,aW1hZ2U=',
          },
        ],
      }),
    )

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    expect(
      screen.queryByRole('dialog', { name: 'Publicar nas redes' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Publicar agora' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publicar nas redes' }))
    const publishDialog = screen.getByRole('dialog', {
      name: 'Publicar nas redes',
    })
    expect(publishDialog).toHaveAttribute('aria-modal', 'true')
    expect(
      within(publishDialog).getByRole('button', { name: 'Publicar agora' }),
    ).toBeInTheDocument()
    expect(
      within(publishDialog).getByLabelText(/Confirmo a publicação/),
    ).toBeInTheDocument()
    expect(
      within(publishDialog).getByLabelText(/Agendar \(opcional\)/),
    ).toBeInTheDocument()
    expect(
      within(publishDialog).queryByAltText(
        'Prévia da imagem que será publicada',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(publishDialog).queryByText('Legenda original'),
    ).not.toBeInTheDocument()
    expect(
      within(publishDialog).getByRole('button', {
        name: 'Fechar publicação nas redes',
      }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('dialog', { name: 'Publicar nas redes' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Publicar nas redes' }),
    ).toHaveFocus()
    // Escape na janela de publicação não fecha o diálogo do dia.
    const dayDialog = screen.getByRole('dialog', { name: DAY_DIALOG_NAME })
    expect(dayDialog).toBeVisible()
    expect(
      within(dayDialog).getByRole('heading', {
        level: 2,
        name: DAY_DIALOG_NAME,
      }),
    ).toBeInTheDocument()
    expect(
      within(dayDialog).getByRole('heading', { name: 'Instagram' }),
    ).toBeInTheDocument()
  })

  it('copia a legenda com as hashtags', async () => {
    const user = userEvent.setup()
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const captionArea = screen.getByRole('region', {
      name: 'Legenda para Instagram',
    })
    await user.click(
      within(captionArea).getByRole('button', { name: 'Copiar legenda' }),
    )

    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        'Legenda original\n\n#cafe',
      ),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Legenda copiada.')
  })

  it('lista os itens de Mais recursos com a nota de publicação', async () => {
    const user = userEvent.setup()
    const previousGenerateImage = generationService.generateImage
    generationService.generateImage = async () =>
      'data:image/webp;base64,aW1hZ2U='
    onTestFinished(() => {
      generationService.generateImage = previousGenerateImage
    })
    renderApp('/calendar', createTestRepository({ drafts }))

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const resources = screen.getByRole('region', { name: 'Mais recursos' })
    for (const name of [
      'Publicar nas redes',
      'Gerar imagem com IA',
      'Duplicar como rascunho',
      'Excluir post',
    ]) {
      expect(within(resources).getByRole('button', { name })).toBeVisible()
    }
    // "Copiar legenda" fica só no cabeçalho da legenda, como na referência.
    expect(
      within(resources).queryByRole('button', { name: 'Copiar legenda' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Copiar legenda' }),
    ).toHaveLength(1)
    expect(
      within(resources).getByText(
        'Este post é publicado automaticamente na data agendada depois de aprovado.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeInTheDocument()
  })

  it('mantém o post publicado somente leitura com aviso na prévia', async () => {
    const user = userEvent.setup()
    renderApp(
      '/calendar',
      createTestRepository({
        drafts: [{ ...drafts[0], status: 'published' }],
      }),
    )

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    expect(
      screen.getByText('Post publicado não pode ser editado.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Legenda')).toHaveAttribute('readonly')
    expect(screen.queryByLabelText('Adicionar hashtag')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remover hashtag #cafe' }),
    ).not.toBeInTheDocument()
  })

  it('só oferece salvar o post publicado quando horário ou situação mudam', async () => {
    const user = userEvent.setup()
    const repository = createTestRepository({
      drafts: [{ ...drafts[0], status: 'published' }],
    })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    expect(
      screen.queryByRole('button', { name: 'Salvar alterações' }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /editar data e horário/ }),
    )
    fireEvent.change(screen.getByLabelText('Horário'), {
      target: { value: '19:45' },
    })
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Alterações salvas.',
    )
    expect(repository.snapshot().drafts[0]).toMatchObject({
      time: '19:45',
      status: 'published',
      caption: 'Legenda original',
    })
    expect(
      screen.queryByRole('button', { name: 'Salvar alterações' }),
    ).not.toBeInTheDocument()
  })

  it('duplica e exclui pelos itens de Mais recursos', async () => {
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    let resources = screen.getByRole('region', { name: 'Mais recursos' })
    await user.click(
      within(resources).getByRole('button', { name: 'Duplicar como rascunho' }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cópia criada como rascunho.',
    )
    expect(repository.snapshot().drafts).toHaveLength(3)

    const original = document.querySelector<HTMLElement>(
      '[data-draft-id="draft-1"]',
    )!
    resources = within(original).getByRole('region', { name: 'Mais recursos' })
    await user.click(
      within(resources).getByRole('button', { name: 'Excluir post' }),
    )
    await waitFor(() =>
      expect(
        repository.snapshot().drafts.map((draft: PostDraft) => draft.id),
      ).not.toContain('draft-1'),
    )
    expect(repository.snapshot().drafts).toHaveLength(2)
  })

  it('gera a imagem pelo item de Mais recursos usando a prévia', async () => {
    const user = userEvent.setup()
    const repository = createTestRepository({ drafts })
    const previousGenerateImage = generationService.generateImage
    generationService.generateImage = async () =>
      'data:image/webp;base64,aW1hZ2U='
    onTestFinished(() => {
      generationService.generateImage = previousGenerateImage
    })
    renderApp('/calendar', repository)

    await user.click(
      await screen.findByRole('button', { name: /Café especial/ }),
    )
    const resources = screen.getByRole('region', { name: 'Mais recursos' })
    await user.click(
      within(resources).getByRole('button', { name: 'Gerar imagem com IA' }),
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
    expect(
      within(resources).queryByRole('button', { name: 'Gerar imagem com IA' }),
    ).not.toBeInTheDocument()
  })
})
