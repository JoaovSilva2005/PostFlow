# Revisão com frontend-design

## Brief e plano antes da implementação

PostFlow ajuda pequenas empresas a transformar pedidos de conteúdo em rascunhos organizados por data. Preservar o estilo escuro de ferramentas como Supabase/Vercel solicitado pelo usuário. Não usar Figma nem adicionar uma biblioteca visual.

Paleta: navegação carvão #0B0C0D; fundo #101112; superfície #171819; borda #2B2E30; texto #EDEEEF; ação menta #79E2AE. Cores da marca pertencem às prévias, não à navegação.

Tipografia: manter Inter local pela legibilidade em formulários e tabelas; títulos 28–32px, texto principal 14px, apoio 12–13px. Evitar rótulos em caixa alta e texto monoespaçado decorativo. Alinhamento à esquerda; textos de apoio abaixo de 75 caracteres por linha.

Alternativa A: repetir cards e slogans genéricos. Rejeitada: não explica o planejamento editorial.

Alternativa B: mostrar o percurso real do conteúdo. Escolhida: um pequeno exemplo de semana no login e revisão editável antes de salvar no chat.

```text
Desktop: [navegação] [título + descrição                 ]
                    [pedido e conversa] [prévia + revisão]
Celular: [menu] [título] [pedido] [prévia] [revisão + salvar]
Login:   [proposta + exemplo de semana] [acesso à conta]
```

Princípios: a agenda é o destino, não um detalhe; indicar que salvar cria um rascunho, não uma publicação; estados vazios orientam uma ação; valores ainda não carregados não podem parecer saldo zero confirmado. Controles reutilizam Button e FormField; um PageHeader explícito substitui seletores estruturais frágeis.

## Crítica do plano

A paleta escura com menta é mantida por escolha explícita do usuário, não como receita da skill. A diferenciação será concentrada no exemplo editorial do login. Remover rótulos repetidos e ornamentos de versão em vez de acrescentar mais cards. A revisão do post fica no próprio fluxo, com título, legenda e data editáveis; a agenda abre no mês escolhido. Autenticação e serviços existentes são preservados; IA permanece simulada.

## Validação

Testes de funcionalidades, captura das cinco telas em 320/390/768/1024/1440px com dados fictícios e inspeção visual. Nenhuma escrita em contas ou dados reais nos testes de navegador.

## Resultado da revisão

PageHeader e EditorialSample substituem ornamentos repetidos por hierarquia explícita e um exemplo do trabalho editorial. A nova revisão do rascunho foi testada alterando título, legenda e data para outubro e verificando tanto o repositório quanto o mês aberto na agenda. O financeiro foi testado com falha de carregamento para não apresentar zero como valor confirmado. 27 testes de unidade/integração e contrato SQL aprovados; 25 combinações responsivas sem overflow ou erros de execução. Corrigida a largura da prévia em 320px após inspeção no navegador.
