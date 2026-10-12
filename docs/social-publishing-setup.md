# Configuração das integrações diretas

Implementação de 12/10/2026 — SCRUM-58. O usuário confirmou que ainda não possui apps de desenvolvedor. A integração fica desabilitada até a configuração real; nenhum cliente recebe conexão ou publicação fictícia.

## Escopo disponível

Facebook **Páginas**, Instagram **Business/Creator via Instagram Login**, LinkedIn **perfil pessoal** e TikTok **foto única por Direct Post**. Cada rascunho utiliza sua legenda específica e pode ter várias contas da mesma rede vinculadas à marca. X e fornecedores pagos não fazem parte desta entrega. Nenhum preço de API é garantido permanentemente; infraestrutura/IA continuam separados.

Carrossel e Reels não são convertidos em imagem estática: precisam de todos os slides/vídeo antes de uma entrega futura. LinkedIn Páginas/Community Management não foi habilitado pelo adaptador de perfil.

## Apps e endereços de retorno

Configurar `APP_URL=https://post-flow-ochre.vercel.app` no servidor de produção. Em desenvolvimento, usar a URL exata do ambiente registrada no app; vários provedores exigem HTTPS e não aceitam localhost.

| Rede      | Cadastro e produtos                                                                                                                                                                                                         | Callback exato de produção                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Facebook  | [Meta Developers](https://developers.facebook.com/apps/): Facebook Login e acesso às Páginas; `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.                                                             | `https://post-flow-ochre.vercel.app/api/social/oauth/facebook/callback`  |
| Instagram | [Meta Developers](https://developers.facebook.com/apps/): produto Instagram API com Instagram Login; `instagram_business_basic`, `instagram_business_content_publish`. Usar Instagram App ID/secret próprios desse produto. | `https://post-flow-ochre.vercel.app/api/social/oauth/instagram/callback` |
| LinkedIn  | [Developer Portal](https://www.linkedin.com/developers/apps): Share on LinkedIn e Sign In with LinkedIn using OpenID Connect; `openid`, `profile`, `w_member_social`.                                                       | `https://post-flow-ochre.vercel.app/api/social/oauth/linkedin/callback`  |
| TikTok    | [Developer Portal](https://developers.tiktok.com/apps/): Login Kit e Content Posting API; `user.info.basic`, `video.publish`. Verificar domínio/prefixo de mídia e realizar auditoria Direct Post antes do uso público.     | `https://post-flow-ochre.vercel.app/api/social/oauth/tiktok/callback`    |

As versões/flows usados seguem [Meta Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [TikTok fotos](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post) e [TikTok diretrizes](https://developers.tiktok.com/docs/en/content-sharing-guidelines). A versão Graph é configurável; conferir o suporte no painel antes de ativar.

Para clientes externos, solicitar a revisão/nível de acesso aplicável. Preencher no cadastro do app as políticas de privacidade, exclusão de dados e informações de suporte reais do responsável. O adaptador não substitui esses cadastros e não aceita os termos de uma rede em nome do usuário. Testes de HTTP com fixtures não comprovam aprovação pública.

## Segredos do servidor

Usar `.env.example` como referência. Nunca colocar client secrets, tokens ou chave de criptografia em `VITE_*`, Git, front-end ou mensagens. Na Vercel, cadastrar nas variáveis de ambiente do projeto e redeployar. Não alterar a chave de criptografia sem um plano de rotação/reconexão.

- `SOCIAL_TOKEN_ENCRYPTION_KEY`: 32 bytes aleatórios em base64, para AES-256-GCM com contexto da marca/rede/conta.
- `SOCIAL_CRON_SECRET`: segredo aleatório de pelo menos 32 caracteres, exclusivo do executor. Não reutilizar uma chave do Supabase ou de rede social.
- Credenciais dos quatro apps conforme os nomes de `.env.example`.
- `TIKTOK_MEDIA_DOMAIN_VERIFIED=true` e `TIKTOK_DIRECT_POST_APPROVED=true` somente após as verificações correspondentes. Enquanto isso, TikTok fica indisponível para clientes.

O OAuth usa state aleatório de uso único, vinculado a usuário/marca, com validade de 15 minutos. Depois do retorno, o administrador seleciona as contas autorizadas. A sessão do PostFlow precisa permanecer válida; se expirar durante o consentimento, entrar novamente e reiniciar a conexão.

## Banco e executor

Migração: `supabase/migrations/20261012181805_social_publishing.sql`. Tabelas e funções acessíveis somente ao BFF/service_role; RLS habilitado, sem grants para anon/authenticated. O BFF valida membership antes de usar a chave privilegiada. Tokens cifrados não aparecem nos DTOs.

1. No **Supabase Vault**, criar `postflow_app_url` com a URL de produção e `postflow_social_cron_secret` com o mesmo segredo do BFF. Fazer isso no painel protegido, sem imprimir o segredo em logs.
2. Executar [social-publishing-cron.sql](../database/operations/social-publishing-cron.sql). O Cron chama o endpoint autenticado a cada minuto e apaga sessões OAuth expiradas a cada hora. [Documentação oficial](https://supabase.com/docs/guides/functions/schedule-functions).
3. Validar HTTP 200 do worker e consultar os registros de execução Cron/pg_net. Sem jobs, o retorno deve ser uma lista vazia.
4. Somente então configurar `SOCIAL_SCHEDULER_ENABLED=true` no servidor. Sem esse sinal, o app bloqueia a criação de publicações, evitando fila sem executor.

Os jobs são reservados com lease e `SKIP LOCKED`; o executor tem chamadas limitadas e salva fases de processamento. A frequência desejada é de um minuto, mas fila, processamento e moderação podem atrasar a conclusão. A Vercel Hobby não oferece Cron a cada minuto; esta estratégia usa Supabase Cron, preservando um único executor. Os termos da hospedagem comercial ainda precisam ser atendidos.

## Operação e integridade

Antes de enfileirar, o servidor verifica que a prévia aprovada corresponde ao conteúdo e à imagem atuais. Salva uma cópia JPEG privada imutável e a legenda/hashtags aprovadas no snapshot. Editar o rascunho posteriormente não modifica a publicação já agendada: cancelar a intenção antiga e confirmar uma nova.

Imagem e registro no banco não formam uma transação distribuída. Uma falha antes da inserção usa compensação; eventual falha na remoção pode deixar arquivo órfão, que exige limpeza operacional. A inserção do snapshot e da intenção de envio acontece em uma única linha/transação no banco, com índice de deduplicação. Eventos de status/tentativa são auditados.

URLs de entrega são assinadas e limitadas ao job, válidas por quatro horas a partir do envio; o Storage permanece privado. Domínio verificado no TikTok deve cobrir o domínio/prefixo `/api/social/media/` utilizado. Publicações de imagem não dependem do preview expirado da agenda.

Só a confirmação da rede determina o status externo; o status editorial/manual continua separado. Se um envio pode ter sido aceito antes de uma falha, o job fica `unknown`: consultar a rede/reconectar para reconciliar. Nunca clicar em repetir manualmente sem verificar um resultado desconhecido. Alguns provedores não permitem recuperar um ID que se perdeu antes da persistência; nesse caso o resultado precisa ser verificado na conta.

Cancelar funciona antes do dispatch e sem reserva ativa. Não desfaz conteúdo que já chegou à rede. Desconectar apaga as credenciais locais e cancela intenções futuras que ainda não foram enviadas; publicação em curso pode concluir. Revogação global do app deve ser feita no painel da própria rede, pois pode afetar outras marcas/contas autorizadas. A desconexão não apaga posts já publicados.

## Verificação de ativação real

Testar com duas marcas e titulares diferentes, no mínimo: consentimento OAuth, seleção da conta, imagem revisada, envio agora, agendamento com navegador fechado, cancelamento futuro, revogação/reconexão, falha parcial e link/status confirmado. TikTok precisa de escolha manual de privacidade, declaração de IA e opções comerciais/consentimentos correspondentes. Liberar público apenas após a auditoria.

Nesta entrega, não existe conta de rede conectada nem publicação externa real; faltam os apps, segredos e aprovações. Os testes automatizados validam a implementação e as falhas, com provas de banco e interface documentadas separadamente.

## Tela de Integrações

A interface de contas fica em `/integrations`; `/social` redireciona preservando parâmetros de OAuth e links antigos. Os quatro adaptadores estão agrupados em cartões com as contas da marca, validade, seleção pós-OAuth e controles de acesso. A aba Publicações reúne a fila e seus resultados.

X, Canva, Threads, Pinterest, YouTube e WordPress são opções de catálogo, explicitamente não implementadas e com ações bloqueadas. Esses cartões não criam credenciais, não chamam APIs e não ampliam os quatro adaptadores existentes.
