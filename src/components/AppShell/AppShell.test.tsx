import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { authenticateDemo, renderApp } from '../../test/testUtils'

describe('Navegação do workspace', () => {
  it('filtra as seções e limpa a busca ao navegar', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand')
    await user.type(await screen.findByLabelText('Buscar seção'), 'Agenda')
    expect(
      screen.queryByRole('link', { name: 'Financeiro' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Agenda' }))
    expect(
      await screen.findByRole('heading', { name: 'Agenda de conteúdo' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar seção')).toHaveValue('')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('apresenta resultado vazio sem inventar destinos', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    renderApp('/brand')
    await user.type(await screen.findByLabelText('Buscar seção'), 'inexistente')
    expect(screen.getByText('Nenhuma seção encontrada.')).toBeInTheDocument()
  })

  it('fecha o menu em gaveta pelo botão visível e devolve o foco', async () => {
    authenticateDemo()
    const user = userEvent.setup()
    // The toggle and the close button are CSS-hidden on wide screens.
    renderApp('/brand')
    const toggle = await screen.findByLabelText('Abrir menu')
    await user.click(toggle)
    const drawer = screen.getByRole('dialog', { name: 'Menu principal' })
    await user.click(within(drawer).getByLabelText('Fechar menu'))
    expect(
      screen.queryByRole('dialog', { name: 'Menu principal' }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Abrir menu')).toHaveFocus()
  })
})
