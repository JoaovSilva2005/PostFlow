import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/testUtils'

describe('LoginPage', () => {
  it('rejeita campos vazios e navega quando os dados são válidos', async () => {
    const user = userEvent.setup()
    const { authGateway } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Entrar no PostFlow' }))
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe sua senha.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^E-mail/)).toHaveFocus()
    expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription(
      'Informe seu e-mail.',
    )

    await user.type(screen.getByLabelText(/^E-mail/), 'aluno@postflow.com')
    await user.type(screen.getByLabelText(/^Senha/), '123456')
    await user.click(screen.getByRole('button', { name: 'Entrar no PostFlow' }))

    expect(
      await screen.findByRole('heading', { name: 'Configuração da marca' }),
    ).toBeInTheDocument()
    expect(authGateway.lastLogin).toEqual({
      email: 'aluno@postflow.com',
      password: '123456',
    })
  })

  it('permite alternar para criação de conta', async () => {
    const user = userEvent.setup()
    const { authGateway } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Silva')
    await user.type(screen.getByLabelText('Marca ou empresa'), 'Studio Maria')
    await user.selectOptions(
      screen.getByLabelText('Segmento'),
      'Serviços profissionais',
    )
    await user.type(screen.getByLabelText(/^E-mail/), 'maria@postflow.com')
    await user.type(screen.getByLabelText(/^Senha/), 'senha123')
    await user.type(screen.getByLabelText('Confirmar senha'), 'senha123')
    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    expect(
      await screen.findByRole('heading', { name: 'Configuração da marca' }),
    ).toBeInTheDocument()
    expect(authGateway.lastRegistration).toMatchObject({
      displayName: 'Maria Silva',
      brandName: 'Studio Maria',
      segment: 'Serviços profissionais',
      email: 'maria@postflow.com',
      confirmPassword: 'senha123',
    })
  })

  it('exige confirmação igual e senha adequada no cadastro', async () => {
    const user = userEvent.setup()
    const { authGateway } = renderApp('/login')

    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Silva')
    await user.type(screen.getByLabelText('Marca ou empresa'), 'Studio Maria')
    await user.selectOptions(screen.getByLabelText('Segmento'), 'Tecnologia')
    await user.type(screen.getByLabelText(/^E-mail/), 'maria@postflow.com')
    await user.type(screen.getByLabelText(/^Senha/), 'senhafraca')
    await user.type(screen.getByLabelText('Confirmar senha'), 'outra-senha')
    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }))

    expect(screen.getByText('Inclua pelo menos um número.')).toBeInTheDocument()
    expect(screen.getByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(authGateway.lastRegistration).toBeNull()
  })

  it('permite visualizar e ocultar a senha no login', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    const password = screen.getByLabelText(/^Senha/) as HTMLInputElement

    expect(password.type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(password.type).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password.type).toBe('password')
  })
})
