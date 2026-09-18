import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useApp } from '../../app/AppContext'

export function AccessDenied() {
  const navigate = useNavigate()
  const { billingStatus, currentWorkspace, platformRole, refreshSession } =
    useApp()
  const [isRetrying, setIsRetrying] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const hasActivePlan =
    billingStatus === 'active' || billingStatus === 'trialing'
  const workspaceDestination =
    hasActivePlan || platformRole === 'platform_owner' ? '/brand' : '/billing'
  const fallbackDestination = platformRole ? '/admin/plans' : '/login'

  async function prepareWorkspace() {
    setIsRetrying(true)
    setFeedback(null)

    try {
      const session = await refreshSession()
      if (!session?.workspace) {
        setFeedback('Não foi possível preparar seu workspace agora.')
        return
      }

      const destination =
        session.billingStatus === 'active' ||
        session.billingStatus === 'trialing' ||
        session.platformRole === 'platform_owner'
          ? '/brand'
          : '/billing'
      navigate(destination, { replace: true })
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar seu workspace agora.',
      )
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: '48px 24px' }}>
      <p style={{ color: 'var(--color-muted)', marginBottom: 8 }}>Erro 403</p>
      <h1>Acesso não autorizado</h1>
      <p style={{ color: 'var(--color-muted)', maxWidth: 560 }}>
        Sua conta está autenticada, mas não possui permissão para abrir esta
        área. Volte ao seu workspace ou fale com um administrador do PostFlow.
      </p>
      {currentWorkspace ? (
        <Link to={workspaceDestination}>Voltar ao workspace</Link>
      ) : platformRole ? (
        <Link to={fallbackDestination}>Voltar para a administração</Link>
      ) : (
        <button type="button" onClick={() => void prepareWorkspace()}>
          {isRetrying ? 'Preparando workspace...' : 'Preparar meu workspace'}
        </button>
      )}
      {feedback && <p role="alert">{feedback}</p>}
    </main>
  )
}
