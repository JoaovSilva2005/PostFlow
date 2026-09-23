# ADR-0008: Geração em lote para o planejador de conteúdo

## Status

Accepted — 2026-09-23

## Contexto

A Agenda tinha geração unitária e não persistia horário, fuso, público ou estrutura do formato. O painel exibia controles de data e rede que não representavam os valores realmente enviados. Uma chamada independente por data e plataforma multiplicaria latência e custo; salvar os resultados um a um também deixaria lotes parcialmente persistidos.

## Decisão

- A UI aceita até sete datas futuras e seis destinos de conteúdo por lote. Cada combinação data × destino representa um rascunho distinto, até 42.
- O BFF valida a entrada e o resultado estruturado da IA. O `ContentProvider` faz uma chamada de texto para o lote, preservando a fronteira de fornecedor atual. O chat individual permanece como caminho separado.
- Os rascunhos guardam `content_format`, `format_data`, público, fuso e instante em `scheduled_at`. `scheduled_at` é formado no Postgres com `AT TIME ZONE`, e o fuso IANA também é retido para apresentação local.
- A Agenda persiste todos os itens do lote por um RPC transacional, incluindo hashtags, ou não persiste nenhum.
- A primeira versão cria conteúdo para Instagram, Facebook, X / Twitter, LinkedIn, TikTok e Blog. São destinos editoriais para rascunhos: a seleção não indica que a conta esteja conectada, nem executa publicação automática.
- A geração em lote entrega texto e estrutura de formato. Ela não replica geração de imagem por item nem renderiza vídeo; esses ativos e o ciclo de mídia exigem evolução própria.
- Estruturas de formato usam contratos puros em `shared/`, sem dependência do React, Express ou Supabase.

## Consequências

- Um lote tem resultado e persistência determinísticos, com limite explícito de 42 itens.
- Formatos estruturados permitem que o editor evolua para prévias de slides e roteiros sem reinterpretar o prompt original.
- Zona e instante evitam perda do horário escolhido e mantêm a leitura correta em calendário.
- Haverá uma migração incremental de Postgres e um RPC restrito ao `service_role`; autorização e validação de workspace continuam no BFF.
- A expansão dos destinos é de geração editorial, não integração OAuth ou publicação externa.

## Alternativas consideradas

1. Fazer uma requisição por combinação: descartada por latência/custo e por tornar cancelamento e salvamento de lote mais frágeis.
2. Persistir um item por vez no cliente: descartada por poder deixar parte do lote na agenda.
3. Guardar todo o conteúdo em um único JSON opaco: descartada porque data, hora, fuso e formato precisam continuar consultáveis e editáveis.
4. Gerar imagem/vídeo para cada item já nesta etapa: descartada por multiplicar custo e exigir um ciclo de armazenamento/revisão de mídia ainda inexistente.

## Validação

- Cliente e servidor validam o mesmo contrato discriminado para dados de Carrossel, Estático e Reels.
- O BFF rejeita combinações incompletas, resultados duplicados ou incompletos, datas inválidas e lotes acima de 42.
- A função SQL usa uma transação; falha em um item ou hashtag desfaz o lote inteiro.
- Verificação estática/compilação e inspeção visual desktop e mobile fazem parte da entrega.
