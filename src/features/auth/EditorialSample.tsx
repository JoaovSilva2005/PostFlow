import { CalendarDays, MessageSquareText, Image } from 'lucide-react'
import styles from './EditorialSample.module.css'

const contentIdeas = [
  {
    day: 'Seg',
    title: 'Uma novidade da marca',
    detail: 'Apresentar',
    icon: MessageSquareText,
  },
  {
    day: 'Qua',
    title: 'Por trás do produto',
    detail: 'Aproximar',
    icon: Image,
  },
  {
    day: 'Sex',
    title: 'Uma dica para o público',
    detail: 'Compartilhar',
    icon: CalendarDays,
  },
]

/** An illustrative plan, not a preview of the user's private account. */
export function EditorialSample() {
  return (
    <section
      className={styles.sample}
      aria-label="Exemplo de planejamento editorial"
    >
      <header>
        <span>Da ideia à semana planejada</span>
        <small>Exemplo</small>
      </header>
      <ol className={styles.week}>
        {contentIdeas.map(({ day, title, detail, icon: Icon }) => (
          <li key={day}>
            <span className={styles.day}>{day}</span>
            <div className={styles.content}>
              <Icon size={18} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <p>Você revisa cada rascunho. Nada é publicado automaticamente.</p>
    </section>
  )
}
