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
  hint?: string
  options: Array<{ label: string; value: string }>
}

export function TextField({
  label,
  error,
  hint,
  id,
  className = '',
  'aria-describedby': describedBy,
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
        {...props}
        className={`${styles.control} ${error ? styles.invalid : ''} ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={
          [describedBy, descriptionId].filter(Boolean).join(' ') || undefined
        }
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
  hint,
  options,
  id,
  className = '',
  'aria-describedby': describedBy,
  ...props
}: SelectFieldProps) {
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
      <select
        id={inputId}
        {...props}
        className={`${styles.control} ${error ? styles.invalid : ''} ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={
          [describedBy, descriptionId].filter(Boolean).join(' ') || undefined
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
