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

Crítica: um painel genérico de chat não explica o trabalho editorial. A diferença escolhida é a bancada de revisão ao lado da conversa, com refinamento do rascunho atual, marca e data reais. Removemos cartões repetidos, etiquetas decorativas e promessa de imagem gerada onde existe somente composição tipográfica. Verde apenas para ações e estado; a peça do post usa a cor da marca.

Princípios: mostrar o que será salvo; preservar ajustes em falhas; separar gerar de publicar; não esconder simulação; interface e serviços independentes. A conversa é temporária e a agenda continua sendo a persistência do conteúdo aprovado.

## Integração de API

`generationService.ts` contém o contrato `GenerationService`, a demonstração e o adaptador HTTP. `useContentStudio.ts` controla histórico temporário, cancelamento, limite de 45 segundos, retry sem duplicar mensagem e proteção contra respostas atrasadas. `ChatPage` coordena os painéis; `PostPreview` apresenta e edita o rascunho. A conversa é descartada ao sair da rota ou recarregar; rascunhos são persistidos apenas ao adicionar à agenda.

O padrão é `VITE_AI_MODE=demo`. Para usar `api`, primeiro implemente **no backend** `POST /api/content/generate`, autenticado, com autorização, limite de consumo e segredo do provedor exclusivamente no servidor. O endpoint de IA ainda não existe neste incremento: ativar a variável sozinho não conecta um provedor e exibirá erro, sem fallback silencioso. Nenhuma API paga é chamada.

Entrada JSON: `{ prompt, platform, date, brand, history, previousDraft }`. `history` contém até 12 mensagens com `{ role, content }`; `previousDraft` inclui os ajustes atuais do usuário. Resposta: `{ data: { id, title, caption, hashtags, platform, date, status: 'draft', visualText, color } }`. Campos e limites são validados com Zod antes de exibir. Erros HTTP usam `{ error: string }`; 401, 429, 404/503 recebem mensagens específicas. Enviar JSON com credenciais de sessão, não chaves do provedor.

A composição visual usa `visualText` e `color` e é identificada como ilustrativa. Para imagens raster reais, ainda é necessário integrar geração/armazenamento no servidor e estender `PostDraft`, tabela e repositório com referência persistente de mídia. O adaptador atual não promete persistência de imagem por URL. Franquias do plano fiscal são proposta comercial, não quotas já aplicadas ao chat.

## Verificação

Testes cobrem contrato HTTP, retorno inválido, cancelamento, timeout mesmo com provedor que ignora o sinal, exclusão de resposta atrasada, falha preservando edição, retry sem mensagem duplicada, submissão simultânea e salvamento na agenda. Capturas cobrem vazio, prévia e edição em 320, 390, 768, 1024 e 1440px. A revisão visual corrigiu autoscroll indevido na tela vazia.
