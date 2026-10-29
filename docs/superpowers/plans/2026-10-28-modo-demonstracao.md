# Modo demonstração da publicação social — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** recuperar o trabalho de 25–28/09 sobre a `main` e criar um modo
demonstração (`SOCIAL_DEMO_MODE=true`) que roda o módulo social existente de
ponta a ponta sem nenhuma rede externa, além de fazer o login distinguir
"serviço indisponível" de "senha errada".

**Architecture:**
- Adaptadores `SocialProvider` de demonstração, um por rede, substituem os
  reais em `createSocialProviders` quando o modo está ligado.
- `SocialService` deixa de exigir as credenciais dos apps nesse modo, mas
  mantém os segredos de infraestrutura.
- Os DTOs expõem `demoMode` e `simulated`, e a interface mostra isso.
- Nada muda no banco.

**Tech Stack:** TypeScript 6, Express 5, Zod 4, Supabase, React 19,
Vitest 4 + supertest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-modo-demonstracao-design.md`

## Global Constraints

- O modo demonstração só liga com `SOCIAL_DEMO_MODE === 'true'` (string
  exata). Qualquer outro valor mantém os adaptadores reais.
- Em modo demonstração, **nenhuma chamada HTTP** a redes. Os adaptadores
  demo não recebem nem usam `fetch`.
- Continuam obrigatórios em modo demonstração:
  - `SOCIAL_TOKEN_ENCRYPTION_KEY`;
  - `SOCIAL_CRON_SECRET` (32 ou mais caracteres);
  - `SOCIAL_SCHEDULER_ENABLED=true`;
  - `APP_URL` https em produção.

  Deixam de ser exigidos: as credenciais dos apps (`metadata[id].keys`) e,
  no TikTok, `TIKTOK_MEDIA_DOMAIN_VERIFIED` / `TIKTOK_DIRECT_POST_APPROVED`.
- Valores fixos:
  - conta demo: `externalAccountId: 'demo-<rede>'`, `accountType: 'demo'`,
    `displayName: '<Rótulo da rede> — conta de demonstração'` (rótulos:
    Facebook, Instagram, LinkedIn, TikTok);
  - token demo: `accessToken: 'demo-token'`;
  - id do post: `remotePostId` começa com `demo-`; `remoteUrl: null`;
  - `operation.demo === true` em todo o ciclo.
- Textos exatos:
  - rótulo **"Publicado (simulado)"** para publicação `published` com
    `simulated: true`;
  - aviso **"Modo demonstração: as conexões e publicações são simuladas e
    nada é enviado às redes sociais."**;
  - login indisponível: `503` **"Serviço de autenticação indisponível.
    Tente novamente em instantes."**;
  - credenciais erradas continuam `401` "E-mail ou senha inválidos.".
- Membership, papel, assinatura, state do OAuth, criptografia, snapshot
  aprovado e lease do worker continuam valendo em modo demonstração.
- Padrões do repositório: imports `.js`, `HttpError`, mensagens em
  português, sem dependências novas.
- Commits `feat(SCRUM-58): ...` / `fix(...)`, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gate de cada tarefa: `npm run typecheck` e
  `npx vitest run --maxWorkers=3` verdes.

## Review Focus

1. `SOCIAL_DEMO_MODE` ausente ou `'false'` → a visão geral mostra os 4
   adaptadores reais, com as credenciais exigidas como antes. Teste na
   Tarefa 2.
2. Modo demonstração sem `SOCIAL_CRON_SECRET` ou sem chave de cripto → a
   rede continua "aguardando configuração" (503 no OAuth). Teste na
   Tarefa 2.
3. Ciclo completo em modo demonstração (startOAuth → callback → connect →
   enqueue → runWorker) termina `published` com `simulated: true`, e o
   `fetch` injetado nunca é chamado. Teste na Tarefa 2.
4. Um editor sem permissão de administrar conexões, ou uma marca sem
   plano, continua barrado em modo demonstração. Teste na Tarefa 2.
5. Erro de rede ou 5xx do Supabase Auth no login → 503. Credenciais
   inválidas → 401. Teste na Tarefa 4.

---

### Tarefa 1: Recuperar o trabalho de 25–28/09

**Files:** cherry-pick, nesta ordem, dos commits da branch
`feat/scrum-58-publicacao-agendada`:
1. `1e964d0` — cobrança por conta e limite de marcas;
2. `d609d21` — privilégios mínimos;
3. `32a8a9f` — custo de IA e página de admin;
4. `4d458b7` — ajustes de conteúdo, agenda e interface.

Arquivos afetados: `scripts/database/migration-inventory.json`,
`database/schema.sql`, `backend/app.ts`, `backend/config/environment.ts`,
`backend/modules/content/*`, `src/features/calendar/*`, `README.md`,
`.env.example` e os demais arquivos dos commits.

- [ ] **Passo 1:** `git cherry-pick 1e964d0`. Resolver os conflitos. Rodar
  `npm run typecheck` e `npx vitest run --maxWorkers=3`. Concluir o
  cherry-pick (`git cherry-pick --continue`, mantendo a mensagem original).
- [ ] **Passo 2:** repetir o Passo 1 para `d609d21`, depois `32a8a9f`,
  depois `4d458b7`. Regra de conflito: onde os dois lados mudaram o mesmo
  comportamento, prevalece o da `main` (12/10). Do lado antigo, entra
  apenas o que não existe na `main`: custo de IA, cobrança por conta,
  limite de marcas, privilégios, ajustes que não colidem. Se não ficar
  claro qual lado vence, pare e reporte NEEDS_CONTEXT com o trecho.
- [ ] **Passo 3:** se um cherry-pick ficar vazio porque a `main` já contém
  tudo, use `git cherry-pick --skip` e registre no relatório.
- [ ] **Passo 4:** gate final:
  - `npm run typecheck`;
  - `npx vitest run --maxWorkers=3`;
  - `node scripts/database/testSchema.mjs`;
  - `node scripts/database/testMigrationInventory.mjs`;
  - `npm run lint`.

  Esperado: tudo verde, e o inventário com as 18 migrações da `main` mais
  as 4 recuperadas.

### Tarefa 2: Adaptadores de demonstração no backend

**Files:**
- Create: `backend/modules/social-publishing/providers/demo.ts`
- Modify: `backend/modules/social-publishing/providers/index.ts`
  (`createSocialProviders` aceita `demoMode?: boolean` em
  `SocialProviderFactoryOptions`);
  `backend/modules/social-publishing/socialService.ts` (`missing()`,
  `overview()`, `publicPublication()`);
  `shared/domain/socialPublishing.ts` (`SocialOverview.demoMode: boolean`,
  `PublicationDTO.simulated: boolean`, `DEMO_ACCOUNT_TYPE = 'demo'`);
  `backend/config/environment.ts` (`socialDemoMode: process.env.SOCIAL_DEMO_MODE === 'true'`);
  `backend/app.ts` (passar `demoMode` para `createSocialProviders`);
  `.env.example` (`SOCIAL_DEMO_MODE=false`)
- Test: `backend/modules/social-publishing/providers/demo.test.ts`,
  `backend/modules/social-publishing/socialService.test.ts`

**Interfaces — Produces:**
```ts
// providers/demo.ts
export function createDemoProvider(id: SocialProviderId): SocialProvider
// SocialService: o modo vem de config.SOCIAL_DEMO_MODE === 'true' (o mesmo `config` já injetado)
// shared/domain/socialPublishing.ts
export const DEMO_ACCOUNT_TYPE = 'demo'
interface SocialOverview { demoMode: boolean; ... }
interface PublicationDTO { simulated: boolean; ... }   // = operation?.demo === true
```

Comportamento de `createDemoProvider(id)`:
- `configured: true`, `scopes: []`.
- `authorizationUrl({ state, redirectUri })` devolve
  `${redirectUri}?code=demo-code&state=${encodeURIComponent(state)}`.
- `exchangeCode` devolve `{ accessToken: 'demo-token', expiresAt: <agora + 60 dias> }`.
- `accounts` devolve uma conta com os valores fixos das Global Constraints.
- `refresh` devolve o token com validade renovada.
- `creatorInfo` existe só no TikTok, com
  `privacyLevelOptions: ['SELF_ONLY','PUBLIC_TO_EVERYONE']` e os booleans
  `false`.
- `prepare` devolve `{ operation: { demo: true }, ready: true }`.
- `publish` e `reconcile` devolvem
  `{ status: 'published', remotePostId: \`demo-${randomUUID()}\`, remoteUrl: undefined, operation: { demo: true } }`.
  Em `reconcile`, se a operação já tiver um `remotePostId` gravado,
  reutilizá-lo.

Em `SocialService`:
- com `demoMode`, `missing(id)` ignora `metadata[id].keys` e as duas flags
  do TikTok, mas mantém cripto, `SOCIAL_CRON_SECRET`,
  `SOCIAL_SCHEDULER_ENABLED` e `APP_URL`;
- `overview()` devolve `demoMode`;
- `publicPublication` devolve `simulated`.

- [ ] **Passo 1: escrever os testes que falham:**
  - `demo.test.ts`:
    - authorizationUrl contém `code=demo-code` e o state;
    - accounts devolve a conta demo com os valores exatos;
    - publish devolve `published`, `remotePostId` com prefixo `demo-` e
      `operation.demo` verdadeiro;
    - creatorInfo existe só para `tiktok`.
  - `socialService.test.ts`, usando `InMemorySocialRepository`, os
    adaptadores demo, um `fetch` espião e config com cripto/cron/scheduler
    válidos:
    - ciclo completo até `published` com `simulated: true` e o `fetch`
      espião nunca chamado;
    - modo demo sem `SOCIAL_CRON_SECRET` → `startOAuth` lança 503;
    - modo demo com papel `editor` → `connect`/`callback` barrados como
      hoje;
    - modo demo com marca sem plano e usuário que não é platform_owner →
      worker cancela, como hoje;
    - `SOCIAL_DEMO_MODE` ausente → `overview().demoMode === false` e
      `missingConfiguration` inclui as chaves do app.
- [ ] **Passo 2:** `npx vitest run backend/modules/social-publishing`.
  Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. Depois typecheck e suíte
  completa com `--maxWorkers=3`.
- [ ] **Passo 5:** commit `feat(SCRUM-58): add social publishing demo mode`.

### Tarefa 3: Interface do modo demonstração

**Files:**
- Modify: `src/features/social/SocialConnectionsPage.tsx` (aviso quando
  `overview.demoMode`; selo "Demonstração" nas conexões com
  `accountType === DEMO_ACCOUNT_TYPE`; `statusLabel` recebe a publicação e
  devolve "Publicado (simulado)" quando `simulated`),
  `src/features/social/DraftPublishingPanel.tsx` (mesmo rótulo no
  acompanhamento por destino e aviso curto quando `demoMode`),
  `src/features/social/social.module.css` (estilo do aviso com os tokens
  existentes)
- Test: `src/features/social/SocialConnectionsPage.test.tsx`,
  `src/features/social/DraftPublishingPanel.test.tsx`

**Interfaces — Consumes:** `SocialOverview.demoMode`,
`PublicationDTO.simulated`, `DEMO_ACCOUNT_TYPE` (Tarefa 2).

- [ ] **Passo 1: escrever os testes que falham:**
  - `demoMode true mostra o aviso exato`;
  - `demoMode false não mostra o aviso`;
  - `publicação published com simulated mostra "Publicado (simulado)"`;
  - `published sem simulated mostra "Publicado"`;
  - `conexão demo mostra o selo "Demonstração"`.
- [ ] **Passo 2:** `npx vitest run src/features/social`. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. Depois typecheck, lint e
  suíte completa.
- [ ] **Passo 5:** commit `feat(SCRUM-58): show demo mode in social publishing UI`.

### Tarefa 4: Login distingue indisponibilidade de senha errada

**Files:**
- Modify: `backend/modules/auth/authService.ts` (`login`),
  e `backend/modules/auth/supabaseAuthProvider.ts` se for preciso
  preservar o erro original
- Test: `backend/modules/auth/authRoutes.test.ts` (ou o teste de serviço
  existente)

Regra:
- **503** com a mensagem das Global Constraints quando o erro do provedor
  for de indisponibilidade:
  - `name === 'AuthRetryableFetchError'`;
  - `status >= 500`;
  - erro de rede (`TypeError` de fetch, `ENOTFOUND`, `ECONNREFUSED`,
    timeout).
- **401** "E-mail ou senha inválidos." em todos os outros casos, inclusive
  `invalid_credentials`.
- Nunca incluir detalhes do erro na resposta. O log usa só o nome do erro,
  como o handler global já faz.

- [ ] **Passo 1: escrever os testes que falham:**
  - `provedor lança AuthRetryableFetchError → 503 com a mensagem exata`;
  - `provedor lança erro com status 503 → 503`;
  - `provedor lança invalid_credentials (status 400) → 401`.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. Depois a suíte completa.
- [ ] **Passo 5:** commit `fix(SCRUM-58): report auth provider outages as 503 on login`.

### Tarefa 5: Documentação e ativação

**Files:**
- Create: `docs/adr/ADR-0014-social-publishing-demo-mode.md`
- Modify: `docs/adr/README.md`, `docs/social-publishing-setup.md` (seção
  "Modo demonstração", com as variáveis, o que é simulado e como desligar),
  `README.md` / `backend/README.md` (variável `SOCIAL_DEMO_MODE`),
  `docs/user-manual.md` (como demonstrar)

- [ ] **Passo 1:** escrever a ADR-0014.
  - Contexto: sem apps de desenvolvedor, a banca é em 03/11, e o setup
    doc dizia "nenhuma publicação fictícia".
  - Decisão: adaptadores demo atrás de uma flag explícita, com a
    marcação nos dados e na interface.
  - Consequências: precisa ficar desligado para clientes, e a
    infraestrutura real é exercitada.
- [ ] **Passo 2:** atualizar `social-publishing-setup.md`. A seção do modo
  demonstração deve explicar que ele é exceção à frase "nenhum cliente
  recebe conexão ou publicação fictícia", válida só com a flag. Incluir o
  checklist de ativação da spec (Supabase reativado, migrações
  recuperadas, variáveis, cron).
- [ ] **Passo 3:** commit `docs(SCRUM-58): document social publishing demo mode`.
- [ ] **Passo 4 (com o João, pede confirmação):** push, PR, reativação do
  Supabase, migrações, variáveis na Vercel, cron, e teste ao vivo
  "Publicado (simulado)".
