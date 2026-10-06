# Auditoria da entrega final — 06/10/2026

## Resultado

**Entrega acadêmica ainda com pendências.** Financeiro e Fiscal estão publicados
e o banco responde. Contábil/DRE está implementado e testado no código local,
mas não está disponível na publicação consultada. O login real da conta de
apresentação em uma sessão nova ainda precisa ser concluído. Vídeo final e
apresentação não foram disponibilizados para conferência.

## Critérios da professora

Fonte: `Cronograma Projeto Integrador VI.xlsx`, `Planilha1`, linhas 3 a 8.

| Requisito                                                                                   | Evidência e estado                                                                                                      |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Financeiro: receitas/despesas, saldo e status pendente/pago; front, back e banco integrados | Implementado; 12 lançamentos carregados na publicação em sessão administrativa existente                                |
| Fiscal: alíquota fixa, imposto automático e comprovante de venda                            | Implementado; setembro carregou sete vendas e o comprovante abriu                                                       |
| Contábil: Vendas − Impostos − Despesas = Lucro/Prejuízo, alimentado automaticamente         | Implementado e testado localmente; ausente na publicação consultada                                                     |
| Auditoria do fluxo e testes de ponta a ponta                                                | Testes com dados reais documentados em 05/10; autenticação controlada nesse fluxo; login real em contexto novo pendente |
| Governança no Jira/Confluence                                                               | Requisitos, implementação, testes e pendências documentados; versões antigas precisam ser lidas com suas datas          |
| Vídeo + Apresentação                                                                        | Material não disponibilizado para revisão                                                                               |

A linha 8 indica período de atividades **05/10 e 06/10**, entrega
**05/10/2026** e **Entrega Final (Vídeo + Apresentação)**. Não especifica
duração do vídeo. Os dez minutos estão na linha 6, referente à P1 de setembro.
Hoje é 06/10: confirmar com a professora o prazo aceito e o canal de entrega.

## Código, GitHub e Vercel

- Endereço usado: https://post-flow-ochre.vercel.app/.
- Asset publicado observado: `/assets/index-CUEX2vGN.js`.
- GitHub `main`, consultado por `git ls-remote`: `c975967c24e1ac5ce535efbd2bb86b16b4dcc98e`.
- Os commits de DRE `9a74063`, `14d15d6`, `e3ba9bb` e seus testes/documentos
  posteriores continuam locais.
- O menu publicado não contém Contábil; `/admin/accounting` volta para
  Minha marca. A implementação local não comprova a publicação.
- Existem alterações anteriores não commitadas no workspace. Elas foram
  preservadas e não fazem parte do candidato isolado validado nesta auditoria.

Antes da apresentação da DRE, publicar os commits selecionados e validar
menu, acesso direto, integração financeira e impressão no deployment final.
Nenhum push ou deploy foi executado nesta auditoria.

## Verificações em 06/10

| Verificação                                                | Resultado                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Workspace atual                                            | 232 testes em 48 arquivos aprovados                                                            |
| Contrato PostgreSQL e inventário do workspace              | Aprovados; 21 migrações                                                                        |
| Build do workspace                                         | Aprovado; aviso de chunk maior que 500 kB                                                      |
| Lint global                                                | Sem erros; avisos em scripts antigos de skills                                                 |
| Candidato isolado dos commits, sem alterações anteriores   | 211 testes em 43 arquivos aprovados                                                            |
| Contrato, inventário e build do candidato                  | Aprovados; 17 migrações                                                                        |
| `/api/health` e `/api/health/ready` publicados             | HTTP 200, Supabase e banco conectado                                                           |
| `/api/auth/me` e resumo financeiro sem sessão              | HTTP 401, acesso recusado                                                                      |
| Login com credenciais fictícias e origem do site publicado | HTTP 401 com mensagem de credenciais inválidas; não houve rejeição de origem                   |
| Conta da apresentação no banco                             | E-mail confirmado, `platform_owner` e membership `owner`                                       |
| Login com senha real em navegador limpo                    | Pendente de entrada manual pelo usuário; não foi usada senha fictícia como prova de login real |

Logs e artefatos ignorados pelo Git em `output/`: `delivery-tests-2026-10-06.log`,
`delivery-build-2026-10-06.log`, `delivery-lint-2026-10-06.log`,
`delivery-candidate-tests-2026-10-06.log`, `delivery-candidate-build-2026-10-06.log`
e `delivery-deployment-2026-10-06.json`. A sessão já aberta no navegador está
identificada como administrador; ela não comprova login novo da conta pessoal.

## Números para demonstrar

Use **09/2026** no Fiscal e no Contábil. Não há lançamentos em outubro na
base consultada. As contas refletem a situação observada e podem mudar com
novos registros.

| Item                                                 |                    Valor |
| ---------------------------------------------------- | -----------------------: |
| Vendas reconhecidas pelo Fiscal/DRE                  | R$ 559,30, sete receitas |
| Imposto acadêmico, 6% arredondado por venda          |                 R$ 33,53 |
| Após imposto                                         |                R$ 525,77 |
| Despesas pagas e pendentes do mês                    |              R$ 1.250,00 |
| Resultado DRE, conferido na API local com banco real |               −R$ 724,23 |
| Receitas manuais excluídas das vendas da DRE         |              R$ 4.779,90 |
| Saldo financeiro de caixa                            |              R$ 3.259,30 |

O saldo usa receitas/despesas pagas e inclui receitas manuais; a DRE usa o
mês de vencimento, as origens de venda e despesas pagas ou pendentes. Há
registros antigos com descrição de serviço/assinatura classificados como
`manual`. Não reclassificar por descrição automaticamente. Para uma nova
demonstração de venda integrada, cadastre-a no Fiscal.

## Login em outro computador

1. Abra o endereço publicado em uma janela anônima de Chrome ou Edge.
2. Entre com a conta administrativa já confirmada; não crie uma conta nova
   esperando permissões administrativas.
3. Confira Financeiro e Fiscal no menu; após a publicação da DRE, confira
   também Contábil. Recarregue e abra as rotas diretamente.
4. Selecione setembro nos relatórios. Cadastro novo, confirmação por e-mail
   e recuperação de senha são fluxos diferentes do login normal.
5. Use o mesmo domínio durante a demonstração: cookies de sessão são
   específicos do domínio. Mudanças entre aliases exigem novo login.

As permissões são resolvidas pelo backend a partir de `platform_members` e
`brand_members`, sem depender de localStorage no computador da apresentação.
Os cookies são HttpOnly, SameSite=Lax e Secure em produção no código. Não
expor senha no chat, documentação ou logs. Uma conta sem workspace pode abrir
diretamente `/admin/finance`; rotas de marca/conteúdo exigem membership.

## Limites da demonstração

Pagamento, imposto e documentos fiscais são acadêmicos. Publicação automática
nas redes não está implementada. Credenciais e chamadas reais de IA e SMTP
precisam de validação específica no ambiente publicado; os testes com providers
controlados não atestam esses serviços. A auditoria acadêmica não é uma
certificação de prontidão para clientes reais.

## Roteiro

Mostre login, menus administrativos, Financeiro, Fiscal em setembro, comprovante
e DRE no mesmo mês depois de publicar. Explique a diferença entre caixa e
resultado. Use [o roteiro detalhado](roteiro-apresentacao-financeiro-fiscal-contabil.md)
para a demonstração com venda de R$ 100 e despesa de R$ 50.
