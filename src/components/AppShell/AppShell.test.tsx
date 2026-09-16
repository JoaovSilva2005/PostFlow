import { screen } from '@testing-library/react'
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
})
