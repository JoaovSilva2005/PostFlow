# Publicação automática no Facebook e Instagram — design

Data: 2026-10-28 · Card: SCRUM-58 · Autor: João Vitor da Silva (com Claude)

## Intenção

O PostFlow já gera legenda e imagem com IA, organiza os posts em uma agenda e
salva os rascunhos. Falta o passo que fecha o ciclo do produto: **publicar
sozinho, na hora marcada, nas redes do cliente**.

O PostFlow é pensado como SaaS por assinatura. Cada cliente entra no sistema,
conecta o **próprio** Facebook e Instagram e, a partir daí, os posts aprovados
saem automaticamente.

Há também um objetivo de curto prazo: demonstrar a publicação real na
primeira apresentação do projeto em **03/11/2026**. Hoje essa é a limitação
mais visível do sistema.

## Escopo até 03/11 (decidido pelo João em 28/10)

O acesso de desenvolvedor da Meta está temporariamente bloqueado (login
recente em um celular novo). Por isso, **até 03/11 não haverá conexão com
nenhuma rede real**. A entrega desta fase é:

1. **Aprovação e estados do post** completos, como descritos abaixo.
2. **Agendador real** (pg_cron → rota interna) publicando por um
   **conector "Demonstração"**. Ele não chama nenhuma rede, registra a
   publicação como simulada e devolve um ID e um link fictícios
   identificados como simulação. Na agenda, o post aparece como
   **"Publicado (simulado)"**. Isso segue o padrão do pagamento e da nota
   fiscal demonstrativos do PostFlow.
3. Os conectores ficam atrás de uma interface única
   (`SocialPublisher`), para que Facebook e Instagram entrem depois sem
   mudar a agenda nem o agendador.

Nesta fase, toda marca usa o conector de demonstração para qualquer rede, e
aprovar não exige conexão. A parte de **conexão OAuth com a Meta**, a
criptografia de tokens e as chamadas da Graph API descritas abaixo
**ficam para a fase seguinte**, quando o acesso for liberado. O modo
lembrete para redes sem publicação automática também fica para essa fase.

Em paralelo, e fora deste documento: commit e verificação do trabalho
pendente desde 06/10 (pré-condição), e configuração do e-mail de
confirmação e recuperação de senha (SCRUM-57).

## Objetivos (visão completa, incluindo a fase Meta)

1. O cliente conecta uma Página do Facebook e a conta profissional do
   Instagram ligada a ela pelo fluxo oficial de login da Meta (OAuth), dentro
   do PostFlow.
2. O cliente revisa cada post criado pela IA e **aprova** ou não:
   - **Aprovado** → status `scheduled` → o post será publicado no horário.
   - **Não aprovado** → continua sem agendamento (status `draft`, exibido
     como "Não agendado"). **Nunca é publicado.**
3. Um agendador publica os posts `scheduled` quando o horário chega, com a
   conta conectada daquele cliente.
4. O post guarda o resultado: publicado, com o link do post na rede, ou
   falhou, com um motivo legível. As falhas aparecem em destaque na agenda.
5. O cliente pode desconectar a conta. A chave de acesso é apagada.

## Não objetivos (por enquanto)

- X/Twitter e LinkedIn. O modelo deve permitir adicioná-los depois, mas não
  entram agora.
- Carrossel e Reels. Nesta versão só publica o formato `static` (uma
  imagem + legenda). Posts de outros formatos aprovados para Facebook ou
  Instagram falham com o motivo "formato ainda não suportado para publicação
  automática". *(Decisão do Claude.)*
- Métricas de engajamento (curtidas, alcance).
- Aprovação da Meta para uso público (App Review e verificação da empresa).
  Isso é um passo de lançamento, não de código. Até lá, o app roda em modo de
  desenvolvimento e só funciona para contas com papel no app (administrador
  ou testador).

## Anti-objetivos (seria fracasso mesmo que funcionasse)

- **Publicar algo que o usuário não aprovou.**
- Publicar o mesmo post duas vezes.
- A chave de acesso da Meta chegar ao navegador, aparecer em logs ou ficar
  em texto puro no banco.
- Um cliente conseguir publicar com a conta de outro cliente (isolamento por
  workspace e marca, como no resto do PostFlow).
- Quebrar o fluxo que já existe (marca → geração → agenda), que será
  demonstrado ao vivo em 03/11.

## Restrições

- Stack atual: React + TypeScript (frontend), Express como BFF (`backend/`),
  Supabase/PostgreSQL, deploy na Vercel (plano gratuito), função serverless
  em `api/index.ts`. Seguir `docs/architecture.md` e as ADRs. Este design deve
  virar uma nova ADR.
