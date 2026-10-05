# Módulo Contábil — DRE simples

Entrega do Épico 5 do cronograma de Projeto Integrador VI, validada em 05/10/2026.

## Usar

1. Entre com uma conta administrativa da plataforma.
2. Abra **Contábil** no menu (`/admin/accounting`).
3. Selecione o mês por vencimento e consulte a DRE e seus lançamentos de origem.
4. Cadastre vendas no Fiscal e despesas operacionais no Financeiro.
5. Volte ao Contábil ou use **Sincronizar** após alterar as fontes.
6. Use **Imprimir DRE** para imprimir ou salvar em PDF pelo navegador.

Clientes comuns não acessam dados internos. `platform_owner`, `finance_admin`
e `support` podem consultar; lançamentos permanecem nos módulos de origem.

## Regra e contrato

**Vendas − Impostos − Despesas = Lucro/Prejuízo.**

- Vendas: receitas `sale_service` e `subscription_revenue`.
- Impostos: cálculo existente no Fiscal, 6% acadêmicos, arredondado por venda.
- Despesas: lançamentos `expense` do Financeiro.
- Período: mês de `due_date`, incluindo pagos e pendentes. Trata-se de competência
  simplificada; não é o saldo de caixa nem escrituração contábil legal.
- Receitas manuais, como aportes, são identificadas como excluídas da DRE.
- Soma em centavos; lucro positivo, prejuízo negativo e resultado zero.
- Não cadastrar os impostos já estimados pelo Fiscal novamente como despesas
  operacionais. Custos estimados de IA não entram sem lançamento financeiro.

API: `GET /api/admin/accounting/report?period=2026-10`. Resposta em `data` com
`period`, `basis`, `storage`, `taxRate`, `totals`, `outcome`, `sales`, `expenses`
e `excludedIncome`. Períodos inválidos retornam 400, anônimo 401 e cliente 403.
Falhas de banco retornam erro; a interface limpa os totais anteriores e oferece
nova consulta. Quando o fallback demonstrativo está habilitado, a tela o indica.

## Integração

React → API Express → `FinancialService` → repositório Supabase → PostgreSQL
`financial_transactions`. O relatório é calculado na consulta e reutiliza o
domínio Fiscal em `shared/`. Não requer nova tabela ou migração, pois usa a fonte
financeira persistida. A paginação lê todas as linhas, com ordenação estável.
Decisão: [ADR-0011](adr/ADR-0011-derived-accounting-report.md).

## Verificar

```sh
npm test
npm run build
npx tsx scripts/api/verifyAccounting.ts
# Inicie o frontend na porta 5174 antes da verificação visual:
npx vite --host 127.0.0.1 --port 5174 --strictPort
node scripts/accounting-ui-check.cjs
# Fluxo completo no navegador com API e banco reais:
npx tsx scripts/api/verifyAccountingBrowser.ts
```

A verificação real usa a service role somente no servidor, rotas reais e
autenticação controlada para não depender de credenciais pessoais. Cria dois
registros temporários em dezembro de 2099, verifica cálculo/edição/status e
remove somente esses IDs no `finally`. O teste visual usa fixtures de rede;
a prova de persistência real é o verificador PostgreSQL separado.

O verificador `verifyAccountingBrowser.ts` integra navegador, API Express e
PostgreSQL reais. Cadastre e edite venda/despesa pela tela, confira a DRE, altere
status e exclua somente os registros de teste. O script usa dezembro de 2098 e
confere que os totais retornam ao estado anterior. Sessão e lista de marcas usam
fixtures de autenticação; as operações financeiras não usam fixtures.

## Rastreabilidade

- [Épico SCRUM-61](https://joaovsilva3530.atlassian.net/browse/SCRUM-61)
- [Backend SCRUM-62](https://joaovsilva3530.atlassian.net/browse/SCRUM-62)
- [Frontend SCRUM-63](https://joaovsilva3530.atlassian.net/browse/SCRUM-63)
- [Auditoria SCRUM-64](https://joaovsilva3530.atlassian.net/browse/SCRUM-64)
- [Confluence: Módulo Contábil e Auditoria](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/24281089)
- [Evidências locais](accounting-audit-2026-10-05.md)

Implementação e validação locais. A publicação em produção não foi realizada
nesta entrega; os dados de validação real foram removidos do banco.
