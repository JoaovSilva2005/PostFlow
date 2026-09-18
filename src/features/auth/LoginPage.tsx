import { useState, type FormEvent } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/FormField'
import { BRAND_SEGMENT_OPTIONS } from '../../domain/brandCatalog'
import styles from './LoginPage.module.css'
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

const calendarDays = Array.from({ length: 35 }, (_, index) => index + 1)

function WorkspaceBackdrop() {
  return (
    <div className={styles.workspace} aria-hidden="true">
      <aside className={styles.workspaceSidebar}>
        <div className={styles.workspaceLogo}>
          <span className={styles.workspaceMark}>
            <Sparkles size={16} />
          </span>
          <strong>PostFlow</strong>
        </div>
        <nav className={styles.workspaceNav}>
          <span>
            <LayoutDashboard size={17} /> Visão geral
          </span>
          <span className={styles.workspaceNavActive}>
            <CalendarDays size={17} /> Calendário
          </span>
          <span>
            <MessageSquareText size={17} /> Criar com IA
          </span>
          <span>
            <FileText size={17} /> Conteúdos
          </span>
          <span>
            <BarChart3 size={17} /> Resultados
          </span>
        </nav>
        <span className={styles.workspaceSettings}>
          <Settings size={17} /> Configurações
        </span>
      </aside>

      <section className={styles.workspaceContent}>
        <header className={styles.workspaceTopbar}>
          <div>
            <small>Workspace</small>
            <strong>Studio Aurora</strong>
          </div>
          <div className={styles.workspaceActions}>
            <span className={styles.workspaceSearch}>
              <Search size={15} /> Buscar
            </span>
            <span className={styles.iconButton}>
              <Bell size={16} />
            </span>
          </div>
        </header>

        <main className={styles.workspaceMain}>
          <div className={styles.workspaceHeading}>
            <div>
              <p>Planejamento editorial</p>
              <h2>Calendário de conteúdo</h2>
            </div>
            <span className={styles.workspaceCta}>
              <Plus size={16} /> Criar conteúdo
            </span>
          </div>

          <div className={styles.workspaceCalendar}>
            <header className={styles.calendarHeader}>
              <div>
                <span className={styles.iconButton}>
                  <ChevronLeft size={16} />
                </span>
                <strong>Setembro 2026</strong>
                <span className={styles.iconButton}>
                  <ChevronRight size={16} />
                </span>
              </div>
              <span>Hoje</span>
            </header>
            <div className={styles.weekdays}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className={styles.calendarGrid}>
              {calendarDays.map((day) => (
                <div key={day} className={styles.calendarCell}>
                  <span>{day}</span>
                  {[5, 10, 17, 24, 31].includes(day) && (
                    <small>Post da semana</small>
                  )}
                  {[13, 27].includes(day) && <small>Dica para o público</small>}
                </div>
              ))}
            </div>
          </div>
        </main>
      </section>
    </div>
  )
}

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
      <WorkspaceBackdrop />
      <div className={styles.backdrop} />

      <main className={styles.loginArea} aria-label="Acesso ao PostFlow">
        <form
          className={`${styles.card} ${mode === 'register' ? styles.registrationCard : ''}`}
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={styles.logo}>
            <span className={styles.logoMark}>
              <Sparkles size={17} aria-hidden="true" />
            </span>
            PostFlow
          </div>
          <div className={styles.cardHeader}>
            <h1>{mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}</h1>
            <p>
              {mode === 'login'
                ? 'Entre com seu e-mail e senha para acessar seu workspace.'
                : 'Preencha seus dados para começar a organizar seus conteúdos.'}
            </p>
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
          <p className={styles.legal}>
            Ao continuar, você concorda com os Termos de uso e a Política de
            privacidade.
          </p>
        </form>
      </main>
    </div>
  )
}
