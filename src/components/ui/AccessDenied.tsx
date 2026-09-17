import { Link } from 'react-router'

export function AccessDenied() {
  return (
    <main id="main-content" tabIndex={-1} style={{ padding: '48px 24px' }}>
      <p style={{ color: 'var(--color-muted)', marginBottom: 8 }}>Erro 403</p>
      <h1>Acesso não autorizado</h1>
      <p style={{ color: 'var(--color-muted)', maxWidth: 560 }}>
        Sua conta está autenticada, mas não possui permissão para abrir esta
        área. Volte ao seu workspace ou fale com um administrador do PostFlow.
      </p>
      <Link to="/brand">Voltar ao workspace</Link>
    </main>
  )
}
