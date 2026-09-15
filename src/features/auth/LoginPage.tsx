import { useState, type FormEvent } from 'react'
import { CalendarDays, Eye, EyeOff, Sparkles } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/FormField'
import styles from './LoginPage.module.css'

interface FormErrors {
  email?: string
  password?: string
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

const LOGIN_FLOW_STEPS = [
  'Configure sua marca',
  'Crie com inteligência artificial',
  'Organize tudo na agenda',
]

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

export function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, login } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  if (isAuthenticated) {
    return <Navigate to="/brand" replace />
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateLogin(email, password)

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    login()
    navigate('/brand')
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
              <h2>Bem-vindo</h2>
              <p>Entre para continuar no PostFlow</p>
            </div>
          </div>

          <div className={styles.fields}>
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
                autoComplete="current-password"
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

          <div className={styles.formMeta}>
            <label>
              <input type="checkbox" /> Lembrar de mim
            </label>
            <button type="button">Esqueceu a senha?</button>
          </div>
          <Button fullWidth type="submit">
            Entrar no PostFlow
          </Button>
          <p className={styles.demoNotice}>
            Acesso demonstrativo: use qualquer e-mail válido e uma senha com 6
            caracteres.
          </p>
          <p className={styles.signup}>
            Ainda não tem uma conta? <button type="button">Criar conta</button>
          </p>
        </form>
        <p className={styles.areaFooter}>
          © 2026 PostFlow · Ambiente de demonstração
        </p>
      </section>
    </div>
  )
}
