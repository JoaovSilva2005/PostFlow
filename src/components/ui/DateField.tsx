import { useId, type InputHTMLAttributes } from 'react'
import { formatDatePtBr, formatDatePtBrNumeric } from '../../domain/dates'
import styles from './DateField.module.css'

interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  value: string
}

export function DateField({ label, value, id, className = '', ...props }: DateFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={`${styles.field} ${className}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className={styles.controlWrap}>
        <input id={inputId} type="date" value={value} {...props} />
        <span className={styles.dateDisplay} aria-hidden="true">
          {formatDatePtBrNumeric(value)}
        </span>
      </div>
      <span className={styles.readableDate} aria-live="polite">
        {formatDatePtBr(value)}
      </span>
    </div>
  )
}