- Vercel gratuita só permite cron diário, então **não serve como relógio**.
- O backend usa `service_role` e é o responsável pelo isolamento
  (ADR-0001). Toda rota nova verifica membership, papel e assinatura como as
  existentes.
- As imagens dos rascunhos estão no bucket privado `post-draft-images`. O
  Instagram exige uma URL pública para baixar a imagem, o que é resolvido com
  URL assinada temporária.
- Prazo: apresentação em 03/11/2026. O fluxo completo precisa funcionar em
  produção com a conta de demonstração do João até lá.
- **Pré-condição:** há cerca de 2.000 linhas sem commit no repositório (custo
  de IA, migrações de 25 a 28/09 e outras). Elas precisam estar commitadas e
  com testes passando antes de começar esta funcionalidade. O repositório git
  é a pasta `PostFlow/`, com o remoto em `github.com/JoaovSilva2005/PostFlow`
  e o último commit em 06/10. Esse acerto é uma etapa separada, feita
  primeiro.

## O que foi decidido

### Conexão (por marca)

- A conexão pertence à **marca**, não ao workspace, porque um workspace pode
  ter várias marcas (ADR-0009) e cada marca é um negócio com suas próprias
  redes. *(Decisão do Claude.)*
- Só `owner` e `admin` do workspace conectam ou desconectam. `editor` aprova
  e agenda posts. `viewer` só visualiza. *(Decisão do Claude.)*
- Fluxo: botão "Conectar Facebook e Instagram" na tela da marca → login da
  Meta → callback no backend → o backend troca o código por um token de longa
  duração → lista as Páginas do usuário e o Instagram profissional ligado a
  cada uma → o cliente escolhe a Página → o backend guarda o **Page access
  token** (derivado do token de longa duração, sem expiração enquanto o
  usuário não revogar), o ID da Página e o ID do Instagram.
- Permissões pedidas: `pages_show_list`, `pages_read_engagement`,
  `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`,
  `business_management`.
- O token é criptografado no banco com chave do ambiente do servidor
  (por exemplo, AES-256-GCM com `SOCIAL_TOKEN_ENCRYPTION_KEY`). O frontend só
  recebe o nome da Página, o @ do Instagram e o estado da conexão.
- O parâmetro `state` do OAuth é assinado e amarrado ao usuário, ao workspace
  e à marca, contra CSRF e troca de marca.
- Se a Meta responder que o token é inválido ou foi revogado, a conexão é
  marcada como "precisa reconectar" e a tela da marca mostra isso.

### Aprovação e estados do post

- `draft` = "Não agendado": criado pela IA ou editado, aguardando aprovação.
  Nunca é publicado, mesmo que o horário passe.
- `scheduled` = aprovado. O agendador vai publicar.
- `publishing` = o agendador pegou o post (trava contra publicação dupla).
- `published` = publicado, com `published_at`, ID externo e link do post.
- `failed` = falhou definitivamente, com `publish_error` legível.
- O status `published` **só pode ser definido pelo agendador**. Hoje a API
  aceita `published` vindo do navegador (`workspaceRoutes.ts`), e isso deve
  ser removido.
- Editar um post `scheduled` (legenda, imagem, horário) o devolve para
  `draft` e exige nova aprovação. *(Decisão do Claude.)*
- Um post `failed` pode ser corrigido e aprovado de novo (volta a
  `scheduled`).
- Aprovar exige: marca com conexão ativa para aquela rede, imagem presente
  (Instagram exige imagem) e horário no futuro.
- A agenda já tem "Salvar como agendado" (`EditDraftDialog.tsx`). Esse passa
  a ser o botão **Aprovar e agendar**. Também deve haver aprovação rápida
  direto do card ou da lista do dia, para aprovar a semana sem abrir post por
  post.

### Agendador

- **Supabase `pg_cron` + `pg_net`** chama a cada 5 minutos uma rota interna
  do backend (por exemplo, `POST /api/internal/publish-due`), protegida por um
  segredo compartilhado (`CRON_SECRET`) no cabeçalho.
- A rota seleciona posts `scheduled` com `scheduled_at <= now()` e os marca
  como `publishing` em uma única operação atômica (`FOR UPDATE SKIP LOCKED`
  ou `UPDATE ... RETURNING`), evitando publicação dupla.
- Processa um lote limitado por chamada, para caber no tempo máximo da
  função serverless. O que sobrar fica para a próxima chamada.
- Publicação:
  - **Facebook:** `POST /{page-id}/photos` com a URL da imagem e a legenda.
  - **Instagram:** cria o container (`POST /{ig-user-id}/media` com
    `image_url` e `caption`) e depois publica
    (`POST /{ig-user-id}/media_publish`).
  - A legenda enviada é a legenda + hashtags do rascunho, respeitando o
    limite da plataforma.
