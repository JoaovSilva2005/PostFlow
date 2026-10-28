# Aprovação e publicação agendada (conector de demonstração) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário aprova os posts criados pela IA (`draft` → `scheduled`).
Um agendador do Supabase publica os aprovados no horário, por um conector
"Demonstração", e a agenda mostra "Publicado (simulado)".

**Architecture:**
- **Regras puras** de status em `shared/domain/postPublishing.ts`.
- **Módulo de backend** novo em `backend/modules/publishing/`:
  - interface `SocialPublisher` + `DemoSocialPublisher`;
  - `PublishingService`, que orquestra claim → publicar → registrar;
  - repositório Supabase usando a RPC atômica `claim_due_post_drafts`.
- **Rota interna** `POST /api/internal/publish-due`, protegida por
  `CRON_SECRET` e chamada pelo `pg_cron` a cada 5 minutos.
- **Rotas de rascunho** passam a aceitar do navegador apenas `draft` e
  `scheduled`.
- **Agenda** ganha "Aprovar e agendar" e os novos estados.

**Tech Stack:** TypeScript 6, Express 5, Zod 4, Supabase/PostgreSQL
(`pg_cron`, `pg_net`), React 19, Vitest 4 + supertest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-publicacao-redes-sociais-design.md`.
Implementar apenas a seção "Escopo até 03/11" e as regras de estado e de
agendador que ela referencia. OAuth da Meta, tokens e Graph API ficam fora.

## Global Constraints

- **Nunca publicar** um post que não esteja `scheduled`. O navegador nunca
  define `publishing`, `published` nem `failed`.
- Valores fixos:
  - intervalo do cron: **5 minutos**;
  - máximo de tentativas: **3**;
  - `publishing` parado volta a `scheduled` depois de **15 minutos** (exceto
    se já houver `external_post_id`);
  - atraso máximo: **2 horas**, depois disso `failed` com
    `"Horário perdido: o post não foi publicado até 2 horas após o horário agendado."`;
  - lote por chamada: **10**.
- Rótulos na interface:
  - `draft` → **"Não agendado"**;
  - `scheduled` → **"Agendado"**;
  - `publishing` → **"Publicando"**;
  - `published` + `publish_mode = 'demo'` → **"Publicado (simulado)"**;
  - `published` em outro modo → **"Publicado"**;
  - `failed` → **"Falhou"**.
- Mensagens em português, como no resto da API.
- Segredos (`CRON_SECRET`) só em `.env.local` e na Vercel. Nunca em chat,
  logs ou commits.
- Migração nova em `supabase/migrations/` e registrada em
  `scripts/database/migration-inventory.json`. Espelhar em
  `database/schema.sql`.
- Seguir o estilo existente: arquivos `*.ts` com imports `.js`, roteadores
  `createXRouter`, `HttpError`, `parse()` com Zod.
- Mensagens de commit no padrão do repositório: `feat(SCRUM-58): ...`.
- Gate de cada tarefa: `npm run typecheck` e `npx vitest run` verdes.

## Review Focus

1. Navegador envia `status: 'published'` (ou `publishing`/`failed`) no PATCH
   → `400`, nada muda. Teste na Tarefa 5.
2. Aprovar um post com horário no passado → `400` "Escolha um horário
   futuro para agendar o post." Teste na Tarefa 5.
3. Editar legenda, imagem, data ou hora de um post `scheduled` sem enviar
   status → volta a `draft`. Teste na Tarefa 5.
4. Duas execuções do cron ao mesmo tempo → cada post é publicado uma única
   vez. O SQL usa `FOR UPDATE SKIP LOCKED` (Tarefa 2). No serviço, o claim é
   a única porta de entrada, com teste na Tarefa 3. A verificação real fica
   no passo manual da Tarefa 7.
5. Chamada à rota interna sem cabeçalho, com segredo errado ou com
   `CRON_SECRET` ausente no ambiente → `401` / `503`, sem processar nada.
   Teste na Tarefa 4.

---

### Tarefa 0: Salvar e validar o trabalho pendente desde 06/10 (pré-condição)

**Files:** os ~71 arquivos já modificados ou não rastreados no `git status`.
Não commitar `tmp/`, `.env*` nem `output/`.

- [ ] **Passo 1:** `npm run typecheck`. Esperado: sem erros. Corrigir o que
  falhar antes de seguir.
- [ ] **Passo 2:** `npx vitest run`. Esperado: tudo verde. Corrigir as falhas.
- [ ] **Passo 3:** `node scripts/database/testSchema.mjs && node scripts/database/testMigrationInventory.mjs`.
  Esperado: as duas validações passam.
- [ ] **Passo 4:** conferir que `.gitignore` cobre `tmp/`. Adicionar se
  faltar.
- [ ] **Passo 5:** commits por assunto. Um para custo de IA (backend, admin e
  migração `20260928205117`). Um para cobrança de conta e limite de marcas
  (`20260928172236`, `20260925183820`). Um para privilégios mínimos
  (`20260925212250`). Um para os ajustes de conteúdo, agenda e interface.
- [ ] **Passo 6:** perguntar ao João antes de fazer `git push` e antes de
  aplicar migrações no Supabase de produção.

### Tarefa 1: Regras puras de status

**Files:**
- Create: `shared/domain/postPublishing.ts`
- Test: `shared/domain/postPublishing.test.ts`
- Modify: `src/domain/models.ts:12` (o tipo `PostStatus` passa a reexportar o
  novo tipo)

**Interfaces — Produces:**
```ts
export const POST_STATUSES = ['draft','scheduled','publishing','published','failed'] as const
export type PostStatus = (typeof POST_STATUSES)[number]
export const CLIENT_SETTABLE_STATUSES = ['draft','scheduled'] as const
export type ClientSettableStatus = (typeof CLIENT_SETTABLE_STATUSES)[number]
export const PUBLISH_MAX_ATTEMPTS = 3
export const PUBLISH_BATCH_SIZE = 10
export function isEditableStatus(status: PostStatus): boolean // false para publishing e published
export function resolveStatusAfterClientPatch(input: {
  current: PostStatus
  requested?: ClientSettableStatus
  contentOrScheduleChanged: boolean
}): PostStatus
export function postStatusLabel(status: PostStatus, publishMode?: string | null): string
```

- [ ] **Passo 1: escrever os testes que falham**
  - `resolveStatusAfterClientPatch({current:'scheduled', contentOrScheduleChanged:true})` → `'draft'`
  - `({current:'scheduled', requested:'scheduled', contentOrScheduleChanged:true})` → `'scheduled'` (editar e reaprovar no mesmo envio)
  - `({current:'failed', requested:'scheduled', contentOrScheduleChanged:false})` → `'scheduled'`
  - `({current:'draft', contentOrScheduleChanged:true})` → `'draft'`
  - `({current:'failed', contentOrScheduleChanged:true})` → `'draft'`
  - `isEditableStatus('publishing')` e `isEditableStatus('published')` → `false`. `draft`, `scheduled` e `failed` → `true`.
  - `postStatusLabel` devolve exatamente os rótulos das Global Constraints. Inclui `('published','demo')` → `'Publicado (simulado)'`.
- [ ] **Passo 2:** `npx vitest run shared/domain/postPublishing.test.ts`.
  Esperado: FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar as funções. Sem imports de Node, React ou
  Express (regra de `shared/`).
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. `npm run typecheck`
  verde, ajustando os usos de `PostStatus` no frontend que quebrarem com o
  tipo ampliado (`switch`/ternários em `EditDraftDialog.tsx`,
  `DraftSchedulePanel.tsx`). Por enquanto, usar `postStatusLabel`.
- [ ] **Passo 5:** commit `feat(SCRUM-58): add post publishing status rules`.

### Tarefa 2: Migração do banco e RPC de claim

**Files:**
- Create: `supabase/migrations/20261029120000_post_publishing_scheduler.sql`
- Modify: `scripts/database/migration-inventory.json`, `database/schema.sql`
- Test: `backend/modules/publishing/publishingMigration.test.ts` (verificação
  estática do SQL, no estilo de `transactionalMigration.test.ts`)

**Interfaces — Produces** (colunas novas em `public.post_drafts`):
- `published_at timestamptz null`
- `publishing_started_at timestamptz null`
- `publish_attempts integer not null default 0`
- `publish_error text null` (até 500 caracteres)
- `publish_mode text null`, com check `publish_mode in ('demo','live')`
- `external_post_id text null`
- `external_post_url text null`
- `approved_at timestamptz null`

Mudanças de regra:
- `post_drafts_status_check` passa a aceitar os 5 status de `POST_STATUSES`.
- RPC `public.claim_due_post_drafts(p_limit integer, p_now timestamptz) returns setof public.post_drafts`, `security invoker`, `set search_path = ''`. Em uma transação, nesta ordem:
  1. `publishing` com `publishing_started_at < p_now - interval '15 minutes'`:
     se tiver `external_post_id`, vira `published`; se não tiver, volta a
     `scheduled`.
  2. `scheduled` com `scheduled_at < p_now - interval '2 hours'` vira
     `failed` com a mensagem de horário perdido das Global Constraints.
  3. Seleciona até `p_limit` linhas `scheduled` com `scheduled_at <= p_now`,
     ordenadas por `scheduled_at`, com `for update skip locked`. Marca como
     `publishing` (`publishing_started_at = p_now`,
     `publish_attempts = publish_attempts + 1`) e as devolve.
- `grant execute` apenas para `service_role`. `revoke` de `anon` e
  `authenticated`, como nas migrações de `20260925212250`.
- `update post_drafts set status = 'draft' where status = 'scheduled'`
  (nenhum desses foi aprovado no novo sentido).
- A RPC `update_post_draft_with_hashtags` recebe `create or replace`, sem
  mudar a assinatura, para também aplicar `approved_at` quando vier em
  `p_patch`.

- [ ] **Passo 1:** escrever o teste estático. Ele lê o arquivo SQL e afirma
  que contém:
  - `for update skip locked`, `interval '15 minutes'` e `interval '2 hours'`;
  - o check com os 5 status;
  - `revoke` para `anon, authenticated` e `grant execute` para `service_role`;
  - o `update ... set status = 'draft' where status = 'scheduled'`.
- [ ] **Passo 2:** rodar. Esperado: FAIL (arquivo inexistente).
- [ ] **Passo 3:** escrever a migração, registrá-la no inventário e espelhar
  colunas e check em `database/schema.sql`.
- [ ] **Passo 4:** `npx vitest run backend/modules/publishing/publishingMigration.test.ts && node scripts/database/testSchema.mjs && node scripts/database/testMigrationInventory.mjs`.
  Esperado: PASS.
- [ ] **Passo 5:** commit `feat(SCRUM-58): add publishing scheduler schema and claim RPC`.

### Tarefa 3: Conector de demonstração e serviço de publicação

**Files:**
- Create: `backend/modules/publishing/publishingTypes.ts`,
  `backend/modules/publishing/demoSocialPublisher.ts`,
  `backend/modules/publishing/publishingService.ts`,
  `backend/modules/publishing/publishingRepository.ts`
- Test: `backend/modules/publishing/publishingService.test.ts`,
  `backend/modules/publishing/demoSocialPublisher.test.ts`

**Interfaces — Consumes:** `PUBLISH_MAX_ATTEMPTS` e `PUBLISH_BATCH_SIZE`
(Tarefa 1); RPC `claim_due_post_drafts` (Tarefa 2);
`WorkspaceAccessRepository.getBillingStatus` e `getActiveBillingWorkspaceId`
(`backend/modules/tenancy/workspaceTypes.ts`).

**Interfaces — Produces:**
```ts
// publishingTypes.ts
export interface ClaimedPost { id: string; brandId: string; platform: string; caption: string; hashtags: string[]; imagePath: string | null; publishAttempts: number }
export interface PublishRequest { postId: string; brandId: string; platform: string; text: string; imageUrl: string | null }
export type PublishResult =
  | { ok: true; mode: 'demo' | 'live'; externalPostId: string; externalPostUrl: string | null }
  | { ok: false; retryable: boolean; reason: string }
