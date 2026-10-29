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
com código zero, com avisos preexistentes em scripts de terceiros em `.agents/`;
o build avisa sobre um bundle acima de 500 kB. Schema e inventário (22 SQLs),
mais integridade do snapshot remoto (19 mapeamentos), aprovados.

Testes: Node 24.22.1 do runtime do Codex; tipos/lint/build: Node 22.14.0 local.
HTTP local dos testes foi liberado para Supertest; os testes usam provedores e
credenciais fictícios. Esses resultados pertencem a esta branch e não comprovam
deploy ou execução do GitHub Actions. A verificação social publicada, quando
concluída, fica registrada separadamente com IDs e horários de teste.
