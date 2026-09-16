# Fiscal e preço do plano

## Requisitos confirmados

Fonte: `Cronograma Projeto Integrador VI.xlsx`, Planilha1, D3:E5. Financeiro: receitas/despesas, saldo, pendente/pago e telas conectadas à API e banco. Fiscal: alíquota fixa, cálculo automático nos pedidos/faturamentos e emissão/visualização de comprovante. Período fiscal: 15/09 a 18/09. A P1 indica vídeo de 10 minutos e pitch em 21/09 e 22/09 (linha 6). Contábil/DRE é etapa posterior (linha 7).

## Plano visual e crítica

Paleta herdada: Grafite #101112, Carvão #171819, Ardósia #2B2E30, Névoa #EDEEEF, Cinza #A0A4A8, Menta #79E2AE. Inter local: 28px título, 16px seção, 14px conteúdo, 12px apoio. Alinhamento à esquerda e valores tabulares à direita.

Alternativa descartada: um dashboard de cartões com gráficos sem dados suficientes. Escolhida: relatório fiscal com período, totais, lista de receitas e comprovante legível, acompanhado de formulário compacto. Precificação em seção própria expansível para não confundir custos previstos com lançamentos reais.

```text
[Fiscal                       Financeiro]
[aviso acadêmico / período / atualizar   ]
[bruto | imposto calculado | após imposto]
[receitas e comprovante | registrar venda]
[economia do plano: premissas e resultados]
```

No celular, lista em cartões descritivos e formulário abaixo, sem colunas comprimidas. Princípio: cada valor deve explicar sua origem. Comprovante é a única área imprimível. Sem ornamentos que sugiram validade fiscal oficial.

## Decisão de integração

As receitas de `financial_transactions` são os pedidos/faturamentos de serviço deste incremento acadêmico. O fiscal é uma projeção calculada dessa fonte única: não duplica receitas nem cria uma segunda tabela de valores divergentes. Criar uma venda grava uma receita; mudar status, editar ou excluir pelo financeiro reflete no fiscal ao atualizar. Toda receita é tratada como serviço tributável nesta simplificação. Não usar para aportes/empréstimos ou escrituração real.

Alíquota didática fixa de 6%, não informada pela professora e não representativa de um enquadramento legal. Imposto calculado por lançamento, em centavos, incluído no preço bruto. Valor após imposto = bruto − imposto; não é lucro. Imposto calculado não significa imposto recolhido: não criamos despesa paga automaticamente e não alteramos o saldo de caixa. O comprovante é uma visualização do registro atual, não um documento fiscal imutável nem prova de quitação quando o status está pendente.

API fiscal autenticada; escrita segue papéis do financeiro. O módulo exige Supabase disponível e não retorna sucesso com persistência em memória. O workspace compartilhado acadêmico existente foi preservado; isolamento multitenant e emissão NFS-e real permanecem fora do escopo.

## Proposta comercial (pesquisa em 16/09/2026)

PostFlow Essencial: R$ 79,90/mês, uma marca, proposta de franquia mensal de 100 gerações de texto e 30 gerações de imagem. Cada tentativa concluída e cada regeneração consome franquia. Não é ilimitado. Ainda não há assinatura, pagamento, medição nem bloqueio por franquia implementados.

Recomendação inicial para teste de qualidade: Gemini 3.1 Flash-Lite para texto e Gemini 3.1 Flash Lite Image para imagem 1K. Mesmo fornecedor reduz operação; qualidade de anúncios em português precisa de avaliação com exemplos reais antes da contratação. Não foi realizado benchmark pago.

Preços Standard pagos, sem descontos de batch/cache ou gratuidade, consultados em https://ai.google.dev/gemini-api/docs/pricing : texto US$ 0,25/1M entrada e US$ 1,50/1M saída; imagem Lite US$ 0,0336 por saída 1K, mais entrada e eventual texto de saída. Comparação: Gemini 2.5 Flash Image US$ 0,039 por imagem; Gemini 3.1 Flash Image cerca de US$ 0,067 por imagem 1K. Verificar disponibilidade e preços novamente na integração.

Premissas editáveis da simulação: câmbio orçado R$ 6/US$ (não cotação de mercado), 2.000 tokens de entrada e 1.000 de saída por texto; 1.000 tokens de prompt e 500 de saída textual por imagem; reserva técnica de 30%; infraestrutura R$ 10 e suporte R$ 12 por cliente/mês; processamento de pagamento hipotético de 4,99% + R$ 0,50. A alíquota didática de 6% também entra na simulação. Custos de mídia de entrada, buscas, vídeos e resolução maior não fazem parte da franquia proposta.

No uso total: texto US$ 0,20, imagem com tokens US$ 1,038; APIs com câmbio e reserva R$ 9,66. Mais infraestrutura, suporte, taxa de pagamento R$ 4,49 e imposto didático R$ 4,79: sobra de contribuição estimada R$ 38,96 (48,8%). Não é lucro líquido: ainda faltam aquisição de clientes, salários/custos fixos não rateados, inadimplência e enquadramento tributário real. Cenário de estresse deve elevar câmbio, gerações e suporte. Não gastar com APIs nem habilitar cobrança sem configuração explícita.