export interface SocialPublisher { publish(request: PublishRequest): Promise<PublishResult> }
export interface PublishingRepository {
  claimDue(limit: number, now: Date): Promise<ClaimedPost[]>
  isPublishingAllowed(brandId: string): Promise<boolean>
  signedImageUrl(imagePath: string): Promise<string | null>
  markPublished(postId: string, result: Extract<PublishResult, { ok: true }>, now: Date): Promise<void>
  markForRetry(postId: string, reason: string): Promise<void>   // volta a scheduled, guarda publish_error
  markFailed(postId: string, reason: string): Promise<void>
}
export interface PublishRunSummary { claimed: number; published: number; retried: number; failed: number }
// publishingService.ts
export class PublishingService {
  constructor(repository: PublishingRepository, publisher: SocialPublisher, clock?: () => Date)
  publishDue(): Promise<PublishRunSummary>
}
// demoSocialPublisher.ts
export class DemoSocialPublisher implements SocialPublisher {}
// publishingRepository.ts
export class SupabasePublishingRepository implements PublishingRepository {
  constructor(supabase: SupabaseClient, workspaceAccess: WorkspaceAccessRepository)
}
```

Regras:
- `text` = legenda + `\n` + hashtags separadas por espaço (ou só a legenda,
  se não houver hashtags).
- `DemoSocialPublisher` devolve `{ ok: true, mode: 'demo', externalPostId: \`demo-${postId}\`, externalPostUrl: null }` sem I/O de rede.
- `isPublishingAllowed`:
  - `true` se `getBillingStatus(brandId)` for `active` ou `trialing`;
  - senão, `true` se o `owner` da marca (consultar `workspace_members` com
    `role = 'owner'`) tiver `getActiveBillingWorkspaceId` não nulo;
  - caso contrário, `false`.
- Se não for permitido, `markFailed` com `"Assinatura inativa: o post não foi publicado."`.
- Se a publicação falhar com `retryable` e `publishAttempts < PUBLISH_MAX_ATTEMPTS`,
  chama `markForRetry`. Se falhar sem `retryable` ou na 3ª tentativa, chama
  `markFailed(reason)`.
- Exceção lançada pelo publisher conta como `retryable: true` com o motivo
  `"Falha temporária ao publicar."`. O loop nunca para por causa de um post:
  cada post fica isolado em `try/catch`.

- [ ] **Passo 1: escrever os testes que falham** (repositório e publisher
  falsos em memória):
  - `publishDue chama claimDue com (10, agora) e publica cada post uma vez`
    → `published === 2` e o publisher é chamado 2 vezes com o `text`
    esperado.
  - `assinatura inativa marca failed sem chamar o publisher`.
  - `falha retryable na tentativa 1 chama markForRetry`.
  - `falha retryable na tentativa 3 chama markFailed`.
  - `falha não retryable chama markFailed na hora`.
  - `exceção em um post não impede o próximo`.
  - `claimDue vazio devolve {claimed:0,...} sem chamar o publisher`.
  - `DemoSocialPublisher devolve mode demo e id demo-<postId>`.
- [ ] **Passo 2:** `npx vitest run backend/modules/publishing`. Esperado:
  FAIL.
- [ ] **Passo 3:** implementar tipos, conector demo, serviço e
  `SupabasePublishingRepository`. O repositório mapeia `snake_case` →
  `ClaimedPost`, busca as hashtags em `post_hashtags` e assina a URL no
  bucket `post-draft-images` por 3600 s.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS. `npm run typecheck`
  verde.
- [ ] **Passo 5:** commit `feat(SCRUM-58): add demo social publisher and publishing service`.

### Tarefa 4: Rota interna do agendador

**Files:**
- Create: `backend/modules/publishing/publishingRoutes.ts`
- Test: `backend/modules/publishing/publishingRoutes.test.ts`
- Modify: `backend/config/environment.ts` (adicionar
  `cronSecret: process.env.CRON_SECRET?.trim() || ''`), `backend/app.ts`
  (montar antes do handler 404 e aceitar `publishingService?` em
  `AppOptions`), `.env.example` (`CRON_SECRET=`)

**Interfaces — Consumes:** `PublishingService.publishDue()` (Tarefa 3).
**Produces:** `export function createInternalPublishingRouter(service: Pick<PublishingService,'publishDue'>, cronSecret: string): Router`,
montado em `/api/internal`. Rota: `POST /publish-due`. Responde
`200 { data: PublishRunSummary }`.

- [ ] **Passo 1: escrever os testes que falham** (supertest):
  - sem cabeçalho `Authorization` → `401` e `publishDue` não é chamado;
  - `Authorization: Bearer errado` → `401`;
  - `cronSecret` vazio → `503` "Agendador não configurado.";
  - `Bearer <segredo correto>` → `200` com o resumo devolvido pelo serviço
    falso.
- [ ] **Passo 2:** rodar. Esperado: FAIL.
- [ ] **Passo 3:** implementar com comparação em tempo constante
  (`crypto.timingSafeEqual` sobre buffers de mesmo tamanho). Em `app.ts`,
  instanciar `PublishingService(new SupabasePublishingRepository(createSupabaseAdminDataClient(), workspaceAccess), new DemoSocialPublisher())`
  quando não for injetado.
- [ ] **Passo 4:** `npx vitest run backend/modules/publishing backend/vercelDeployment.test.ts`.
  Esperado: PASS. Conferir que o rewrite `/api/:path*` da Vercel já cobre
  `/api/internal/publish-due` (sem mudança em `vercel.json`).
- [ ] **Passo 5:** commit `feat(SCRUM-58): add protected publish-due endpoint`.

### Tarefa 5: Aprovação nas rotas de rascunho

**Files:**
- Modify: `backend/modules/workspace/workspaceRoutes.ts`:
  - `draftSchema` (linhas ~38–58);
  - mapeadores `dbDraft`/`toDraft` (~linhas 209–255);
  - `POST /drafts` (~521);
  - `PATCH /drafts/:draftId` (~595–680).
- Test: `backend/modules/workspace/workspaceRoutes.test.ts`

**Interfaces — Consumes:** `CLIENT_SETTABLE_STATUSES`,
`resolveStatusAfterClientPatch`, `isEditableStatus` (Tarefa 1).
**Produces:** a resposta de rascunho ganha
`publishedAt?: string`, `publishError?: string`, `publishMode?: 'demo' | 'live'`
e `externalPostUrl?: string`, consumidos pela Tarefa 6.

Regras:
- `status` no schema do navegador: `z.enum(CLIENT_SETTABLE_STATUSES)`. O
  batch continua `z.literal('draft')`.
- `POST /drafts` com `status: 'scheduled'` também exige horário futuro.
- PATCH:
  - selecionar também `status`;
  - se `!isEditableStatus(current.status)` → `409` "Este post já está em
    publicação ou foi publicado e não pode ser alterado.";
  - `contentOrScheduleChanged` = alguma das chaves `title`, `caption`,
    `hashtags`, `visualText`, `platform`, `date`, `time`, `timezone`,
    `format`, `formatData` presente;
  - aplicar `resolveStatusAfterClientPatch`;
  - se o resultado for `scheduled`, exigir `scheduled_at` final `> now()` →
    senão `400` "Escolha um horário futuro para agendar o post.";
  - gravar `approved_at = now()` e zerar `publish_error` e
    `publish_attempts`.
- `PUT /drafts/:draftId/image` num post `scheduled` → volta a `draft` (troca
  de imagem exige nova aprovação). Em `publishing`/`published` → `409`.

- [ ] **Passo 1: escrever os testes que falham:**
  - `PATCH com status published devolve 400 e não chama a RPC`;
  - `PATCH com status scheduled e horário passado devolve 400`;
  - `PATCH de legenda em post scheduled envia status draft à RPC`;
  - `PATCH com status scheduled e horário futuro envia approved_at e zera publish_error`;
  - `PATCH em post published devolve 409`;
  - `GET /drafts mapeia publish_mode, published_at, publish_error`.
- [ ] **Passo 2:** `npx vitest run backend/modules/workspace`. Esperado:
  os novos testes falham e os antigos passam.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar de novo. Esperado: tudo PASS.
- [ ] **Passo 5:** commit `feat(SCRUM-58): require approval to schedule drafts`.

### Tarefa 6: Agenda — aprovar e ver os novos estados

**Files:**
- Modify: `src/domain/models.ts` (campos `publishedAt?`, `publishError?`,
  `publishMode?`, `externalPostUrl?` em `PostDraft`), `src/features/calendar/EditDraftDialog.tsx`,
  `src/features/calendar/DraftSchedulePanel.tsx`,
  `src/features/calendar/CalendarPage.tsx`,
  `src/features/calendar/CalendarPage.module.css` (cores de `data-status`
  para `publishing`, `published` e `failed`, com os tokens existentes),
  `src/services/postFlowRepository.ts` (mapear os novos campos)
- Test: `src/features/calendar/CalendarPage.test.tsx`

**Interfaces — Consumes:** `postStatusLabel`, `isEditableStatus`
(Tarefa 1); campos da Tarefa 5.

Comportamento:
- `DraftSchedulePanel`: remover o select de status. O status passa a ser
  só exibição, via `postStatusLabel`.
- `EditDraftDialog`:
  - `handleSchedule` vira **"Aprovar e agendar"** (aviso "Post aprovado e
    agendado.");
  - em `scheduled`, mostrar **"Cancelar agendamento"** (volta a `draft`);
  - em `failed`, mostrar `publishError` em destaque e o botão "Aprovar
    novamente";
  - em `publishing`/`published`, campos somente leitura e sem botão de
    excluir;
  - se `externalPostUrl` existir, mostrar o link.
- `CalendarPage`:
  - nos cards de post `draft`, botão **"Aprovar"** (aprovação rápida, mesmo
    PATCH com `status: 'scheduled'`);
  - posts `failed` com marcação visual de alerta;
  - recarregar os rascunhos a cada 60 s enquanto a aba estiver visível
    (`document.visibilityState`) e ao voltar o foco, para a mudança de
    status aparecer sozinha na demo.

- [ ] **Passo 1: escrever os testes que falham:**
  - `post draft mostra "Não agendado" e o botão Aprovar`;
  - `clicar em Aprovar envia PATCH com status scheduled`;
  - `post published com publishMode demo mostra "Publicado (simulado)" e campos desabilitados`;
  - `post failed mostra o motivo da falha`;
  - `o painel de agendamento não oferece mais a opção Publicado`.
- [ ] **Passo 2:** `npx vitest run src/features/calendar`. Esperado: FAIL.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** `npx vitest run && npm run typecheck && npm run lint`.
  Esperado: tudo verde.
- [ ] **Passo 5:** commit `feat(SCRUM-58): approve drafts and show publishing states in calendar`.

### Tarefa 7: Ligar o agendador, documentar e verificar em produção

**Files:**
- Create: `database/cron/publish-due-posts.sql` (script manual, **não** é
  migração, porque URL e segredo dependem do ambiente),
  `docs/adr/ADR-0012-scheduled-publishing-and-social-connectors.md`
- Modify: `docs/adr/README.md`, `docs/content-studio.md` (estados e
  aprovação), `docs/user-manual.md`

O script SQL:
- habilita `pg_cron` e `pg_net`;
- lê a URL e o segredo do **Supabase Vault**
  (`vault.decrypted_secrets`, nomes `postflow_api_url` e
  `postflow_cron_secret`);
- agenda `cron.schedule('postflow-publish-due', '*/5 * * * *', ...)` com
  `net.http_post` para `<url>/api/internal/publish-due` e o cabeçalho
  `Authorization: Bearer <segredo>`.

- [ ] **Passo 1:** escrever a ADR-0012. Contexto: Meta bloqueada até nova
  liberação. Decisão: interface `SocialPublisher`, conector demo, pg_cron +
  rota interna, aprovação obrigatória. Consequências: Meta entra como novo
  publisher, sem mudar a agenda.
- [ ] **Passo 2:** escrever o script SQL e atualizar a documentação.
- [ ] **Passo 3:** commit `docs(SCRUM-58): document scheduled publishing and cron setup`.
- [ ] **Passo 4 (com o João, pede confirmação):** gerar `CRON_SECRET` e
  colocá-lo na Vercel e no Vault. Fazer `git push`, aplicar a migração da
  Tarefa 2 no Supabase de produção (depois de backup) e rodar o script de
  cron.
- [ ] **Passo 5: verificação em produção:**
  1. Na marca de demonstração, aprovar um post para daqui a 6 minutos.
  2. Em até 11 minutos ele deve aparecer como "Publicado (simulado)" sem
     recarregar.
  3. `select status, publish_attempts, publish_mode from post_drafts where id = ...`
     deve retornar `published | 1 | demo`.
  4. Editar outro post agendado deve fazê-lo voltar a "Não agendado".
  5. O fluxo marca → geração → agenda → recarga continua funcionando.
- [ ] **Passo 6:** registrar a evidência (prints e horário) em
  `docs/entrega-final-2026-10-06.md` ou num novo
  `docs/publicacao-agendada-evidencias.md`.