- Falha temporária (rede, 5xx, limite de taxa): volta a `scheduled` com
  contador de tentativas. Na 3ª falha vira `failed`. Falha definitiva (token
  revogado, imagem recusada, permissão ausente): vira `failed` na hora.
- Um post `publishing` parado há mais de 15 minutos (função morreu no meio)
  volta a `scheduled` na próxima execução, **exceto se já houver um ID
  externo gravado**. Nesse caso ele é tratado como publicado.
- O atraso aceitável é de até 5 minutos. O horário respeita o
  `schedule_timezone` do post, que já existe.

### Casos de borda (decisões do Claude)

- **Posts já `scheduled` antes desta versão:** a migração os devolve todos
  para `draft`. Ninguém os aprovou com o novo significado, e publicá-los
  violaria o primeiro anti-objetivo. A conta de demonstração precisa ser
  reaprovada antes de 03/11.
- **Reverificação na hora de publicar:** o agendador confere se a assinatura
  do workspace está ativa (mesma regra de acesso das rotas) e se a conexão da
  marca está ativa. Se a assinatura estiver inativa, o post vira `failed` com
  "assinatura inativa". A aprovação é da marca, não da pessoa, então o
  aprovador perder o papel não afeta posts já aprovados.
- **Desconectar:** posts `scheduled` daquela rede continuam `scheduled`. Se a
  conexão continuar ausente no horário, eles viram `failed` com "conta
  desconectada".
- **Reconectar com outra Página ou outro Instagram:** cada aprovação grava o
  ID da conexão usada. Se a conexão ativa da marca no horário for outra, o
  post volta para `draft` e pede nova aprovação. Nunca publica numa conta
  diferente da aprovada.
- **Página sem Instagram ligado:** é permitido. A marca fica conectada só
  ao Facebook, e aprovar um post de Instagram exige a ligação. Instagram sem
  Página não é suportado neste fluxo.
- **Atraso máximo:** se um post ainda não tiver saído 2 horas depois do
  horário (cron fora do ar, repetições), ele vira `failed` com "horário
  perdido" em vez de sair atrasado.
- **Formato da imagem:** as imagens geradas são WebP, e a publicação do
  Instagram aceita só JPEG. O backend converte para JPEG antes de criar o
  container (por exemplo, com `sharp`, confirmando que roda na Vercel) e gera
  a URL assinada do arquivo convertido.

### Uma rede por post

O modelo atual tem uma `platform_id` por rascunho, e isso se mantém. Publicar
o mesmo conteúdo no Facebook e no Instagram significa ter dois rascunhos (a
geração em lote já cria um por rede).

## Configuração externa (feita pelo João, fora do código)

1. Conta Instagram profissional ligada a uma Página do Facebook, pela Página.
2. App em developers.facebook.com com os casos de uso de Página e Instagram,
   em modo de desenvolvimento.
3. URL de callback do OAuth cadastrada no app (produção na Vercel e
   localhost).
4. Variáveis de ambiente na Vercel e no `.env.local`: `META_APP_ID`,
   `META_APP_SECRET`, `META_REDIRECT_URI`, `SOCIAL_TOKEN_ENCRYPTION_KEY`,
   `CRON_SECRET`. Nada disso é colado em chat ou commitado.
5. Job `pg_cron` criado no Supabase de produção apontando para a URL da
   Vercel.

## Deixado para quem for construir

- Nomes de tabelas e colunas e o formato da migração. Seguir o padrão em
  `supabase/migrations`, já que as duas linhagens de migração ainda não
  foram reconciliadas (ver `docs/production-readiness-audit.md`).
- Se a criptografia fica em Node (`crypto`) ou no banco.
- O layout visual dos estados na agenda e na tela da marca, seguindo os
  componentes e tokens existentes.
- A versão da Graph API, desde que fique fixada em configuração.
- Estrutura do cliente Meta, desde que fique atrás de uma interface, como o
  provedor de IA (ADR-0002), para poder ser substituído por um falso nos
  testes.

## Verificação esperada

- Testes unitários para: transições de estado (inclusive "editar volta para
  `draft`" e "o navegador não pode marcar `published`"), seleção atômica,
  repetição e falha definitiva, e isolamento entre workspaces e marcas. Todos
  com cliente Meta falso.
- Teste real em produção com a conta de demonstração: aprovar um post para
  daqui a alguns minutos e vê-lo aparecer no Instagram e no Facebook.
- O fluxo atual da demo (marca → geração → agenda → recarga) continua
  funcionando.
