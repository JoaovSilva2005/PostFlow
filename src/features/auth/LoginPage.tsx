import { useState, type FormEvent } from 'react'
import { CalendarDays, Sparkles } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import { BRAND_SEGMENT_OPTIONS } from '../../domain/brandCatalog'
import styles from './LoginPage.module.css'
import { EditorialSample } from './EditorialSample'
import { PasswordField } from './PasswordField'

interface FormErrors {
  displayName?: string
  brandName?: string
  segment?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

function validateLogin(email: string, password: string): FormErrors {
  const errors: FormErrors = {}

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

function validateRegistration(input: {
  displayName: string
  brandName: string
  segment: string
  email: string
  password: string
  confirmPassword: string
}): FormErrors {
  const errors = validateLogin(input.email, input.password)

  if (input.displayName.trim().length < 2) {
    errors.displayName = 'Informe seu nome completo.'
  }
  if (input.brandName.trim().length < 2) {
    errors.brandName = 'Informe o nome da marca ou empresa.'
  }
  if (!input.segment) {
    errors.segment = 'Selecione o segmento da marca.'
  }
  if (input.password.length < 8) {
    errors.password = 'Use pelo menos 8 caracteres.'
  } else if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(input.password)) {
    errors.password = 'Inclua pelo menos uma letra.'
  } else if (!/\d/.test(input.password)) {
    errors.password = 'Inclua pelo menos um número.'
  }
  if (!input.confirmPassword) {
    errors.confirmPassword = 'Confirme sua senha.'
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem.'
  }

  return errors
}

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login, recoverPassword, register } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [displayName, setDisplayName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [segment, setSegment] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    const nextErrors =
      mode === 'register'
        ? validateRegistration({
            displayName,
            brandName,
            segment,
            email,
            password,
            confirmPassword,
          })
        : validateLogin(email, password)

    setErrors(nextErrors)
    setFeedback(null)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'register') {
        const result = await register({
          displayName: displayName.trim(),
          brandName: brandName.trim(),
          segment,
          email: email.trim(),
          password,
          confirmPassword,
        })

        if (result.requiresEmailConfirmation) {
          setFeedback({
            message: 'Conta criada. Confirme seu e-mail antes de entrar.',
            type: 'success',
          })
          setMode('login')
          setPassword('')
          setConfirmPassword('')
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
    const emailError = validateLogin(email, '123456').email

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
    setPassword('')
    setConfirmPassword('')
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
          <h1>
            Seu conteúdo,
            <br />
            no ritmo certo.
          </h1>
          <p>
            Transforme ideias em posts e organize a semana da sua marca, com
            espaço para revisar cada detalhe.
          </p>
          <EditorialSample />
        </div>
        <p className={styles.heroFooter}>
          <CalendarDays size={16} /> Projeto acadêmico · Multidisciplinar VI
        </p>
      </section>

      <main className={styles.loginArea}>
        <form
          className={`${styles.card} ${mode === 'register' ? styles.registrationCard : ''}`}
          onSubmit={handleSubmit}
          noValidate
        >
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

          <div
            className={`${styles.fields} ${mode === 'register' ? styles.registrationFields : ''}`}
          >
            {mode === 'register' && (
              <TextField
                label="Nome completo"
                name="displayName"
                autoComplete="name"
                placeholder="Como devemos chamar você?"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                error={errors.displayName}
              />
            )}
            {mode === 'register' && (
              <TextField
                label="Marca ou empresa"
                name="brandName"
                autoComplete="organization"
                placeholder="Ex.: Café Aurora"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                error={errors.brandName}
              />
            )}
            {mode === 'register' && (
              <SelectField
                label="Segmento"
                name="segment"
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                error={errors.segment}
                options={[
                  { label: 'Selecione o segmento', value: '' },
                  ...BRAND_SEGMENT_OPTIONS,
                ]}
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
            <PasswordField
              label="Senha"
              name="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              hint={
                mode === 'register'
                  ? 'Use 8 ou mais caracteres, com letra e número.'
                  : undefined
              }
            />
            {mode === 'register' && (
              <PasswordField
                label="Confirmar senha"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={errors.confirmPassword}
              />
            )}
          </div>

          {mode === 'login' && (
            <div className={styles.formMeta}>
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
      </main>
    </div>
  )
}
