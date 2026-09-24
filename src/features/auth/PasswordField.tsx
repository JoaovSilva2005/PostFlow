import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { TextField } from '../../components/ui/FormField'
import styles from './PasswordField.module.css'

interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: string
  error?: string
  hint?: string
}

export function PasswordField({
  label,
  error,
  hint,
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={styles.wrapper}>
      <TextField
        {...props}
        label={label}
        type={isVisible ? 'text' : 'password'}
        error={error}
        hint={hint}
      />
      <button
        type="button"
        disabled={props.disabled}
        className={styles.toggle}
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={`${isVisible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
        aria-pressed={isVisible}
      >
        {isVisible ? (
          <EyeOff size={17} aria-hidden="true" />
        ) : (
          <Eye size={17} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
