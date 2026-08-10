import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import styles from './FormField.module.css'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: Array<{ label: string; value: string }>
}

export function TextField({ label, error, hint, id, ...props }: TextFieldProps) {
  const inputId = id ?? props.name
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.label}>{label}</span>
      <input id={inputId} className={`${styles.control} ${error ? styles.invalid : ''}`} {...props} />
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  )
}

export function SelectField({ label, error, options, id, ...props }: SelectFieldProps) {
  const inputId = id ?? props.name
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span className={styles.label}>{label}</span>
      <select id={inputId} className={`${styles.control} ${error ? styles.invalid : ''}`} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className={styles.error}>{error}</span> : null}
    </label>
  )
}
