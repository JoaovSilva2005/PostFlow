# Roteiro de conferência para a apresentação

Verificações em 05/10 e 06/10/2026 no endereço https://post-flow-ochre.vercel.app/.
Navegação feita em sessão administrativa existente, sem simular as respostas da
API e sem cadastrar, editar ou excluir lançamentos nesta verificação.

## Conferir os dados que já existem

1. Entre com uma conta administrativa da plataforma.
2. Abra **Financeiro**: foram observados 12 lançamentos persistidos, receitas
   pagas de R$ 4.059,30, despesas pagas de R$ 800,00 e saldo de R$ 3.259,30.
   Há três pendências: R$ 1.279,90 a receber e R$ 450,00 a pagar.
3. Abra **Fiscal** e selecione **09/2026** em **Período por vencimento**.
   Se necessário, clique em **Sincronizar**.
4. Confira sete registros, vendas e recebido de R$ 559,30, a receber de
   R$ 0,00, imposto de R$ 33,53 e valor após imposto de R$ 525,77.
5. Abra **Ver comprovante** em uma receita de assinatura de R$ 79,90.
   Confira imposto de R$ 4,79, líquido de R$ 75,11 e situação Pago.
6. Selecione **10/2026**: os totais são zero porque não existem lançamentos
   com vencimento em outubro no banco consultado. Volte para setembro para
   apresentar os registros existentes.

O Financeiro apresenta todos os lançamentos e seu saldo considera pagamentos.
O Fiscal considera o mês do vencimento e as receitas identificadas como venda
de serviço ou receita de assinatura. Receitas classificadas como `manual`
não entram no Fiscal nem nas vendas da DRE. Há registros antigos descritos
como serviços/assinaturas que continuam classificados como `manual`; esta
verificação não reclassificou esses dados.

## Conferir a DRE publicada

**Contábil** foi publicado em 06/10/2026. Abra `/admin/accounting`, selecione
**09/2026** e, se necessário, use **Sincronizar**. A tela consultou a API e
o PostgreSQL reais, em sessão administrativa existente, e retornou:

| Item                        |       Valor |
| --------------------------- | ----------: |
| Vendas                      |   R$ 559,30 |
| Impostos                    |    R$ 33,53 |
| Receita após imposto        |   R$ 525,77 |
| Despesas, pagas e pendentes | R$ 1.250,00 |
| Resultado                   |  −R$ 724,23 |
| Receitas manuais excluídas  | R$ 4.779,90 |

Esses valores foram conferidos no deployment publicado em 06/10/2026.
Saldo de caixa e resultado da DRE diferem pelas receitas excluídas e pela
inclusão de despesas pendentes na competência por vencimento.

## Demonstrar uma nova venda e uma despesa

Em um mês reservado para demonstração:

1. No Fiscal, registre uma venda de serviço de R$ 100,00, com descrição clara
   de demonstração e vencimento no mês escolhido. Ela deve aparecer também
   no Financeiro, usando o mesmo lançamento.
2. No Financeiro, cadastre uma despesa de R$ 50,00, também com descrição de
   demonstração e vencimento nesse mês.
3. No Contábil, selecione o mesmo mês e sincronize. Os acréscimos esperados
   são R$ 100,00 em vendas, R$ 6,00 em impostos, R$ 50,00 em despesas e
   R$ 44,00 no resultado, em relação aos valores anteriores.
4. Altere a despesa para R$ 150,00 e sincronize. O acréscimo do resultado
   passa a −R$ 56,00. Marcar a venda como paga altera o caixa/recebido, mas
   não a competência da DRE.

Registre somente os dados de demonstração que deseja manter no banco. Os
verificadores automatizados anteriores usaram registros temporários que
foram removidos; eles não criam uma base permanente para apresentar.
