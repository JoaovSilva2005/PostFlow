import { useEffect, useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { PasswordField } from './PasswordField'
import { resetPassword } from './authApi'
import styles from './ResetPasswordPage.module.css'

function recoveryTokenFromFragment() {
  if (typeof window === 'undefined') return null
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  if (fragment.get('type') !== 'recovery') return null
  const token = fragment.get('token_hash')
  return token && token.length <= 512 ? token : null
}

export function ResetPasswordPage() {
  const [tokenHash] = useState(recoveryTokenFromFragment)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    // Keep the one-time proof out of browser history after the page reads it.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!tokenHash) {
      setError('Link de recuperação inválido. Solicite outro e-mail.')
      return
    }
    if (
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError(
        'Use de 8 a 128 caracteres, com pelo menos uma letra e um número.',
      )
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword({ tokenHash, password, confirmPassword })
      setPassword('')
      setConfirmPassword('')
      setIsComplete(true)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível atualizar a senha. Tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="reset-title">
        <div className={styles.logo}>
          <Sparkles size={20} aria-hidden="true" /> PostFlow
        </div>
        <h1 id="reset-title">
          {isComplete ? 'Senha atualizada' : 'Criar nova senha'}
        </h1>
        {isComplete ? (
          <>
            <p>Sua senha foi alterada. Entre novamente para continuar.</p>
            <a className={styles.linkButton} href="/login">
              Ir para o login
            </a>
          </>
        ) : tokenHash ? (
          <form onSubmit={handleSubmit} noValidate>
            <p>
              Escolha uma senha com pelo menos oito caracteres, uma letra e um
              número.
            </p>
            <PasswordField
              label="Nova senha"
              name="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
            />
            <PasswordField
              label="Confirmar nova senha"
              name="confirmPassword"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isSubmitting}
            />
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Atualizando...' : 'Atualizar senha'}
            </Button>
          </form>
        ) : (
          <p className={styles.error} role="alert">
            Link de recuperação inválido. Solicite outro e-mail na tela de
            login.
          </p>
        )}
        {!isComplete && (
          <a className={styles.backLink} href="/login">
            Voltar ao login
          </a>
        )}
      </section>
    </main>
  )
}
