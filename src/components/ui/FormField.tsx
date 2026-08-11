import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react'
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

export function TextField({
  label,
  error,
  hint,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? props.name ?? generatedId
  const descriptionId = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`${styles.control} ${error ? styles.invalid : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      />
      {hint && !error ? (
        <span id={descriptionId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={descriptionId} className={styles.error}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function SelectField({
  label,
  error,
  options,
  id,
  ...props
}: SelectFieldProps) {
  const generatedId = useId()
  const inputId = id ?? props.name ?? generatedId
  const descriptionId = error ? `${inputId}-error` : undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <select
        id={inputId}
        className={`${styles.control} ${error ? styles.invalid : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span id={descriptionId} className={styles.error}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
