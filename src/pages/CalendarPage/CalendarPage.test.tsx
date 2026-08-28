import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostDraft } from '../../domain/models'
import { createTestRepository } from '../../test/testRepository'
import { authenticateDemo, renderApp } from '../../test/testUtils'

const drafts: PostDraft[] = [
  {
    id: 'draft-1',
    title: 'Café especial',
    caption: 'Legenda original',
    hashtags: ['#cafe'],
    platform: 'Instagram',
    date: '2026-08-14',
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
    date: '2026-08-20',
    status: 'draft',
    visualText: 'Marca',
    color: '#F97316',
  },
]

describe('CalendarPage', () => {
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
