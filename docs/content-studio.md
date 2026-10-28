# Estúdio de criação

## Direção visual antes da implementação

Público: pequenas empresas que precisam transformar um briefing em um rascunho revisável. O foco é o conteúdo, não uma vitrine de funcionalidades.

Paleta: fundo Grafite `#101112`, superfície Carvão `#171819`, borda Ardósia `#2B2E30`, texto Névoa `#EDEEEF`, secundário Cinza `#A0A4A8`, ação Menta `#79E2AE`. Mantemos o tema escuro solicitado e a identidade existente. Inter local: título 28px/600, subtítulos 16px/500, conteúdo 14px/400, apoio 12px/400. Alinhamento à esquerda; texto limitado a aproximadamente 70 caracteres por linha.

Alternativa A: conversa e formulário empilhados. Simples, mas a revisão fica longe do pedido e produz uma página longa.

```text
[briefing]
[conversa]
[prévia]
[formulário]
```

Alternativa B (escolhida): estúdio dividido, com briefing compacto e revisão alternável. No celular, botões alternam conversa e rascunho sem encolher as duas colunas.

```text
Desktop                         Celular
[Criar com IA         modo]     [Criar com IA]
[marca / rede / data     ]     [Conversa | Rascunho]
[conversa  | Prévia / Editar]   [painel selecionado]
[pedido    | conteúdo       ]   [ação contextual]
[gerar     | salvar         ]
```

Crítica: um painel genérico de chat não explica o trabalho editorial. A diferença escolhida é a bancada de revisão ao lado da conversa, com refinamento do rascunho atual, marca e data reais. Removemos cartões repetidos e etiquetas decorativas. Verde apenas para ações e estado; a peça do post usa a cor da marca.

Princípios: mostrar o que será salvo; preservar ajustes em falhas; separar gerar de publicar; não esconder simulação; interface e serviços independentes. A conversa é temporária e a agenda continua sendo a persistência do conteúdo aprovado.

## Integração de API

`generationService.ts` contém o contrato `GenerationService`, a demonstração e o adaptador HTTP. `useContentStudio.ts` controla histórico temporário, cancelamento, limite de 45 segundos, retry sem duplicar mensagem e proteção contra respostas atrasadas. `ChatPage` coordena os painéis; `PostPreview` apresenta e edita o rascunho. A conversa é descartada ao sair da rota ou recarregar; rascunhos são persistidos apenas ao adicionar à agenda.

O padrão recomendado para desenvolvimento com o provedor é `VITE_AI_MODE=api`, com `OPENAI_API_KEY` configurada somente no ambiente do backend. `POST /api/content/generate` é autenticado, exige autorização do workspace e envia a marca e o pedido ao `ContentProvider`. Para uma apresentação sem chamadas externas, use `VITE_AI_MODE=demo`; esse modo não é fallback silencioso de falhas da API.

Entrada JSON: `{ prompt, platform, date, brand, history, previousDraft }`. `history` contém até 12 mensagens com `{ role, content }`; `previousDraft` inclui os ajustes atuais do usuário. Resposta: `{ data: { id, title, caption, hashtags, platform, date, status: 'draft', visualText, color, imageUrl? } }`. Campos e limites são validados com Zod antes de exibir. Erros HTTP usam `{ error: string }`; 401, 429, 499, 502, 503 e 504 recebem mensagens sanitizadas. Enviar JSON com credenciais de sessão, não chaves do provedor.

A composição visual usa `visualText` e `color` no modo demonstrativo. No modo API, o `ContentProvider` gera texto com `gpt-6-luna` pela Responses API e, em seguida, uma imagem pela Image Generation API. O padrão é `gpt-image-2.5-flare`; no estúdio individual, o usuário pode escolher “Mais qualidade”, que o backend mapeia para `gpt-image-2.5-sunburst`. Por padrão, o gerador escolhe proporções adequadas por rede: Instagram e LinkedIn em 4:5, Facebook em 1:1, X e Blog em 16:9 e TikTok/Reels em 9:16. As prévias usam as mesmas proporções, e imagens antigas com outra proporção são exibidas por inteiro, com margens, em vez de serem cortadas. `OPENAI_IMAGE_SIZE=auto` escolhe as dimensões por rede; uma dimensão explícita no ambiente substitui essa seleção. Os modelos GPT Image 2.5 aceitam dimensões personalizadas, respeitando os limites da API. Modelos e qualidade também podem ser ajustados no backend, sem alterar o frontend. O servidor valida o nível recebido e não aceita um identificador de modelo enviado pelo navegador. A documentação oficial recomenda Flare para geração rápida do dia a dia e Sunburst para tarefas que pedem mais qualidade; os resultados devem ser avaliados com os prompts reais do produto. A geração retorna uma data URL para a revisão. Ao adicionar o post à agenda, o backend envia a imagem ao bucket privado `post-draft-images` e guarda apenas o caminho em `post_drafts.image_path`; a agenda recebe URLs assinadas de uma hora para mostrar a prévia. Posts antigos sem imagem persistida mantêm a prévia textual. O adapter não usa fallback silencioso se uma das chamadas falhar. O timeout do frontend é de 90 segundos para comportar as duas etapas.

