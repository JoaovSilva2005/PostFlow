# ADR-0012: Publicação agendada e conectores de redes sociais

## Status

Accepted — 2026-10-28

## Contexto

O PostFlow gera e organiza posts, mas ainda não os publica. O acesso de
desenvolvedor da Meta está bloqueado temporariamente, então até 03/11 nenhuma
rede real pode ser conectada. A entrega precisa demonstrar o ciclo completo
(aprovar, agendar, publicar no horário, mostrar o resultado) sem depender da
Meta, e sem exigir mudanças na agenda quando o conector real chegar. O BFF roda
em funções serverless na Vercel, que não mantêm processos nem temporizadores.

## Decisão

- Os conectores ficam atrás da interface `SocialPublisher`. O
  `PublishingService` só conhece essa interface.
- Nesta fase existe apenas o `DemoSocialPublisher`. Ele não chama nenhuma rede,
  devolve um ID e um link fictícios identificados como simulação e grava o post
  com `publish_mode = 'demo'`. Na agenda aparece como "Publicado (simulado)".
- O agendador é o `pg_cron` do Supabase, que a cada 5 minutos chama, com
  `pg_net`, a rota interna `POST /api/internal/publish-due`. A rota exige
  `Authorization: Bearer <CRON_SECRET>`: `503` se `CRON_SECRET` não estiver
  configurado e `401` se o segredo estiver errado.
- A aprovação é obrigatória. O navegador só move `draft` para `scheduled`
  (aprovar) e de volta; nunca define `publishing`, `published` nem `failed`.
  Só posts `scheduled` são publicados.
- Concorrência e recuperação ficam no PostgreSQL. A função
  `claim_due_post_drafts` usa `FOR UPDATE SKIP LOCKED`, marca o lote
  (máximo 10) como `publishing` e incrementa `publish_attempts`. Um
  `publishing` parado por mais de 15 minutos volta a `scheduled`, exceto se já
  houver `external_post_id`. O limite é de 3 tentativas. Posts com mais de 2
  horas de atraso viram `failed` com "Horário perdido: o post não foi publicado
  até 2 horas após o horário agendado."
- Editar legenda, imagem, data ou hora de um post `scheduled` o devolve a
  `draft` ("Não agendado"), exigindo nova aprovação.
- A URL da API e o `CRON_SECRET` do `pg_cron` são lidos do Supabase Vault
  (`postflow_api_url`, `postflow_cron_secret`). O script
  `database/cron/publish-due-posts.sql` é manual e não é uma migração, porque
  esses valores dependem do ambiente e nunca entram no repositório.

## Consequências

- A Meta entra como um novo `SocialPublisher` (Facebook e Instagram), sem mudar
  a agenda, a rota nem o agendador. A conexão OAuth, a criptografia de tokens e
  a Graph API ficam para a fase seguinte.
- Até lá, toda publicação é simulada, e a interface e a documentação dizem isso.
- A precisão do horário é de até 5 minutos mais o tempo da chamada; um post
  aprovado para daqui a 6 minutos aparece como publicado em até cerca de 11.
- Uma queda do agendador por mais de 2 horas faz os posts atrasados falharem em
  vez de saírem fora de hora.
- Há dois pontos de configuração manual em produção: o `CRON_SECRET` na Vercel
  e no Vault, e a execução do script de cron. Ambos exigem verificação
  explícita após o deploy.

## Validação

- Testes de serviço e de rota cobrem `401`/`503`, o claim como única porta de
  entrada, o status protegido no PATCH e a volta a `draft` ao editar.
- Testes estáticos verificam `SKIP LOCKED`, permissões e `search_path` no SQL.
- A verificação com duas execuções simultâneas e o ciclo real do cron são feitos
  manualmente em produção.
