# ADR-0014: Modo demonstração da publicação social

## Status

Accepted — 2026-10-28 (SCRUM-58). Complementa o ADR-0012; não o substitui.

## Contexto

O módulo de publicação social (ADR-0012) está completo no servidor, mas bloqueado: não existem apps de desenvolvedor das redes, e `docs/social-publishing-setup.md` afirmava que nenhum cliente recebe conexão ou publicação fictícia. A banca de 03/11/2026 precisa ver o ciclo completo funcionando: conectar, aprovar, agendar e publicar sozinho.

## Decisão

Com `SOCIAL_DEMO_MODE=true` (string exata), o servidor troca os quatro adaptadores reais (Facebook, Instagram, LinkedIn, TikTok) por adaptadores de demonstração em `backend/modules/social-publishing/providers/demo.ts`. Qualquer outro valor, ou a ausência da variável, mantém os adaptadores reais.

- Os adaptadores demo substituem os existentes, sem criar um id de rede novo: o banco tem check `provider in (...)` e o enqueue exige rede do rascunho igual à da conta. Nenhuma mudança de schema.
- Nenhuma chamada HTTP a redes: os adaptadores não recebem nem usam `fetch`.
- Permanecem obrigatórios: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET` (32 ou mais caracteres), `SOCIAL_SCHEDULER_ENABLED=true` e `APP_URL` https em produção. Deixam de ser exigidos as credenciais dos apps e, no TikTok, `TIKTOK_MEDIA_DOMAIN_VERIFIED` e `TIKTOK_DIRECT_POST_APPROVED`. Assim a demonstração exercita o mesmo agendador e a mesma criptografia que a produção real usará.
- Membership, papel, assinatura, state do OAuth, criptografia de tokens, snapshot aprovado e lease do worker continuam valendo.
- A simulação é marcada nos dados e na interface: conta com `accountType: 'demo'` e `externalAccountId: 'demo-<rede>'`; `operation.demo = true`; `remotePostId` começando com `demo-` e `remoteUrl: null`; `simulated: true` nas publicações e `demoMode: true` na visão geral. A interface mostra o aviso de modo demonstração e o rótulo "Publicado (simulado)".
- O worker passa a aceitar também marca sem plano próprio quando quem enfileirou é o titular da marca com plano ativo no nível da conta (espelha `requireActiveSubscription`) ou `platform_owner`.
- Junto desta entrega, o login passa a responder `503` "Serviço de autenticação indisponível. Tente novamente em instantes." quando o provedor de autenticação está fora; credenciais erradas continuam `401`.

## Consequências

- A flag precisa ficar desligada para clientes reais. Ligada, o aviso aparece na interface e as contas e publicações são identificáveis como simuladas, mas nada chega às redes.
- A infraestrutura real (criptografia, fila, Cron, lease, snapshot) é exercitada de ponta a ponta; só a chamada final à rede é simulada. Isso não comprova aprovação das redes nem o comportamento de suas APIs.
- Ativar uma rede real depois é configuração (apps e credenciais) e desligar `SOCIAL_DEMO_MODE`; contas `demo` existentes devem ser desconectadas.
- Depende da recuperação das quatro migrações de 25–28/09, com timestamps anteriores à `20261012181805`.
