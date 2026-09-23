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

## Refinamento da jornada principal — setembro de 2026

Modo **Operar**: criação, revisão e localização do rascunho devem ser compreensíveis sem conhecer o funcionamento interno do serviço. A direção Grafite/Carvão, Inter local e Menta permanece. A cor da marca aparece no conteúdo de prévia, não na navegação. As capturas em `docs/screenshots/responsive/` foram usadas como referência visual atual.

| Antes | Depois | Motivo |
| --- | --- | --- |
| A aba móvel indicava o rascunho por um ponto discreto. | A aba anuncia “Rascunho pronto” e abre após uma resposta gerada. | A próxima ação fica visível sem procurar em outra aba. |
| Datas nativas podiam aparecer como mês/dia/ano. | Um controle compartilhado mostra `dd/mm/aaaa` e a data extensa em português, mantendo o seletor nativo e o valor ISO. | A leitura da data deixa de depender da localidade do navegador. |
| “Gerar conteúdo” abria uma etapa de configuração. | “Configurar geração” nomeia a etapa que se abre. | A ação corresponde ao resultado imediato. |
| O total do mês vinha junto à legenda “Rascunho”, mesmo com posts agendados. | O total descreve apenas “posts no mês”. | O número deixa de atribuir um estado incorreto aos itens. |
| O menu móvel empurrava a página e expunha rótulos técnicos. | O menu abre como painel sobre a página; os papéis recebem nomes legíveis e o estado dos serviços só aparece para administração ou em falha. | A navegação mantém o contexto da tarefa. |

### Convenções para novas telas

- Manter `src/features/*` para telas e lógica de cada área, com CSS Modules locais. Componentes realmente compartilhados ficam em `src/components/ui/`; tokens comuns ficam em `src/styles/tokens.css`. Não converter variações locais em abstrações globais sem repetição comprovada.
- Reutilizar `PageHeader`, `Button`, `FormField` e `DateField` quando a semântica corresponder. A cor Menta indica ação primária, seleção e estado; botões secundários e superfícies de apoio permanecem neutros.
- Nomear botões pelo próximo passo real. Distinguir “gerar”, “revisar”, “adicionar à agenda” e “publicar”. O texto de confirmação só declara algo salvo após o sucesso da persistência.
- Datas persistem como `YYYY-MM-DD`; a interface apresenta `pt-BR`. Preservar o controle nativo para seleção e teclado. Conferir também a leitura da data em novos formulários, diálogos e barras laterais.
- Preferir uma hierarquia por tarefa: contexto compacto, área principal de trabalho, estado e ação. Estados vazios indicam um caminho; erros preservam edições e explicam recuperação. Foco visível, alvos de toque confortáveis e movimento curto com `prefers-reduced-motion` são parte do componente.
- A navegação traduz nomes de papel para linguagem de produto. Status de infraestrutura aparece apenas se for acionável pelo usuário ou relevante para a administração.

### Próximos focos

- `billing`: distinguir situação da assinatura, ação necessária e histórico de cobrança sem prometer efeitos antes de confirmação.
- `finance`: manter estados de carregamento e falha distintos de valores zero; priorizar leitura de período e origem dos valores.
- `fiscal`: tornar filtros, situação dos documentos e ações de emissão fáceis de examinar em telas estreitas.
- `admin/plans`: revisar a densidade da tabela, validação de valores e estilos inline existentes em `AdminPlansPage.tsx` quando essa tela entrar no escopo.
- Autenticação: revisar mensagens de erro e recuperação de acesso, mantendo a proposta editorial já presente no login.

Esta rodada altera apenas apresentação e navegação da jornada principal. Nenhum teste foi adicionado ou executado nesta rodada.
