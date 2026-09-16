import { useState, type FormEvent } from 'react'
import { CalendarDays, Eye, EyeOff, Sparkles } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormField'
import styles from './LoginPage.module.css'

interface FormErrors {
  displayName?: string
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

const LOGIN_FLOW_STEPS = [
  'Configure sua marca',
  'Crie com inteligência artificial',
  'Organize tudo na agenda',
]

function validateCredentials(
  email: string,
  password: string,
  displayName?: string,
): FormErrors {
  const errors: FormErrors = {}

  if (displayName !== undefined && displayName.trim().length < 2) {
    errors.displayName = 'Informe seu nome.'
  }

  if (!email.trim()) {
    errors.email = 'Informe seu e-mail.'
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Digite um e-mail válido.'
  }

  if (!password) {
    errors.password = 'Informe sua senha.'
  } else if (password.length < 6) {
    errors.password = 'Use pelo menos 6 caracteres.'
  }

  return errors
}

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login, recoverPassword, register } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [feedback, setFeedback] = useState<{
    message: string
    type: 'error' | 'success'
  } | null>(null)
  const isBusy = isSubmitting

  if (isAuthenticated) {
    return <Navigate to="/brand" replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateCredentials(
      email,
      password,
      mode === 'register' ? displayName : undefined,
    )

    setErrors(nextErrors)
    setFeedback(null)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'register') {
        const result = await register({ displayName, email, password })

        if (result.requiresEmailConfirmation) {
          setFeedback({
            message: 'Conta criada. Confirme seu e-mail antes de entrar.',
            type: 'success',
          })
          setMode('login')
          return
        }
      } else {
        await login({ email, password })
      }

      navigate('/brand', { replace: true })
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível autenticar.',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordRecovery() {
    const emailError = validateCredentials(email, '123456').email

    if (emailError) {
      setErrors((current) => ({ ...current, email: emailError }))
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const message = await recoverPassword(email)
      setFeedback({ message, type: 'success' })
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível recuperar a senha.',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setErrors({})
    setFeedback(null)
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-label="Apresentação do PostFlow">
        <div className={styles.logo}>
          PostFlow<span>.</span>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <Sparkles size={15} /> IA + CALENDÁRIO
          </div>
          <h1>
            Seu conteúdo,
            <br />
            no ritmo certo.
          </h1>
          <p>
            Planeje, crie e organize os conteúdos da sua marca em um único fluxo
            inteligente.
          </p>
          {LOGIN_FLOW_STEPS.map((step, index) => (
            <div className={styles.flowLine} key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div />
              <span>{step}</span>
            </div>
          ))}
        </div>
        <p className={styles.heroFooter}>
          <CalendarDays size={16} /> Projeto acadêmico · Multidisciplinar VI
        </p>
      </section>

      <section className={styles.loginArea}>
        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <div className={styles.cardHeader}>
            <span className={styles.mark}>
              <Sparkles size={18} />
            </span>
            <div>
              <h2>{mode === 'login' ? 'Bem-vindo' : 'Criar conta'}</h2>
              <p>
                {mode === 'login'
                  ? 'Entre para continuar no PostFlow'
                  : 'Cadastre-se para começar no PostFlow'}
              </p>
            </div>
          </div>

          <div className={styles.fields}>
            {mode === 'register' && (
              <TextField
                label="Nome"
                name="displayName"
                autoComplete="name"
                placeholder="Seu nome"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                error={errors.displayName}
              />
            )}
            <TextField
              label="E-mail"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
            />
            <div className={styles.passwordField}>
              <TextField
                label="Senha"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className={styles.formMeta}>
              <span>Sessão segura</span>
              <button
                type="button"
                onClick={() => void handlePasswordRecovery()}
                disabled={isBusy}
              >
                Esqueceu a senha?
              </button>
            </div>
          )}
          <Button fullWidth type="submit" disabled={isBusy}>
            {isBusy
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar no PostFlow'
                : 'Criar minha conta'}
          </Button>
          {feedback && (
            <p className={styles[feedback.type]} role="status">
              {feedback.message}
            </p>
          )}
          <p className={styles.securityNotice}>
            Um espaço para planejar os próximos passos da sua marca.
          </p>
          <p className={styles.signup}>
            {mode === 'login'
              ? 'Ainda não tem uma conta?'
              : 'Já tem uma conta?'}{' '}
            <button type="button" onClick={toggleMode}>
              {mode === 'login' ? 'Criar conta' : 'Entrar'}
            </button>
          </p>
        </form>
        <p className={styles.areaFooter}>
          © 2026 PostFlow · Ambiente de demonstração
        </p>
      </section>
    </div>
  )
}
