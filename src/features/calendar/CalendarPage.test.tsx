import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'
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
    expect(screen.getByLabelText('Título')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Café especial/ })).toHaveFocus()
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
    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Café de sábado')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    let saved = repository.snapshot().drafts
    expect(
      saved.find((draft: PostDraft) => draft.id === 'draft-1'),
    ).toMatchObject({ title: 'Café de sábado' })
    expect(
      saved.find((draft: PostDraft) => draft.id === 'draft-2'),
    ).toMatchObject({ caption: 'Não deve mudar' })

    await user.click(screen.getByRole('button', { name: /Café de sábado/ }))
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    saved = repository.snapshot().drafts
    expect(saved.map((draft: PostDraft) => draft.id)).toEqual(['draft-2'])
    expect(
      screen.getByRole('button', { name: /Segundo post/ }),
    ).toBeInTheDocument()
  })
})
