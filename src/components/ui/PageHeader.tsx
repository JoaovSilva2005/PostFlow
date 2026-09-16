import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  description: string
  children?: ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </header>
  )
}
