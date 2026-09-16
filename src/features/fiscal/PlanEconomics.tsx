import { useState } from 'react'
import { TextField } from '../../components/ui/FormField'
import {
  calculatePlanEconomics,
  DEFAULT_PRICING,
  ESSENTIAL_PLAN,
  type PricingAssumptions,
} from '../../domain/fiscal'
import { currency } from './fiscalApi'
import styles from './FiscalPage.module.css'

export function PlanEconomics() {
  const [assumptions, setAssumptions] =
    useState<PricingAssumptions>(DEFAULT_PRICING)
  const result = calculatePlanEconomics(assumptions)
  const fields: {
    key: keyof PricingAssumptions
    label: string
    min: number
    step: string
  }[] = [
    {
      key: 'price',
      label: 'Mensalidade simulada (R$)',
      min: 0.01,
      step: '0.01',
    },
    { key: 'texts', label: 'Gerações de texto', min: 0, step: '1' },
    { key: 'images', label: 'Gerações de imagem', min: 0, step: '1' },
    {
      key: 'exchangeRate',
      label: 'Câmbio orçado (R$/US$)',
      min: 0.01,
      step: '0.01',
    },
    {
      key: 'infrastructure',
      label: 'Infraestrutura por cliente (R$)',
      min: 0,
      step: '0.01',
    },
    { key: 'support', label: 'Suporte por cliente (R$)', min: 0, step: '0.01' },
  ]
  return (
    <section className={styles.plan} aria-labelledby="plan-title">
      <div className={styles.planIntro}>
        <div>
          <span>Proposta de plano</span>
          <h2 id="plan-title">{ESSENTIAL_PLAN.name}</h2>
          <p>
            Uma marca, {ESSENTIAL_PLAN.texts} gerações de texto e{' '}
            {ESSENTIAL_PLAN.images} de imagem por mês.
          </p>
        </div>
        <div className={styles.price}>
          {currency(ESSENTIAL_PLAN.price)}
          <small>/mês</small>
        </div>
      </div>
      <p className={styles.note}>
        Proposta, não assinatura ativa. Regenerações entram no limite. IA,
        cobrança e controle de consumo ainda não estão integrados.
      </p>
      <details className={styles.economics}>
        <summary>Entenda e simule o custo do plano</summary>
        <p>
          Texto: Gemini 3.1 Flash-Lite. Imagem: Gemini 3.1 Flash Lite Image, 1K.
          Preços Standard pagos consultados em 16/09/2026. Recomendação inicial,
          ainda sem benchmark de qualidade.
        </p>
        <div className={styles.assumptions}>
          {fields.map(({ key, label, min, step }) => (
            <TextField
              key={key}
              label={label}
              type="number"
              min={min}
              step={step}
              value={Number.isNaN(assumptions[key]) ? '' : assumptions[key]}
              onChange={(e) =>
                setAssumptions({
                  ...assumptions,
                  [key]: e.target.value === '' ? NaN : Number(e.target.value),
                })
              }
            />
          ))}
        </div>
        {result ? (
          <dl className={styles.costs} aria-live="polite">
            <div>
              <dt>APIs + reserva técnica de 30%</dt>
              <dd>{currency(result.api)}</dd>
            </div>
            <div>
              <dt>Infraestrutura + suporte</dt>
              <dd>
                {currency(assumptions.infrastructure + assumptions.support)}
              </dd>
            </div>
            <div>
              <dt>Processamento hipotético (4,99% + R$ 0,50)</dt>
              <dd>{currency(result.fee)}</dd>
            </div>
            <div>
              <dt>Imposto didático de 6%</dt>
              <dd>{currency(result.tax)}</dd>
            </div>
            <div className={styles.total}>
              <dt>Contribuição estimada (não é lucro líquido)</dt>
              <dd>
                {currency(result.contribution)}{' '}
                <small>({result.margin.toFixed(1)}%)</small>
              </dd>
            </div>
          </dl>
        ) : (
          <p role="alert">
            Informe valores válidos; mensalidade e câmbio devem ser maiores que
            zero.
          </p>
        )}
        <p className={styles.note}>
          Por texto: 2.000 tokens de entrada + 1.000 de saída. Por imagem: US$
          0,0336 + 1.000 tokens de entrada + 500 de saída textual. Tokens: US$
          0,25/1M entrada e US$ 1,50/1M saída. Câmbio é uma premissa, não
          cotação atual. Aquisição de clientes, custos fixos não rateados e
          tributos reais não estão incluídos. Mudanças aqui não alteram o preço
          do cadastro de venda.
        </p>
        <a
          href="https://ai.google.dev/gemini-api/docs/pricing"
          target="_blank"
          rel="noreferrer"
        >
          Consultar preços oficiais do Google
        </a>
      </details>
    </section>
  )
}
