# Fiscal e preço do plano

## Requisitos confirmados

Fonte: `Cronograma Projeto Integrador VI.xlsx`, Planilha1, D3:E5. Financeiro: receitas/despesas, saldo, pendente/pago e telas conectadas à API e banco. Fiscal: alíquota fixa, cálculo automático nos pedidos/faturamentos e emissão/visualização de comprovante. Período fiscal: 15/09 a 18/09. A P1 indica vídeo de 10 minutos e pitch em 21/09 e 22/09 (linha 6). Contábil/DRE é etapa posterior (linha 7).

## Plano visual e crítica

Paleta herdada: Grafite #101112, Carvão #171819, Ardósia #2B2E30, Névoa #EDEEEF, Cinza #A0A4A8, Menta #79E2AE. Inter local: 28px título, 16px seção, 14px conteúdo, 12px apoio. Alinhamento à esquerda e valores tabulares à direita.

Alternativa descartada: um dashboard de cartões com gráficos sem dados suficientes. Escolhida: relatório fiscal interno com período, totais, lista de receitas e comprovante legível. A precificação fica na área administrativa `Planos e custos`, separada do Fiscal para não confundir premissas com lançamentos reais.

```text
[Fiscal                       Financeiro]
[aviso acadêmico / período / atualizar   ]
[bruto | imposto calculado | após imposto]
[receitas e comprovante | registrar venda]
```

No celular, lista em cartões descritivos e formulário abaixo, sem colunas comprimidas. Princípio: cada valor deve explicar sua origem. Comprovante é a única área imprimível. Sem ornamentos que sugiram validade fiscal oficial.

## Decisão de integração

A fatura de assinatura é a origem da cobrança. Sua confirmação de pagamento cria ou atualiza exatamente uma receita em `financial_transactions`, usando uma chave idempotente. Apenas receitas marcadas como venda ou serviço faturado alimentam o Fiscal. Despesas, empréstimos, aportes e outras receitas não geram imposto automaticamente.

Alíquota didática configurada inicialmente em 6%, não informada pela professora e não representativa de um enquadramento legal. Imposto calculado no backend, em centavos, incluído no preço bruto. Valor após imposto = bruto − imposto; não é lucro. Imposto calculado não significa imposto recolhido e não altera o saldo de caixa. O comprovante guarda um snapshot de alíquota, bruto, imposto e líquido para que documentos antigos não mudem quando a configuração mudar.

APIs `/api/admin/finance` e `/api/admin/fiscal` exigem `PlatformRole`. `platform_owner` e `finance_admin` escrevem; `support` recebe somente leitura. Clientes consultam exclusivamente `/api/workspaces/:workspaceId/billing` e `/invoices`, depois de o backend validar `brand_members`. O modo demonstrativo é identificado na interface. Não há emissão de NFS-e nem promessa de validade legal.

## Proposta comercial (pesquisa em 16/09/2026)

PostFlow Essencial: R$ 79,90/mês, uma marca, proposta de franquia mensal de 100 gerações de texto e 30 gerações de imagem. Cada tentativa concluída e cada regeneração consome franquia. Não é ilimitado. Ainda não há assinatura, pagamento, medição nem bloqueio por franquia implementados.

Recomendação inicial para teste de qualidade: Gemini 3.1 Flash-Lite para texto e Gemini 3.1 Flash Lite Image para imagem 1K. Mesmo fornecedor reduz operação; qualidade de anúncios em português precisa de avaliação com exemplos reais antes da contratação. Não foi realizado benchmark pago.

Preços Standard pagos, sem descontos de batch/cache ou gratuidade, consultados em https://ai.google.dev/gemini-api/docs/pricing : texto US$ 0,25/1M entrada e US$ 1,50/1M saída; imagem Lite US$ 0,0336 por saída 1K, mais entrada e eventual texto de saída. Comparação: Gemini 2.5 Flash Image US$ 0,039 por imagem; Gemini 3.1 Flash Image cerca de US$ 0,067 por imagem 1K. Verificar disponibilidade e preços novamente na integração.

Premissas editáveis da simulação: câmbio orçado R$ 6/US$ (não cotação de mercado), 2.000 tokens de entrada e 1.000 de saída por texto; 1.000 tokens de prompt e 500 de saída textual por imagem; reserva técnica de 30%; infraestrutura R$ 10 e suporte R$ 12 por cliente/mês; processamento de pagamento hipotético de 4,99% + R$ 0,50. A alíquota didática de 6% também entra na simulação. Custos de mídia de entrada, buscas, vídeos e resolução maior não fazem parte da franquia proposta.

No uso total: texto US$ 0,20, imagem com tokens US$ 1,038; APIs com câmbio e reserva R$ 9,66. Mais infraestrutura, suporte, taxa de pagamento R$ 4,49 e imposto didático R$ 4,79: sobra de contribuição estimada R$ 38,96 (48,8%). Não é lucro líquido: ainda faltam aquisição de clientes, salários/custos fixos não rateados, inadimplência e enquadramento tributário real. Cenário de estresse deve elevar câmbio, gerações e suporte. Não gastar com APIs nem habilitar cobrança sem configuração explícita.
