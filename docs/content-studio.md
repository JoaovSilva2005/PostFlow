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

A composição visual usa `visualText` e `color` no modo demonstrativo. No modo API, o mesmo `ContentProvider` gera o texto pela Responses API e, em seguida, uma imagem quadrada pelo endpoint de imagens; os padrões são `gpt-5.6-luna`, `gpt-image-1-mini`, qualidade `medium`, tamanho `1024x1024` e uma imagem por solicitação. Todos esses parâmetros podem ser ajustados no ambiente do backend, sem alterar o frontend. A resposta retorna a imagem como data URL para a prévia. A imagem não é enviada ao banco ao adicionar o texto à agenda: ela fica disponível na revisão atual até que exista uma estratégia de armazenamento persistente em Supabase Storage. O adapter não usa fallback silencioso se uma das chamadas falhar. O timeout do frontend é de 90 segundos para comportar as duas etapas. Franquias do plano fiscal são proposta comercial, não quotas já aplicadas ao chat.

## Verificação

Testes cobrem contrato HTTP, retorno inválido, cancelamento, timeout mesmo com provedor que ignora o sinal, exclusão de resposta atrasada, falha preservando edição, retry sem mensagem duplicada, submissão simultânea e salvamento na agenda. Capturas cobrem vazio, prévia e edição em 320, 390, 768, 1024 e 1440px. A revisão visual corrigiu autoscroll indevido na tela vazia.
