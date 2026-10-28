# ADR-0008: Geração em lote para o planejador de conteúdo

## Status

Accepted — 2026-09-23

## Contexto

A Agenda tinha geração unitária e não persistia horário, fuso, público ou estrutura do formato. O painel exibia controles de data e rede que não representavam os valores realmente enviados. Uma chamada independente por data e plataforma multiplicaria latência e custo; salvar os resultados um a um também deixaria lotes parcialmente persistidos.

## Decisão

- A UI aceita até sete datas futuras e seis destinos de conteúdo por lote. Cada combinação data × destino representa um rascunho distinto, até 42.
- O BFF valida a entrada e o resultado estruturado da IA. O `ContentProvider` faz uma chamada de texto para o lote, preservando a fronteira de fornecedor atual. O chat individual permanece como caminho separado.
- Depois de salvar os rascunhos, a Agenda gera uma imagem por data e a associa a todos os destinos daquela data. O formato, a ideia central e a marca orientam a imagem; destinos diferentes não geram variações visuais nem consomem unidades adicionais.
- Os rascunhos guardam `content_format`, `format_data`, público, fuso e instante em `scheduled_at`. `scheduled_at` é formado no Postgres com `AT TIME ZONE`, e o fuso IANA também é retido para apresentação local.
- A Agenda persiste todos os itens do lote por um RPC transacional, incluindo hashtags, ou não persiste nenhum.
- A primeira versão cria conteúdo para Instagram, Facebook, X / Twitter, LinkedIn, TikTok e Blog. São destinos editoriais para rascunhos: a seleção não indica que a conta esteja conectada, nem executa publicação automática.
- Se uma imagem falhar, os rascunhos permanecem salvos e podem receber imagem pela ação manual na prévia, sem recriar o lote. Cada tentativa de imagem reserva uma unidade; falhas do provedor liberam a reserva.
- O lote não renderiza vídeo para Reels; os rascunhos mantêm o roteiro estruturado para revisão.
- Estruturas de formato usam contratos puros em `shared/`, sem dependência do React, Express ou Supabase.

## Consequências

- Um lote tem resultado e persistência determinísticos, com limite explícito de 42 itens.
- A franquia de imagem escala com as datas, não com as combinações data × destino.
- A gravação dos textos e a geração de imagens são etapas distintas; uma falha de imagem não desfaz os rascunhos já salvos.
- Formatos estruturados permitem que o editor evolua para prévias de slides e roteiros sem reinterpretar o prompt original.
- Zona e instante evitam perda do horário escolhido e mantêm a leitura correta em calendário.
- Haverá uma migração incremental de Postgres e um RPC restrito ao `service_role`; autorização e validação de workspace continuam no BFF.
- A expansão dos destinos é de geração editorial, não integração OAuth ou publicação externa.

## Alternativas consideradas

1. Fazer uma requisição por combinação: descartada por latência/custo e por tornar cancelamento e salvamento de lote mais frágeis.
2. Persistir um item por vez no cliente: descartada por poder deixar parte do lote na agenda.
3. Gerar uma imagem para cada destino: descartada porque os destinos da mesma data compartilham a direção visual e não precisam consumir franquia repetida.
4. Guardar todo o conteúdo em um único JSON opaco: descartada porque data, hora, fuso e formato precisam continuar consultáveis e editáveis.
5. Renderizar vídeo para Reels: adiada; a primeira versão gera roteiro estruturado e mantém a publicação manual.

## Validação

- Cliente e servidor validam o mesmo contrato discriminado para dados de Carrossel, Estático e Reels.
- O BFF rejeita combinações incompletas, resultados duplicados ou incompletos, datas inválidas e lotes acima de 42.
- A função SQL usa uma transação; falha em um item ou hashtag desfaz o lote inteiro.
- Verificação estática/compilação e inspeção visual desktop e mobile fazem parte da entrega.
