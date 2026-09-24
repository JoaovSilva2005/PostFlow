import { FileDown, ShieldAlert, X } from 'lucide-react'
import type { BillingInvoice } from '../../domain/billing'
import styles from './SimulatedServiceInvoice.module.css'

const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))

interface SimulatedServiceInvoiceProps {
  invoice: BillingInvoice
  onClose: () => void
}

export function SimulatedServiceInvoice({
  invoice,
  onClose,
}: SimulatedServiceInvoiceProps) {
  const receipt = invoice.receipt
  if (!receipt) return null

  return (
    <section
      className={styles.document}
      aria-label="Nota Fiscal de Serviço eletrônica simulada"
    >
      <div className={styles.actions}>
        <button type="button" onClick={() => window.print()}>
          <FileDown size={16} aria-hidden="true" />
          Imprimir ou salvar em PDF
        </button>
        <button type="button" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          Fechar
        </button>
      </div>

      <article className={styles.paper}>
        <div className={styles.invalidBanner}>
          <ShieldAlert size={18} aria-hidden="true" />
          NFS-e sem validade jurídica · simulação acadêmica
        </div>

        <header className={styles.header}>
          <div className={styles.brandMark} aria-hidden="true">
            PF
          </div>
          <div>
            <p>Documento auxiliar da NFS-e</p>
            <h2>Nota Fiscal de Serviço eletrônica</h2>
          </div>
          <dl className={styles.documentIdentity}>
            <div>
              <dt>Número</dt>
              <dd>{receipt.documentNumber}</dd>
            </div>
            <div>
              <dt>Emissão</dt>
              <dd>{dateTime(receipt.issuedAt)}</dd>
            </div>
          </dl>
        </header>

        <div className={styles.verification}>
          <div>
            <span>Código de verificação</span>
            <strong>{receipt.verificationCode}</strong>
          </div>
          <div>
            <span>Ambiente</span>
            <strong>Simulação acadêmica</strong>
          </div>
          <div>
            <span>Referência interna</span>
            <strong>{receipt.reference}</strong>
          </div>
        </div>

        <section className={styles.block}>
          <h3>Emitente da NFS-e</h3>
          <div className={styles.partyGrid}>
            <Field label="Razão social" value={receipt.issuer.legalName} wide />
            <Field label="CNPJ simulado" value={receipt.issuer.document} />
            <Field
              label="Inscrição municipal simulada"
              value={receipt.issuer.municipalRegistration}
            />
            <Field label="Município" value={receipt.issuer.city} />
          </div>
        </section>

        <section className={styles.block}>
          <h3>Tomador do serviço</h3>
          <div className={styles.partyGrid}>
            <Field
              label="Nome / razão social"
              value={receipt.recipient.name}
              wide
            />
            <Field label="CPF / CNPJ" value={receipt.recipient.document} />
            <Field label="E-mail" value={receipt.recipient.email} />
          </div>
        </section>

        <section className={styles.block}>
          <h3>Serviço prestado</h3>
          <div className={styles.serviceGrid}>
            <Field label="Código do serviço" value={receipt.service.code} />
            <Field
              label="Município da prestação"
              value={receipt.service.municipality}
            />
            <Field
              label="Discriminação do serviço"
              value={receipt.service.description}
              wide
            />
          </div>
        </section>

        <section
          className={styles.values}
          aria-label="Valores da nota simulada"
        >
          <div>
            <span>Valor do serviço</span>
            <strong>{currency(invoice.amount)}</strong>
          </div>
          <div>
            <span>Alíquota didática</span>
            <strong>{receipt.taxRate}%</strong>
          </div>
          <div>
            <span>Imposto estimado</span>
            <strong>{currency(receipt.taxAmount)}</strong>
          </div>
          <div className={styles.netValue}>
            <span>Valor após imposto</span>
            <strong>{currency(receipt.netAmount)}</strong>
          </div>
        </section>

        <section className={styles.notes}>
          <h3>Informações complementares</h3>
          <p>
            Documento gerado exclusivamente para demonstração acadêmica. Não foi
            transmitido a prefeitura, Receita Federal ou ambiente nacional da
            NFS-e. Os números, inscrições, alíquota e código de verificação são
            simulados e não produzem efeitos fiscais.
          </p>
          <p>
            Pagamento simulado da fatura {invoice.number}. Nenhum valor
            financeiro real foi movimentado.
          </p>
        </section>

        <footer>
          Representação visual inspirada no DANFSe para fins de protótipo. QR
          Code não gerado em ambiente simulado.
        </footer>
      </article>
    </section>
  )
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? styles.wide : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
