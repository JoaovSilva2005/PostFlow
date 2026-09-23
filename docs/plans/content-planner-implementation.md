# Fluxo de planejamento e geração de conteúdo

## Diagnóstico do projeto

O PostFlow já tem uma agenda e um painel lateral de geração, mas o fluxo atual só cria um rascunho por chamada. No painel, a marca é apresentada como se fosse uma persona selecionável, “Próximos 7 dias” apenas altera o texto enviado ao modelo, só uma rede pode ser escolhida e o horário informado é descartado na persistência. O contrato do conteúdo também trata Carrossel, Estático e Reels como texto de prompt; a agenda não guarda as estruturas específicas de cada formato.

O projeto é um monólito modular com React/TypeScript/CSS Modules no cliente, BFF Express no servidor e Supabase/Postgres acessado somente pelo servidor. A geração já fica atrás de `ContentService`/`ContentProvider`. O fluxo de chat é uma experiência separada, com revisão de um rascunho por vez. A referência visual deve orientar a hierarquia e a interação, mantendo o sistema existente do PostFlow (grafite/carvão, acento menta e controles compactos) e a linguagem do produto em português brasileiro.

## Mudanças de escopo para o prompt

- Trocar exemplos e rótulos imobiliários por exemplos genéricos que funcionem em qualquer segmento.
- Dizer claramente que a operação cria rascunhos para revisão na agenda; não agenda/publica em redes por conta própria.
- Definir o significado de “Próximos 7 dias”: a partir de hoje e pelos seis dias seguintes, com os dias selecionados visíveis e editáveis.
- Definir a combinação: cada data selecionada × cada destino selecionado resulta em um rascunho distinto e adaptado à rede.
- Tornar explícitos persona/público, hora em formato 24 horas e fuso `America/Sao_Paulo` como dados do conteúdo, não só texto de prompt.
- Especificar a estrutura de Carrossel (sequência de slides), Estático (direção da peça) e Reels (roteiro/cenas), distinguindo conteúdo textual de mídia final renderizada.
- Incluir os seis destinos mostrados na referência (Instagram, Facebook, X / Twitter, LinkedIn, TikTok e Blog) como destinos de geração de rascunho. Isso não afirma que existam integrações de publicação.
- Cobrir limite de geração, estados de carregamento/erro/cancelamento, persistência em lote e compatibilidade de rascunhos antigos.
- Exigir responsividade, acessibilidade, feedback do total gerado e preservação do design system atual.

## Prompt de implementação

> Implemente no PostFlow um fluxo completo de planejamento e geração em lote de conteúdo para a Agenda, usando a captura enviada como referência de hierarquia e interação — não copie o segmento imobiliário nem introduza uma identidade visual diferente. Primeiro considere a arquitetura existente: React + TypeScript + CSS Modules, BFF Express, `ContentService`/`ContentProvider`, Supabase/Postgres no servidor, agenda atual e o modo demonstrativo. Preserve o visual grafite/carvão com acento menta e a linguagem em português brasileiro.
>
> Substitua o fluxo atual de um único rascunho no painel lateral por um formulário funcional com: ideia do conteúdo; público/persona opcional em texto livre; mini calendário mensal com seleção de até sete datas a partir de hoje, atalho “Próximos 7 dias” que seleciona hoje e os seis dias seguintes e ação para limpar a seleção; um horário único em formato 24 horas no fuso `America/Sao_Paulo`; escolha única entre Carrossel, Estático e Reels; seleção múltipla entre Instagram, Facebook, X / Twitter, LinkedIn, TikTok e Blog; e uma contagem em tempo real de quantos rascunhos serão criados. O total máximo é 42 (sete datas × seis destinos). Valide que haja pelo menos uma data e um destino.
>
> Gere uma variação própria para cada combinação data × destino, adaptando linguagem, tamanho e chamada para a rede escolhida sem inventar fatos, resultados, preços ou promoções. Faça uma única solicitação de lote ao provedor de texto e valide rigorosamente a correspondência e a quantidade de resultados antes de persistir. Carrossel deve retornar de 3 a 5 slides com título, texto curto e direção visual; Estático deve retornar direção visual e texto para a peça; Reels deve retornar gancho, cenas com narração/texto na tela e chamada final. Salve formato, estrutura, público, data, hora e fuso no rascunho. Mantenha o fluxo de geração individual do chat compatível.
>
> Persista a agenda em lote de forma atômica no BFF/Postgres, adapte a hora local para `scheduled_at` usando o fuso IANA escolhido, preserve rascunhos existentes e migre valores antigos para um formato padrão sem quebrar leitura. Use contratos puros compartilhados entre cliente e servidor quando ambos precisarem validar os formatos. Não mova credenciais para o cliente, não acople a página ao fornecedor de IA e não simule que houve publicação nas redes.
>
> Mostre claramente os estados de geração, cancelamento, erro recuperável e sucesso; só feche o painel depois que o lote estiver persistido. A agenda deve exibir hora e destino, e a revisão de um item deve mostrar a estrutura própria do formato. Os controles precisam funcionar com teclado e leitor de tela, manter foco no painel, desabilitar datas passadas, adaptar-se a telas pequenas e respeitar redução de movimento. Em falhas, preserve a ideia e as seleções; não mostre sucesso parcial se a persistência do lote falhar.
>
> Entregue a implementação integrada no fluxo existente, a migração incremental Supabase, um ADR que explique os limites e decisões do lote, e esta especificação. Confira compilação e o visual nos tamanhos desktop e mobile. Não adicione auto-publicação, renderização de vídeo ou upload de imagens como se já existissem; a primeira versão entrega rascunhos estruturados para revisão.

## Decisões desta entrega

- O calendário não terá um limite artificial para o mês de destino, mas cada lote aceita até sete datas e seis destinos (42 itens).
- A hora vale para todos os itens do lote. A zona de agendamento é guardada junto do instante para exibir corretamente a hora local.
- O público é texto livre associado a cada rascunho, porque o modelo atual de marca não contém catálogo de personas.
- O lote usa uma chamada estruturada de texto; os resultados são rascunhos textuais/estruturados. Não são geradas 42 imagens e nenhum vídeo é renderizado.
- O chat individual continua funcionando com o contrato legado; os metadados do novo fluxo são opcionais para registros antigos e chamadas de chat.
- Selecionar uma rede define para qual canal o rascunho será adaptado, não uma conexão de publicação.

## Modelo escolhido

Aplicação integrada e com decisão de persistência/API: GPT-6 Sol, esforço alto, conforme a skill Orchestrate. A alteração é transversal, mas está concentrada nas fronteiras já existentes; manter um único responsável reduz divergência entre contrato, UI e banco.
