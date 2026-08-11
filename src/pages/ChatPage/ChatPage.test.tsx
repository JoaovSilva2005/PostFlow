import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../../test/testUtils'

describe('ChatPage', () => {
  it('exibe o carregamento, gera uma prévia e adiciona o rascunho à agenda', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/chat')

    await user.type(
      screen.getByLabelText('Pedido para a IA'),
      'Post sobre café especial',
    )
    await user.click(screen.getByRole('button', { name: 'Gerar post' }))
    expect(screen.getByText('Criando texto e imagem...')).toBeInTheDocument()

    expect(
      await screen.findByText('Rascunho gerado', {}, { timeout: 2000 }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sexta com café especial')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Adicionar à agenda/ }))
    const saved = JSON.parse(localStorage.getItem('postflow:drafts') ?? '[]')
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      date: '2026-08-14',
      platform: 'Instagram',
    })
  })
})
