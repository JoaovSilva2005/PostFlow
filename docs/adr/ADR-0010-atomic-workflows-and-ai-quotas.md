# ADR-0010: RPCs atômicas e franquias de IA no PostgreSQL

## Status

Accepted — 2026-09-25

## Contexto

O PostFlow executa o BFF em funções serverless, então estado em memória não
coordena requisições concorrentes. Os campos `text_limit` e `image_limit` dos
planos precisam ser aplicados de forma consistente. Além disso, post e hashtags
e marca e membership não podem ficar parcialmente persistidos quando uma
segunda gravação falha. A remoção da unicidade de `brands.user_id` também torna
vulnerável o provisionamento inicial baseado em leitura seguida de inserção.

## Decisão

- Regras que reservam consumo ou agrupam gravações em uma transação ficam em
  funções PostgreSQL invocadas pelo BFF.
- A reserva bloqueia `usage_counters` do workspace e período, soma consumo e
  reservas ativas e compara com os limites carregados do plano no banco.
- Uma geração individual conta um texto e uma imagem. Cada item do lote conta um
  texto e nenhuma imagem. O provedor só é chamado depois da reserva.
- Sucesso consome as unidades; falha do provedor as libera. Reservas pendentes
  expiram após uma hora e são limpas na leitura da cobrança ou na próxima
  tentativa daquele workspace e período.
- RPCs persistem rascunho/hashtags, marca/membership e workspace inicial
  atomicamente. O provisionamento usa advisory lock por usuário.
- As funções usam `search_path` vazio e permissões explícitas para
  `service_role`; não são chamadas diretamente por `anon` ou `authenticated`.
- Migrações históricas permanecem em seus diretórios. Novas migrações são
  criadas em `supabase/migrations` pela CLI e registradas no inventário.

## Consequências

- As franquias funcionam entre instâncias serverless e chamadas simultâneas.
- Falhas entre inserções SQL não deixam entidades parcialmente persistidas.
- Uma indisponibilidade do banco impede a geração e a gravação, em vez de
  permitir consumo fora da franquia.
- Se o processo serverless terminar abruptamente após o provedor responder, a
  reserva permanece temporariamente e pode ser liberada após expirar; esse caso
  requer observação em integração local e em produção.
- A linhagem dividida de migrações exige reconciliação explícita antes de
  sincronizar histórico de um projeto Supabase existente.

## Validação

- Testes de serviço e rota cobrem franquia esgotada, requisições concorrentes e
  liberação após falha do provedor.
- Testes estáticos verificam locks, permissões, `search_path` e atomicidade no
  SQL versionado.
- A instalação limpa e os efeitos transacionais devem ser testados em uma base
  Supabase local descartável; nenhuma dessas verificações consulta um projeto
  remoto.
