# ADR-0006: Arte gerada como preview da revisão

## Status

Accepted — 2026-09-20

## Decision Drivers

- O estúdio precisa mostrar uma arte real junto da legenda gerada.
- A chave do provedor deve continuar exclusivamente no backend.
- Imagens em base64 são grandes demais para serem gravadas diretamente em `post_drafts`.
- A agenda atual persiste conteúdo editorial, não mídia.

## Considered Options

1. Gerar somente uma composição CSS no navegador.
2. Gerar a imagem no backend e devolver uma data URL para a revisão atual.
3. Adicionar imediatamente upload e persistência em Supabase Storage.

## Decision Outcome

**Chosen option**: "Gerar no backend e devolver uma data URL para a revisão atual", porque entrega o fluxo de criação solicitado sem misturar a chave da OpenAI no navegador nem introduzir uma migração de Storage durante este incremento.

O `OpenAiContentProvider` gera primeiro o contrato textual e depois chama a Image Generation API. O `PostDraft.imageUrl` é opcional no frontend, exibido no `PostPreview`, e removido pelo repositório antes de `POST/PATCH /drafts`. O modo demo continua usando composição CSS e não se apresenta como imagem gerada.

### Positive Consequences

- A revisão mostra uma arte real e uma legenda editável no mesmo fluxo.
- O domínio continua independente do formato da resposta do provedor.
- Nenhuma imagem grande é persistida acidentalmente no banco.

### Negative Consequences

- A imagem não reaparece depois de recarregar a agenda.
- Cada ajuste do rascunho gera uma nova imagem e pode aumentar custo/latência.
- A resposta HTTP pode ficar grande por transportar a data URL.

## Validation

- Testes de contrato devem aceitar `imageUrl` opcional e rejeitar formatos inválidos.
- O repositório deve remover `imageUrl` antes de criar ou atualizar o rascunho persistido.
- O provider deve chamar texto e imagem no servidor e converter `b64_json` em data URL.
- Uma evolução futura para Storage deve substituir este ADR por uma decisão de persistência de mídia.
