# ADR-0011: DRE derivada do Financeiro e Fiscal

## Status

Accepted — 2026-10-05

## Contexto

O Épico 5 do cronograma exige Vendas − Impostos − Despesas = Lucro/Prejuízo.
Financeiro e Fiscal já usam `financial_transactions` no PostgreSQL, com receitas
de assinaturas e vendas identificadas por `source_type`. Não existia DRE.

## Decisão

Criar um módulo contábil de consulta no BFF, restrito às roles de plataforma
`platform_owner`, `finance_admin` e `support`. O frontend consome o relatório
calculado pelo servidor; não acessa o banco diretamente.

A DRE usa competência simplificada: mês de `due_date`, incluindo pendentes e
pagos. Vendas incluem somente `sale_service` e `subscription_revenue`; receitas
manuais (por exemplo, aportes) aparecem como excluídas. Impostos reutilizam o
Fiscal e seu arredondamento por venda a 6% acadêmicos. Despesas incluem os
lançamentos `expense` do Financeiro. Totais são somados em centavos.

O relatório é derivado em cada consulta, sem tabela de totais, trigger ou cópia
dos lançamentos. Assim não há migração de schema necessária nem duplicação de
receitas. A consulta paginada evita o limite padrão de linhas do Supabase.

## Consequências

- Alterações e exclusões na origem refletem na próxima consulta da DRE.
- Saldo de caixa e resultado contábil têm critérios explicitamente diferentes.
- Despesas com impostos estimados pelo Fiscal não devem ser lançadas novamente
  como despesas operacionais, pois isso duplicaria a dedução.
- Custos estimados do simulador e ledger de IA não são despesas financeiras
  automaticamente: a DRE usa as despesas efetivamente cadastradas no Financeiro.
- Relatório acadêmico simplificado; não substitui escrituração legal.
- A paginação não constitui snapshot transacional entre páginas. Em volumes
  maiores ou com escrita concorrente intensa, adotar agregação SQL atômica.

## Validação

Testes de lucro, prejuízo, zero, limites de mês, centavos, receitas excluídas,
permissões e falhas. Teste integrado cria venda no Fiscal, despesa no Financeiro,
consulta DRE e verifica alterações/exclusões. Validar também consulta real ao
PostgreSQL e navegação responsiva na interface.
