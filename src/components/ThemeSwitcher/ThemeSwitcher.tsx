import { Monitor, Moon, Sun } from 'lucide-react'
import { useId } from 'react'
import { useThemePreference, type ThemePreference } from '../../app/theme'
import styles from './ThemeSwitcher.module.css'

export function ThemeSwitcher() {
  const id = useId()
  const [preference, setPreference] = useThemePreference()
  const Icon =
    preference === 'light' ? Sun : preference === 'system' ? Monitor : Moon
  return (
    <label className={styles.control} htmlFor={id}>
      <Icon size={16} aria-hidden="true" />
      <span>Tema</span>
      <select
        id={id}
        aria-label="Tema da aplicação"
        value={preference}
        onChange={(event) =>
          setPreference(event.target.value as ThemePreference)
        }
      >
        <option value="dark">Escuro</option>
        <option value="light">Claro</option>
        <option value="system">Sistema</option>
      </select>
    </label>
  )
}
