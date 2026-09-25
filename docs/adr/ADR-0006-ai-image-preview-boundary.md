# ADR-0006: Arte gerada como preview da revisão

## Status

Superseded — 2026-09-25 by [ADR-0007](ADR-0007-persist-generated-images.md)

## Decision Drivers

- O estúdio precisa mostrar uma arte real junto da legenda gerada.
- A chave do provedor deve continuar exclusivamente no backend.
- Imagens em base64 são grandes demais para serem gravadas diretamente em `post_drafts`.
- A agenda precisa manter disponível a imagem gerada depois de salvar o post.

## Considered Options

1. Gerar somente uma composição CSS no navegador.
2. Gerar a imagem no backend e devolver uma data URL para a revisão atual.
3. Adicionar upload e persistência em Supabase Storage.

## Decision Outcome

**Historical decision**: "Gerar no backend e devolver uma data URL para a revisão atual". A evolução da persistência de mídia foi registrada no ADR-0007.

O `OpenAiContentProvider` gera primeiro o contrato textual e depois chama a Image Generation API. O modo demo continua usando composição CSS e não se apresenta como imagem gerada.

### Positive Consequences

- A revisão mostra uma arte real e uma legenda editável no mesmo fluxo.
- O domínio continua independente do formato da resposta do provedor.
- Nenhuma imagem grande é persistida diretamente no banco.

### Negative Consequences

- A imagem não reaparece depois de recarregar a agenda nesta versão histórica.
- A resposta HTTP pode ficar grande por transportar a data URL para a revisão.

## Validation

- Testes de contrato devem aceitar `imageUrl` opcional e rejeitar formatos inválidos.
- O repositório deve remover `imageUrl` antes de atualizar o rascunho persistido.
- O provider deve chamar texto e imagem no servidor e converter `b64_json` em data URL.
- Para a decisão atual sobre persistência em Storage, consulte o ADR-0007.
