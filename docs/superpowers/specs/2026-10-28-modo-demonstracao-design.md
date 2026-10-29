# Modo demonstração da publicação social — design

Data: 2026-10-28 · Card: SCRUM-58 · Autor: João Vitor da Silva (com Claude)

Este documento substitui `2026-10-28-publicacao-redes-sociais-design.md`,
que está na branch `feat/scrum-58-publicacao-agendada`. Aquele design foi
escrito sem saber que a `main` já tinha o módulo de publicação social de
12/10 (ADR-0012).

## Intenção

O módulo de 12/10 já faz:

- OAuth por marca;
- aprovação com consentimento e snapshot;
- fila com agendador;
- conversão para JPEG;
- reconciliação e novas tentativas.

Ele está bloqueado porque não há apps de desenvolvedor das redes. Em
**03/11/2026** a banca precisa ver o ciclo completo funcionando:

conectar → aprovar → agendar → publicar sozinho.

Também é preciso recuperar o trabalho de 25–28/09, que nunca foi para o
GitHub: custo de IA, cobrança por conta, limite de marcas e privilégios
mínimos.

## Objetivos

1. **Modo demonstração.** Com `SOCIAL_DEMO_MODE=true` no servidor, as quatro
   redes (Facebook, Instagram, LinkedIn, TikTok) usam adaptadores de
   demonstração no lugar dos reais. O fluxo do módulo existente roda
   inteiro, sem chamar nenhuma rede externa:
   - o OAuth "retorna" na hora;
   - a conta aparece como "<Rede> — conta de demonstração";
   - a publicação passa pela fila e pelo agendador e termina `published`,
     marcada como **simulada**.
2. **A interface deixa a simulação evidente.** A tela `/social` mostra um
   aviso de modo demonstração. Publicações simuladas aparecem como
   **"Publicado (simulado)"**.
3. **Trabalho de 25–28/09 recuperado** sobre a `main`, com os testes verdes.
4. **Login honesto.** Se o provedor de autenticação estiver indisponível,
   a resposta é 503 "Serviço de autenticação indisponível. Tente novamente
   em instantes.", e não 401 "E-mail ou senha inválidos.". Hoje o banco
   pausado aparece como senha errada.

## Não objetivos

- Integração real com a Meta ou outras redes: isso é só configuração depois
  que os apps existirem.
- Alterar o modelo de status da agenda. O ADR-0012 separa o status
  editorial do status verificado por conta, e essa separação se mantém.
- O agendador e o modelo de status da branch `feat/scrum-58-publicacao-agendada`.
  Eles são descartados, e a branch fica no GitHub apenas como histórico.

## Anti-objetivos

- O modo demonstração **ligado sem que ninguém perceba**. Ele só existe com
  a variável explícita e sempre aparece na interface e nos dados
  (`simulated: true`, `accountType: 'demo'`).
- Qualquer chamada HTTP a uma rede social em modo demonstração.
- Contornar as proteções do módulo: membership, papel, assinatura, cripto
  de tokens, state do OAuth, snapshot aprovado e lease do worker continuam
  valendo em modo demonstração.
- Quebrar o fluxo da demo (marca → geração → agenda → recarga) ou o
  painel administrativo financeiro, fiscal e contábil.

## Decisões

- O modo demonstração **substitui os quatro adaptadores**. Não cria um id
  de rede novo, porque `enqueue` exige que a rede do rascunho seja igual à
  da conta e o banco tem um check `provider in (...)`. Assim nada muda no
  banco.
- Os segredos de infraestrutura continuam obrigatórios em modo
  demonstração: `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET` (32 ou
  mais caracteres) e `SOCIAL_SCHEDULER_ENABLED=true`. Apenas as credenciais
  dos apps das redes deixam de ser exigidas. Com isso, a demonstração
  exercita o mesmo agendador e a mesma criptografia que a produção real
  vai usar.
- O TikTok em modo demonstração não exige `TIKTOK_MEDIA_DOMAIN_VERIFIED` nem
  `TIKTOK_DIRECT_POST_APPROVED`. Ele devolve `creatorInfo` simulado, com
  `privacyLevelOptions: ['SELF_ONLY','PUBLIC_TO_EVERYONE']`.
- Marcação da simulação:
  - o adaptador grava `operation.demo = true`;
  - o DTO de publicação ganha `simulated: boolean`;
  - a visão geral ganha `demoMode: boolean`;
  - a conta tem `accountType: 'demo'` e
    `externalAccountId: 'demo-<rede>'`.
- O trabalho de 25–28/09 entra por cherry-pick dos commits `1e964d0`,
  `d609d21`, `32a8a9f` e `4d458b7` da branch antiga. Onde houver
  sobreposição com a `main` de 12/10, prevalece o comportamento mais novo
  da `main`.

## Restrições

- Prazo: 03/11/2026, com o modo demonstração funcionando em produção.
- Stack e padrões do repositório (ver `docs/architecture.md` e as ADRs).
  Próximo número livre de ADR: **0014**.
- Antes de qualquer verificação em produção, o projeto Supabase precisa
  ser reativado. Ele está pausado ou indisponível desde pelo menos 28/10.

## Ativação em produção (com o João, fora do código)

1. Reativar o projeto Supabase.
2. Fazer backup e aplicar as quatro migrações de 25–28/09. Elas têm
   timestamps anteriores à `20261012181805` já aplicada, então conferir o
   histórico remoto antes. Pode ser preciso usar `--include-all` ou
   aplicá-las pelo SQL Editor.
3. Na Vercel, cadastrar `SOCIAL_DEMO_MODE=true`,
   `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_CRON_SECRET` e
   `SOCIAL_SCHEDULER_ENABLED=true`, e fazer o redeploy.
4. Rodar `database/operations/social-publishing-cron.sql`, que já existe na
   `main`.
5. Testar: conectar o Instagram de demonstração, aprovar um post com
   horário poucos minutos à frente e vê-lo virar "Publicado (simulado)".
