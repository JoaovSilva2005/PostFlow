import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../../test/testUtils'

describe('ChatPage', () => {
  it('salva os ajustes da revisão e abre a agenda no mês escolhido', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/chat')
    await user.type(
      await screen.findByLabelText('Pedido para a IA'),
      'Novidade da marca',
    )
    await user.click(screen.getByRole('button', { name: 'Gerar post' }))
    await screen.findByText(/Rascunho gerado/)
    await user.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    const title = await screen.findByLabelText('Título do post')
    await user.clear(title)
    await user.type(title, 'Lançamento de outubro')
    const caption = screen.getByLabelText('Legenda do post')
    await user.clear(caption)
    await user.type(caption, 'Conheça nossa novidade.')
    fireEvent.change(screen.getByLabelText('Data do post'), {
      target: { value: '2026-10-10' },
    })
    await user.click(screen.getByRole('button', { name: 'Adicionar à agenda' }))
    expect(
      await screen.findByRole('heading', { name: 'Outubro 2026' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Rascunho adicionado')
    expect(repository.snapshot().drafts[0]).toMatchObject({
      title: 'Lançamento de outubro',
      caption: 'Conheça nossa novidade.',
      date: '2026-10-10',
    })
  }, 10_000)

  it('exibe o carregamento, gera uma prévia e adiciona o rascunho à agenda', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    const { repository } = renderApp('/chat')

    await user.type(
      await screen.findByLabelText('Pedido para a IA'),
      'Post sobre café especial',
    )
    await user.click(screen.getByRole('button', { name: 'Gerar post' }))
    expect(screen.getByText('Preparando seu rascunho...')).toBeInTheDocument()

    expect(
      await screen.findByText(/Rascunho gerado/, {}, { timeout: 2000 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Post sobre café especial' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Adicionar à agenda/ }))
    const saved = repository.snapshot().drafts
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      platform: 'Instagram',
    })
  }, 10_000)
})
