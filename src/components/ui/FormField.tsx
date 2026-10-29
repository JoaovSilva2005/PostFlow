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
  optional?: boolean
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  optional?: boolean
  /** Shown as an empty, non-selectable first option while value is ''. */
  placeholder?: string
  options: Array<{ label: string; value: string }>
}

function FieldLabel({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string
  label: string
  optional?: boolean
}) {
  return (
    <div className={styles.labelRow}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {optional ? <span className={styles.optional}>Opcional</span> : null}
    </div>
  )
}

export function TextField({
  label,
  error,
  hint,
  optional,
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
      <FieldLabel htmlFor={inputId} label={label} optional={optional} />
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
  hint,
  optional,
  placeholder,
  options,
  id,
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
      <FieldLabel htmlFor={inputId} label={label} optional={optional} />
      <select
        id={inputId}
        className={`${styles.control} ${error ? styles.invalid : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
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
