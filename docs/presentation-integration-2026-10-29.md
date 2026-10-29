# Integração para a apresentação de 03/11

Base: `origin/main` em `a6d3de32cc33826c5f2226353547fd45cc7b3775`.
Branch de implementação: `codex/apresentacao-03-11`, checkout isolado
`PostFlow-apresentacao`. Os checkouts de redesign não foram alterados.

## Mudanças

- Recuperação: rota pública `/reset-password`, BFF `POST /api/auth/reset-password`,
  prova de recuperação OTP de uso único, confirmação de senha, erros e novo login.
  As credenciais do Supabase ficam no servidor. Detalhes em `password-recovery.md`.
- Cobrança: `workspaceBilling.ts` aplica a titularidade real nas duas marcas e é
  compartilhado pela API que reserva franquia e pelo worker. Não foi criada uma
  regra de delegação inexistente no produto.
- CI: workflow de testes, tipos, lint, build e verificações estáticas do schema,
  inventário e correspondência histórica de migrações. Usa `npm ci`, Node 22 e
  credenciais fictícias; não aplica SQL nem chama serviços de produção.
- Banco: 19 correspondências de SQL remoto/local verificadas por leitura.
  Nenhuma migração foi reaplicada e nenhum histórico foi reparado.

## Integração com a UI em andamento

O único ponto alterado em `src/app/App.tsx` é o import de `ResetPasswordPage` e
a rota pública `/reset-password`, junto de `/login` e fora de `ProtectedRoute`.
Não houve mudanças em `AppContext`, `ProtectedRoute`, login existente nem
contratos compartilhados de conteúdo. O CSS novo pertence somente à página de
redefinição. Ao integrar o redesign, preserve essa rota pública e o método novo
de `authApi.ts`; mantenha o restante da composição visual do outro agente.

## Configuração e limites

SMTP foi retirado do escopo pelo usuário em 29/10. Não houve alteração de SMTP,
remetente, domínio, credenciais pessoais nem envio de e-mail. Para ativar a
redefinição completa em produção, ainda são necessários deploy da rota, allowlist
de `/reset-password` e template com `TokenHash`, descritos no guia. Os testes
controlados não comprovam entrega de e-mails.

Os adaptadores sociais reais continuam dependentes de apps, permissões e
credenciais externas. O sucesso do modo demonstração nunca encerra SCRUM-58.
Pagamentos e fiscal continuam acadêmicos. Não foi incorporada a branch antiga
`feat/scrum-58-publicacao-agendada` nem adicionado outro agendador.

## Checks locais

389 testes aprovados em 59 arquivos na suíte final, incluindo recuperação,
pagador, franquia e demonstração social. Tipos e build aprovados. Lint terminou
com código zero; scripts de ferramentas de terceiros em `.agents/` ficam fora do
escopo do lint da aplicação. O build avisa sobre um bundle acima de 500 kB. Schema e inventário (22 SQLs),
mais integridade do snapshot remoto (19 mapeamentos), aprovados.

Testes: Node 24.22.1 do runtime do Codex; tipos/lint/build: Node 22.14.0 local.
HTTP local dos testes foi liberado para Supertest; os testes usam provedores e
credenciais fictícios. Esses resultados pertencem a esta branch e não comprovam
deploy das novas rotas. O CI limita a concorrência a dois workers, após uma
rodada remota atingir o timeout de 5 s de um teste da agenda com concorrência
automática. O teste continua com seu timeout original.

## Demonstração publicada

Em 29/10, o usuário autorizou uma conta isolada, marca, assinatura de teste de
um dia e dois rascunhos no ambiente publicado. Não foram criados novos planos
de catálogo nem faturas: a assinatura de teste usa um plano existente.
Conexão `e6e987e0-4664-4c9f-8af8-40abee6eef62`, `accountType: demo`.

- Enfileirado às 15:53:46 UTC para 15:55:01 UTC, com imagem persistida e
  aprovação: `6a8e8144-8d86-48b7-83ea-d26a20aac2f9`.
- Às 15:56:13 UTC, nova consulta: `published`, `simulated: true`, uma tentativa,
  `remotePostId: demo-83596781-2ea5-4312-9176-9c5f02513418`, `remoteUrl: null`.
- Segundo envio `8e02c156-792e-477c-95da-832b8b60645d` cancelado antes do prazo;
  a nova consulta preservou o cancelamento. Cron processou sem navegador aberto.

A chamada de rede final foi simulada pelo adaptador demo. Zero chamadas pagas de
IA e nenhum post real. Essa execução usa a versão publicada anterior ao PR e
comprova o ciclo social demonstrativo; recuperação/pagador continuam mudanças
da branch de revisão. Cenários de falha são controlados localmente. A assinatura
isolada tem período 29–30/10: não assuma seu uso na apresentação de 03/11.
