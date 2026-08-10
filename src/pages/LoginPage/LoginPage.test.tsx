import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/testUtils'

describe('LoginPage', () => {
  it('rejeita campos vazios e navega quando os dados são válidos', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Entrar no PostFlow' }))
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^E-mail/), 'aluno@postflow.com')
    await user.type(screen.getByLabelText(/^Senha/), '123456')
    await user.click(screen.getByRole('button', { name: 'Entrar no PostFlow' }))

    expect(await screen.findByRole('heading', { name: 'Configuração da marca' })).toBeInTheDocument()
    expect(localStorage.getItem('postflow:session')).toBe('true')
  })
})