## Aprovação e publicação agendada

> **A publicação é simulada.** Até existir o conector da Meta, nenhum post é
> enviado a uma rede social real. O conector de demonstração apenas registra a
> publicação, com ID e link fictícios, e a agenda mostra "Publicado (simulado)".

Todo post criado pela IA começa como **"Não agendado"** e nunca é publicado sem
aprovação. Na agenda, o cliente aprova o post com data e hora futuras; ele passa
a **"Agendado"**. Aprovar um horário no passado é recusado com "Escolha um
horário futuro para agendar o post."

| Rótulo               | Estado no banco                     | Significado                                        |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| Não agendado         | `draft`                             | Aguardando aprovação; nunca será publicado         |
| Agendado             | `scheduled`                         | Aprovado; será publicado no horário                |
| Publicando           | `publishing`                        | O agendador está processando o post                |
| Publicado (simulado) | `published` com `publish_mode=demo` | Publicação demonstrativa; nenhuma rede foi chamada |
| Publicado            | `published` em outro modo           | Publicação real (conector futuro)                  |
| Falhou               | `failed`                            | Não foi publicado; o motivo aparece na agenda      |

Editar legenda, imagem, data ou hora de um post "Agendado" o devolve a "Não
agendado" e exige nova aprovação. O navegador só alterna entre esses dois
estados; `publishing`, `published` e `failed` são definidos apenas pelo servidor.

O `pg_cron` do Supabase chama a cada 5 minutos `POST /api/internal/publish-due`
com `Authorization: Bearer <CRON_SECRET>` (`503` se `CRON_SECRET` não estiver
configurado; `401` se estiver errado). Cada chamada processa até 10 posts, com
`FOR UPDATE SKIP LOCKED`, então execuções simultâneas não duplicam publicações.
Um post em "Publicando" há mais de 15 minutos volta a "Agendado" (se ainda não
tiver `external_post_id`), com no máximo 3 tentativas. Passadas 2 horas do
horário, o post vira "Falhou" com "Horário perdido: o post não foi publicado até
2 horas após o horário agendado." Os conectores seguem a interface
`SocialPublisher`; a Meta entrará como um novo publisher sem mudar a agenda.
Decisão em [ADR-0012](adr/ADR-0012-scheduled-publishing-and-social-connectors.md).

Configuração em produção: definir `CRON_SECRET` na Vercel, guardar a URL da API
e o mesmo segredo no Supabase Vault e executar `database/cron/publish-due-posts.sql`
manualmente no SQL Editor (o script não contém segredos).

## Franquias aplicadas no backend

Na agenda, “Gerar imagem com IA” cria uma arte para um post sem imagem salva.
`POST /api/content/generate-image` gera somente a imagem e reserva uma unidade
de imagem, sem alterar a legenda nem consumir texto.
`PUT /api/workspaces/:workspaceId/drafts/:draftId/image` envia a arte ao bucket
privado, atualiza o caminho do objeto e devolve uma URL assinada. A prévia
renova o link quando ele expira. No planejador, após salvar os rascunhos, uma
imagem é gerada por data e associada a todos os destinos daquele dia. Cada
rascunho guarda sua referência persistida à arte; em caso de falha, os posts sem
imagem podem ser recuperados pela ação manual sem recriar o lote.

Os limites efetivos vêm de `plans.text_limit` e `plans.image_limit`; o BFF não
usa limites enviados pelo navegador. Antes de chamar a OpenAI, o backend reserva
as unidades no PostgreSQL por uma RPC que bloqueia a linha de uso do workspace
e período. Uma geração individual reserva **1 texto + 1 imagem**. Gerar uma
imagem para um rascunho existente reserva **1 imagem**. Um lote reserva **1 texto
por item retornado** (até 42). Depois, a etapa de imagens reserva **1 imagem por
data**, compartilhada entre os destinos dessa data. A cobrança mostra consumo
concluído e reservas em andamento, sempre para o período da assinatura atual.

Quando o provedor falha, a reserva é liberada; quando responde com sucesso, as
unidades são consumidas. Reservas deixadas por encerramento abrupto expiram em
uma hora e são liberadas na cobrança ou na próxima reserva do mesmo workspace/período. O
provedor pode ter processado uma etapa antes de uma falha posterior; a franquia
mede resultados completos entregues, enquanto o custo externo pode refletir
essa etapa parcial.

Ao salvar rascunhos, o BFF limita legenda a 5.000 caracteres e texto visual a 160. Também verifica o limite configurado para a plataforma sobre legenda mais
hashtags. O parser JSON aceita até 8 MiB, suficiente para o lote máximo de 42
itens e a imagem-base64 opcional da revisão; acima disso responde `413`.

## Verificação

Testes cobrem contrato HTTP, retorno inválido, cancelamento, timeout mesmo com provedor que ignora o sinal, exclusão de resposta atrasada, falha preservando edição, retry sem mensagem duplicada, submissão simultânea e salvamento na agenda. Capturas cobrem vazio, prévia e edição em 320, 390, 768, 1024 e 1440px. A revisão visual corrigiu autoscroll indevido na tela vazia.
