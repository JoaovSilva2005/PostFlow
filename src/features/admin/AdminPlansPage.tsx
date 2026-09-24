import { AppShell } from '../../components/AppShell/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { PlanEconomics } from '../fiscal/PlanEconomics'

export function AdminPlansPage() {
  return (
    <AppShell>
      <PageHeader
        title="Planos e custos"
        description="Área interna para avaliar preço, franquias e economia unitária do PostFlow."
      />
      <p
        style={{
          maxWidth: 760,
          color: 'var(--color-muted)',
          marginBottom: 20,
        }}
      >
        Estes valores são premissas administrativas e não representam
        lançamentos financeiros ou cobranças de clientes. Alterações no
        simulador não mudam planos ativos.
      </p>
      <PlanEconomics />
    </AppShell>
  )
}
