import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPassword } from './authApi'
import { ResetPasswordPage } from './ResetPasswordPage'

vi.mock('./authApi', () => ({ resetPassword: vi.fn() }))

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(resetPassword).mockReset()
    window.history.replaceState(
      {},
      '',
      '/reset-password#token_hash=valid-hash&type=recovery',
    )
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('remove o token da URL e exige confirmação igual', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)
    expect(window.location.hash).toBe('')

    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123')
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'outraSenha123',
    )
    await user.click(screen.getByRole('button', { name: 'Atualizar senha' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'As senhas não coincidem.',
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('envia somente o hash de recuperação e orienta novo login', async () => {
    const user = userEvent.setup()
    vi.mocked(resetPassword).mockResolvedValue(undefined)
    render(<ResetPasswordPage />)
    await user.type(screen.getByLabelText('Nova senha'), 'novaSenha123')
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'novaSenha123',
    )
    await user.click(screen.getByRole('button', { name: 'Atualizar senha' }))
    expect(resetPassword).toHaveBeenCalledWith({
      tokenHash: 'valid-hash',
      password: 'novaSenha123',
      confirmPassword: 'novaSenha123',
    })
    expect(
      await screen.findByRole('heading', { name: 'Senha atualizada' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ir para o login' }),
    ).toHaveAttribute('href', '/login')
  })

  it('recusa um link sem prova de recuperação', () => {
    window.history.replaceState(
      {},
      '',
      '/reset-password#access_token=ordinary-session&type=recovery',
    )
    render(<ResetPasswordPage />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Link de recuperação inválido',
    )
    expect(
      screen.queryByRole('button', { name: 'Atualizar senha' }),
    ).not.toBeInTheDocument()
  })
})
