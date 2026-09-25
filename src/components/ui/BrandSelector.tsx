import { useApp } from '../../app/AppContext'
import styles from './BrandSelector.module.css'

interface BrandSelectorProps {
  value: string
  disabled?: boolean
  onChange: (workspaceId: string) => void
}

export function BrandSelector({
  value,
  disabled = false,
  onChange,
}: BrandSelectorProps) {
  const { availableWorkspaces } = useApp()
  if (!availableWorkspaces.length) return null
  const selected = availableWorkspaces.find(({ id }) => id === value)

  return (
    <label className={styles.field}>
      <span>Marca usada na geração</span>
      <span className={styles.control}>
        <span
          className={styles.swatch}
          style={{ backgroundColor: selected?.brand.primaryColor ?? '#4F46E5' }}
          aria-hidden="true"
        />
        <select
          value={value}
          disabled={disabled}
          aria-label="Marca usada na geração"
          onChange={(event) => onChange(event.target.value)}
        >
          {availableWorkspaces.map(({ id, brand }) => (
            <option key={id} value={id}>
              {brand.name} · {brand.segment}
            </option>
          ))}
        </select>
      </span>
      <small>O contexto salvo da marca orienta a IA e o rascunho.</small>
    </label>
  )
}
