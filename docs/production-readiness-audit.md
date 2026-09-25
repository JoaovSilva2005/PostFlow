# Prontidão para produção

Data da revisão do código: 2026-09-25.

## Resultado

O repositório contém um BFF com sessão por cookies HttpOnly, integração real
opcional com OpenAI e regras de franquia transacionais no código e nas
migrações versionadas. Isso descreve a implementação local, não comprova que
as migrações tenham sido aplicadas em qualquer projeto Supabase remoto nem que
um deploy esteja atualizado. A aplicação ainda não deve ser tratada como
pronta para clientes reais até reconciliar a base remota e validar os fluxos em
PostgreSQL descartável/homologação.

## O que o código implementa

- O navegador acessa dados de negócio pela API Express. O backend valida
  sessão, membership, papel e assinatura antes de usar o cliente Supabase
  server-side; a chave privilegiada não é usada pelo frontend.
- A sessão é mantida em cookies HttpOnly. O logout restaura a sessão no SDK
  Supabase com access e refresh token, solicita `signOut({ scope: 'local' })` e
  limpa cookies mesmo se a revogação remota falhar.
- CORS de produção compara origens exatas de `APP_URL` e
  `APP_ALLOWED_ORIGINS`; não libera automaticamente previews. Desenvolvimento
  aceita loopback local.
- No modo API, `OpenAiContentProvider` usa GPT-6 Luna para texto e GPT Image
  2.5 Flare por padrão, com GPT Image 2.5 Sunburst como nível opcional de maior
  qualidade. O nível enviado pelo navegador é validado pelo BFF; a chave é lida
  no backend e falhas não ativam fallback demonstrativo silencioso.
- O backend reserva texto/imagem no PostgreSQL antes da chamada ao provedor,
  aplica `text_limit` e `image_limit` do plano e finaliza ou libera a reserva.
  Individual: 1 texto + 1 imagem; cada item de lote: 1 texto + 0 imagens, até
  42 itens.
- A cobrança mostra consumo e reservas no período da assinatura. A reserva usa
  lock de linha no banco, não estado local da função serverless.
- `POST /drafts` e `PATCH /drafts/:draftId` agrupam post e hashtags por RPC
  transacional. Criação de marca e membership também é atômica; provisionamento
  inicial usa lock por usuário.
- O BFF impõe legenda de até 5.000 caracteres, texto visual de até 160 e o
  limite cadastrado da plataforma para legenda mais hashtags. JSON acima de
  8 MiB recebe `413`.
- Pagamento e documento fiscal continuam simulados. O comprovante é acadêmico e
  não substitui NFS-e; não há integração de captura de pagamento ou emissão
  fiscal real.

## Limitações ainda abertas

1. **Estado remoto não confirmado.** As migrações estão divididas entre
   `database/migrations` e `supabase/migrations`. Algumas podem ter sido
   aplicadas manualmente e não aparecer no histórico do CLI. A aplicação da
   migração que adiciona as RPCs transacionais e as reservas precisa ser
   confirmada pelo responsável pelo projeto, comparando o schema real e o
   histórico remoto após backup e em homologação.
2. **Transações ainda sem execução local de integração.** Testes unitários e
   verificações estáticas cobrem chamadas, locks e grants descritos no SQL; só
   um Postgres local descartável comprova a sintaxe e o comportamento de lock,
   rollback e concorrência da migração executada.
3. **`service_role` ignora RLS.** A isolação depende das verificações do BFF.
   É necessário validar com usuários e workspaces distintos que IDs fornecidos
   pelo cliente nunca contornam membership e papel.
4. **Falha depois de uma etapa externa.** Se o processo terminar abruptamente,
   uma reserva pendente expira após uma hora e é limpa ao consultar a cobrança
   ou reservar novamente. Se OpenAI completar texto e a
   etapa de imagem falhar, a franquia libera a solicitação incompleta, embora o
   provedor externo possa ter cobrado a etapa já processada.
5. **Cobrança e fiscal não são reais.** O sistema não deve receber pagamentos
   nem emitir documentos fiscais legais até integrar provedores apropriados e
   rever a imutabilidade, conciliação e obrigações aplicáveis.
6. **Imagem não é persistida.** A imagem permanece como data URL da prévia e
   não é enviada ao Supabase Storage ao salvar o rascunho.

## Sequência recomendada antes de liberar dados reais

1. Criar backup e obter o histórico de migrações e o schema do projeto
   Supabase existente; não reaplicar arquivos por suposição.
2. Reconciliar cada migração histórica entre os dois diretórios, testar a
   sequência completa em homologação e confirmar as RPCs, privilégios, grants,
   tabelas e índices necessários.
3. Executar testes de integração em Supabase/Postgres local descartável para
   duas chamadas concorrentes no limite, franquia esgotada, falha do provedor,
   rollback de draft/hashtags, rollback de marca/membership e provisionamento
   inicial concorrente.
4. Validar com dois usuários, várias marcas e papéis diferentes que o BFF
   impede leitura/escrita entre tenants; conferir que migrations e testes
   executados correspondem ao commit/deploy candidato.
5. Configurar `APP_URL`, allowlist exata em `APP_ALLOWED_ORIGINS`, chaves
   server-side, limites do provedor OpenAI, SMTP e alertas. Não colocar segredos
   em variáveis `VITE_`.
6. Manter pagamentos e fiscal sinalizados como demonstração até completar uma
   integração real e revisão independente.

## Verificações do repositório

`npm run db:migrations:check` valida somente inventário e referências de
migração. `npm test` inclui testes de código e checks estáticos; nenhum deles
atesta o estado de um Supabase remoto. `npm run db:verify` consulta a base
apontada pela configuração local e `npm run db:test-crud` altera dados, então
use-os apenas com uma base descartável quando for necessária essa evidência.
