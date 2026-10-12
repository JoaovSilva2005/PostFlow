# Publicação e agendamento nas redes sociais — análise do PostFlow

Data da pesquisa: **12/10/2026**. Escopo confirmado: **cada cliente conecta suas próprias contas desde a primeira versão**. Esta é uma análise e proposta; publicação externa ainda não foi implementada. Preços em USD, sujeitos a alteração e cobrança por uso. Valores não incluem impostos ou conversão cambial.

## Recomendação

Avaliar primeiro um piloto com **API unificada**, tendo Zernio como candidato pelo custo inicial por conta conectada. Preservar uma porta de publicação no BFF para permitir adaptadores diretos futuramente. Aprovar o fornecedor somente depois de verificar conexão de clientes reais, formatos, consentimento, exclusão de dados, preços e status de publicação. Ayrshare é outra opção, com planos próprios para plataformas com vários clientes.

Integrar diretamente também é viável: exige apps de desenvolvedor, OAuth, permissões, revisões e manutenção separados. Começar por imagens estáticas; liberar carrosséis e vídeos quando houver arquivos completos. Meta e TikTok podem exigir aprovação para uso público; páginas do LinkedIn têm requisitos diferentes dos perfis pessoais. Um teste com a conta do desenvolvedor não comprova acesso para clientes.

## O que existe no projeto

Inspeção do commit `5f7bca31318a4f4b05ff14be1ea7ee75dd8171a8`, no checkout `PostFlow-agenda`:

- React/Vite no front-end; Express no BFF, publicado na Vercel; PostgreSQL e Storage privado no Supabase.
- Workspaces por marca e autorização por membership. Reutilizar os ADRs 0001, 0005, 0007 e 0009.
- `shared/domain/socialPlatforms.ts` enumera destinos editoriais. Isso não representa contas conectadas por OAuth.
- `DraftSchedulePanel.tsx` permite marcar `published` manualmente; `workspaceRoutes.ts` persiste o status informado. Não há prova de publicação externa nesse status.
- A agenda já salva legenda por rede e uma arte compartilhada por data. Carrossel tem estrutura de slides e uma capa; Reels tem roteiro e capa. Ainda faltam imagens de todos os slides e vídeo renderizado/uploadado.
- O agendamento atual guarda data e fuso. Não existe executor de publicação social no servidor. Fechar o navegador não pode interromper o futuro agendamento.

## Como funcionará para o cliente

1. Em **Redes conectadas**, o administrador da marca escolhe a rede e é redirecionado para o consentimento oficial. O PostFlow não pede a senha da rede.
2. O cliente autoriza o app e seleciona a conta/Página. O servidor vincula a conexão à marca autorizada e guarda credenciais protegidas; o front-end recebe identificadores e estado da conexão.
3. Na agenda, o cliente revisa a arte, a legenda de cada rede, o destino e as opções específicas. Escolhe **Publicar agora** ou **Agendar** e confirma a versão que será enviada.
4. O servidor ou o fornecedor de agendamento envia a versão aprovada. A agenda mostra resultado por destino: publicado, aguardando processamento, falha ou reconexão necessária.
5. O link do post aparece quando a rede confirmar sua publicação. Em caso de falha parcial, repetir somente o destino que falhou, sem republicar os demais.

“Sincronização” na primeira versão significa conexão, saúde da conta, envio, resultado e link. Importação de posts antigos, métricas, comentários, mensagens e anúncios são incrementos separados, com outras permissões e custos.

## APIs diretas por rede

| Rede | Contas e acesso | Publicação e formatos | Custo de API identificado |
| --- | --- | --- | --- |
| Facebook | Páginas autorizadas pelo cliente; não perfil pessoal. OAuth e Page Access Token, com permissões para listar/administrar posts. | Texto, links, imagens e vídeo conforme o endpoint. Alguns endpoints de Página permitem agendamento nativo; a proposta mantém uma estratégia uniforme de execução. | Não identifiquei tarifa pública por post orgânico. Isso não constitui garantia de gratuidade. |
| Instagram | Conta profissional Business ou Creator. Instagram Login pode funcionar sem Página vinculada; Facebook Login exige o vínculo correspondente. | Imagem, carrossel e Reels com arquivos efetivos; criar mídia/container, acompanhar processamento e publicar. | Não identifiquei tarifa pública por publicação; existem cotas. |
| LinkedIn — perfil | Produto Share on LinkedIn, autorização do membro e `w_member_social`. Acesso de escrita pessoal não depende automaticamente da aprovação para Community Management. | Compartilhamento no perfil. Conferir endpoint, versão e mídia suportados pelo produto habilitado. | Termos atuais informam ausência de tarifa de API, com possibilidade de mudança. |
| LinkedIn — Página | Produto Community Management, aprovação e permissões da organização, com papel adequado na Página. Development não equivale à liberação pública em Standard. | Posts da organização, incluindo mídia conforme Posts API. MultiImage/documento não são o produto de carrossel patrocinado. | Sem tarifa atual segundo os termos; acesso e limites continuam condicionados ao produto. |
| X/Twitter | App de desenvolvedor e OAuth do usuário. Permissões de escrita/mídia e renovação conforme a integração. | Post, imagens e vídeo. Limites de caracteres são ponderados; URL conta de modo próprio. | Pay-per-use: criação normal US$ 0,015/requisição; criação com URL US$ 0,200/requisição. Outras operações podem ser cobradas. |
| TikTok | OAuth, app autorizado e Direct Post com `video.publish`, inclusive para fotos. Publicação pública depende da auditoria aplicável. | Vídeo e fotos; sem post só de texto. Upload para a caixa de entrada exige conclusão pelo usuário e não significa post público. | Não identifiquei tabela pública de cobrança por post da Content Posting API. Auditoria e cotas continuam obrigatórias. |

Fontes: [Facebook API oficial no Postman](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api), [Instagram API oficial no Postman](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin), [Community Management](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview), [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [termos LinkedIn, seção 8.2](https://www.linkedin.com/legal/l/api-terms-of-use), [preços X](https://docs.x.com/x-api/getting-started/pricing), [Content Posting TikTok](https://developers.tiktok.com/products/content-posting-api).

### Requisitos que influenciam o lançamento

**Meta:** configurar o produto escolhido, redirect URIs, política de privacidade e exclusão de dados. Acesso para usuários externos exige as revisões/níveis de acesso das permissões solicitadas; verificar a necessidade de verificação da empresa no painel do produto. Não misturar os scopes de Instagram Login (`instagram_business_basic`, `instagram_business_content_publish`) com os de Facebook Login (`instagram_basic`, `instagram_content_publish` e permissões de Página). Consultar a cota da conta em tempo de execução, em vez de fixar um número de posts. [Login do Instagram](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/), [níveis de acesso](https://developers.facebook.com/docs/graph-api/overview/access-levels/), [cota de publicação](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/).

**LinkedIn:** separar o lançamento para perfis da integração com Páginas. Community Management tem avaliação de app e tier; não há garantia de aprovação nem prazo. Não assumir leitura de posts/estatísticas do membro porque a escrita foi autorizada. Usar a versão suportada da API, com revisão periódica dos sunsets, sem copiar headers antigos de exemplos. [Acesso aos produtos](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [revisão Community Management](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review).

**X:** pré-comprar créditos, estabelecer teto de consumo e distinguir post com URL de post sem URL. App-only bearer token não substitui autorização para escrever em nome do usuário. Validar caracteres pelo algoritmo ponderado da rede. As diretrizes tratam conteúdo/respostas com IA e aprovação; confirmar com o programa de desenvolvedores o enquadramento dos posts originais gerados pelo PostFlow antes do lançamento, sem assumir que regras de replies se aplicam de modo idêntico. [OAuth](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [caracteres](https://docs.x.com/fundamentals/counting-characters), [diretrizes](https://docs.x.com/developer-guidelines).

**TikTok:** mostrar preview e conta de destino; consultar `creator_info`, apresentar as opções de privacidade permitidas, obter escolha e consentimento explícitos. Guardar a aprovação do conteúdo agendado. App sem auditoria tem restrições, inclusive visibilidade privada; esse modo não é lançamento público. Fotos usam `PULL_FROM_URL`, com domínio/prefixo de URL verificado; não presumir que o domínio do Storage gerenciado pode ser verificado pelo PostFlow. Vídeos podem ser transferidos por upload quando permitido. Aplicar os campos de identificação de conteúdo com IA exigidos. [Diretrizes de compartilhamento](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [fotos](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post), [transferência de mídia](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide).

## Integrar diretamente ou contratar uma API unificada?

| Opção | Vantagem | Trabalho/custo que permanece |
| --- | --- | --- |
| APIs diretas | Controle dos apps, credenciais e chamadas; sem mensalidade de agregador. | Aprovações, uploads, refresh, mudanças de versão, limites e suporte por rede. X continua pago. |
| API unificada | Um contrato de publicação, conexões e acompanhamento; pode executar os agendamentos e gerir OAuth. | Mensalidade/consumo, dependência externa, isolamento de clientes, revisão/consentimento, diferenças de formatos e reconciliação. Não libera recursos proibidos pelas redes. |

### Zernio, anteriormente Late

O preço atual é por **conta social conectada**, não por usuário do PostFlow: duas contas gratuitas no total da equipe; contas 3–10 custam US$ 6 cada/mês; contas 11–100, US$ 3 cada/mês. São faixas graduadas. Um agrupamento de marca/profile não equivale a uma conta conectada. X tem cobrança adicional repassada. [Preços e exemplos oficiais](https://docs.zernio.com/pricing).

| Cenário | Contas | Mensalidade de conexões |
| --- | ---: | ---: |
| Piloto com duas contas | 2 | US$ 0 |
| Uma marca com cinco contas | 5 | US$ 18 |
| Dez contas conectadas | 10 | US$ 48 |
| Dez clientes, três contas cada | 30 | US$ 108 |
| Dez clientes, cinco contas cada | 50 | US$ 168 |

Valores pressupõem conexão durante o mês inteiro. Não incluem X, extras, IA ou hospedagem. Validar faturamento vigente antes de contratar. A conta gratuita não elimina a necessidade de habilitar cobrança para as operações pagas do X.

No SaaS, criar agrupamento/profile por marca e mapear cada `accountId` no BFF. Uma chave global pode acessar contas de diversos clientes; nunca expô-la no front-end nem confiar no `accountId` enviado pelo navegador. [Guia multitenant](https://docs.zernio.com/multi-tenant).

Verificar duas particularidades no piloto: a documentação da rota atual do TikTok diferencia conexões pelo app Business das conexões legadas, com opções de privacidade distintas; envio para Creator Inbox pode voltar como `published` no fornecedor embora ainda seja apenas um rascunho. Mapear esse segundo caso como **aguardando conclusão no TikTok**, sem anunciar publicação pública. [TikTok no fornecedor](https://docs.zernio.com/platforms/tiktok).

Uploads do fornecedor disponibilizam URL de mídia para distribuição. Conferir retenção, tratamento de dados, exclusão e condições antes de transferir mídia privada. Webhooks devem ter segredo configurado e verificação HMAC sobre o corpo original, além de deduplicação por evento. [Uploads](https://docs.zernio.com/guides/media-uploads), [webhooks](https://docs.zernio.com/webhooks).

### Ayrshare

O plano **Launch** anuncia US$ 299/mês para até dez social profiles; **Business**, US$ 599/mês com trinta profiles incluídos. Aqui profile agrupa as contas de uma marca/cliente: não comparar diretamente com a unidade de cobrança do Zernio. O Premium para uma marca não atende o requisito de vários clientes. Confirmar limites, excedentes e condições comerciais no plano contratado. [Preços oficiais](https://www.ayrshare.com/pricing/), [documentação](https://app.ayrshare.com/docs/introduction).

### Custos diretos e infraestrutura

- No X, **1.000 criações sem URL = US$ 15**; **1.000 criações com URL = US$ 200**. São exemplos apenas da criação, não do fluxo completo. Leituras, operações de mídia e repasses de fornecedor podem acrescentar custo. [Tabela X](https://docs.x.com/x-api/getting-started/pricing).
- Vercel Pro começa em **US$ 20/mês** e Supabase Pro em **US$ 25/mês**, com franquias e possíveis excedentes. Um cenário com ambos começa em **US$ 45/mês**, antes de redes, imagens/textos de IA e demais usos. Não é uma cotação da conta atual nem custo incremental se já houver esses planos. [Vercel](https://vercel.com/pricing), [Supabase](https://supabase.com/pricing).
- Vercel Hobby é destinado a uso pessoal não comercial. Para operar o SaaS comercial, adequar o plano de hospedagem. O Cron do Hobby permite execução diária, inadequada para posts em qualquer minuto; não confundir quantidade de jobs com frequência. [Hobby](https://vercel.com/docs/plans/hobby), [limites de Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- IA e rede social são despesas diferentes. Gerar o conteúdo cobra o provedor de IA; publicar chama a rede/fornecedor. Uma repetição de publicação não deve gerar outra imagem.

O PostFlow normalmente contrata a API/infraestrutura e recebe autorização do cliente para sua conta. O cliente não precisa entregar senha ou abrir um app de desenvolvedor próprio nesse modelo. Planos comerciais do PostFlow devem limitar conexões e consumo, respeitando os termos das redes; em especial, revisar as restrições comerciais dos termos do LinkedIn antes de cobrar adicional especificamente por acesso à sua API.

## Arquitetura proposta

Decisão registrada como **Proposed** em [ADR-0012](adr/ADR-0012-social-publishing-integration.md). Sem troca de framework ou ORM.

### Limite do módulo

Criar `backend/modules/social-publishing` com casos de uso de conexão, pré-validação, aprovação, agendamento, cancelamento e reconciliação. Contratos/DTOs em `shared/`, interface no front-end e acesso a dados pelo padrão de repositório/RPC já utilizado. `SocialPublisher` recebe snapshot aprovado e retorna resultado normalizado; adaptadores diretos ou gerenciados implementam a mesma porta.

O estado editorial permanece separado do estado comprovado de publicação por conta. A opção manual “Publicado” não poderá produzir badge/link de publicação automática. O retorno deve distinguir processamento de mídia, publicação pública e envio de rascunho para conclusão pelo criador.

### Dados novos sugeridos

| Entidade | Responsabilidade |
| --- | --- |
| `social_connections` | `brand_id`, rede, conta externa, nome, permissões, capacidades, saúde, expiração e ID do fornecedor. |
| Credenciais privadas | Tokens cifrados e referência da chave; leitura exclusiva no servidor. Na opção gerenciada, guardar chave global em segredo e IDs externos vinculados à marca. |
| `oauth_sessions` | `state` único, usuário/marca, validade, redirect e PKCE quando suportado. Consumir uma vez no callback. |
| `media_assets` | Caminho canônico, MIME, tamanho, dimensões/duração, checksum e ordem dos slides. URLs de preview não são a referência persistente. |
| `publication_jobs` | Snapshot/versionamento, conta alvo, data UTC, fuso IANA, modo, status, executor, tentativas, lease e IDs externos. |
| `publication_attempts` / eventos | Histórico de envio/reconciliação, erros sanitizados, consentimento, ator e eventos deduplicados. |

Todos os relacionamentos devem preservar a marca; RLS, chaves/constraints e autorização no BFF impedem associação cruzada. Owner/admin administram conexões. Publicação por editor precisa de capacidade definida e validada no servidor; viewer só lê. O papel global de administrador não substitui a autorização do workspace.

### Execução durável

Na integração direta, salvar snapshot aprovado e job na mesma transação. Um executor consulta jobs vencidos, reserva atomicamente com lease, publica em lotes pequenos e persiste o progresso. Supabase Cron pode chamar um endpoint autenticado do BFF; o executor permanece no módulo existente. Não depender de aba aberta, `setTimeout`, fila em memória ou função longa esperando conversão de vídeo. [Supabase Cron](https://supabase.com/docs/guides/cron), [configuração](https://supabase.com/docs/guides/cron/quickstart).

Começar com tabela de jobs e claim transacional. PGMQ/Supabase Queues é alternativa durável se volume/necessidades justificarem; verificar versão da extensão antes de adotar e evitar duas fontes de verdade para o mesmo job. [Queues](https://supabase.com/docs/guides/queues).

Na opção gerenciada, o fornecedor pode ser o executor do horário. O banco do PostFlow mantém a intenção e o estado confirmado; não executar um segundo envio local do mesmo job. Edição/cancelamento exige reconciliação do agendamento remoto. Persistir a solicitação antes da chamada externa e recuperar falhas por reconciliação/outbox.

Estados sugeridos: `queued`, `preparing`, `uploading`, `processing`, `publishing`, `published`, `retry_wait`, `failed`, `needs_reconnect`, `cancelled`, `unknown` e `awaiting_creator`.

- Só confirmar publicação mediante resposta verificável da rede/fornecedor no modo correspondente. Nem toda rede disponibiliza imediatamente a URL final; guardar ID e continuar a reconciliação.
- Usar idempotência quando suportada. Se um POST pode ter sido aceito antes do timeout, marcar `unknown` e reconciliar; não repetir cegamente. Fila com entrega pelo menos uma vez não garante publicação exatamente uma vez.
- Lock/lease evita dois workers enviando o mesmo job; erro temporário permite backoff. Falha de autenticação pede reconexão. Falha definitiva de formato não consome tentativas infinitas.
- Revalidar conta, membership, consentimento, versão e orçamento no despacho. Tratar refresh concorrente, revogação, cancelamento e edição durante processamento.
- Webhooks autenticados/deduplicados e consultas periódicas atualizam o resultado por destino. Nenhum cliente pode informar arbitrariamente “publicado”.

A cadência desejada pode ser de um minuto, mas processamento, limites e moderação da rede afetam a conclusão. Não prometer publicação ao segundo.

### Mídia e formatos

A mesma arte pode ser reutilizada quando compatível com cada destino; a legenda continua específica por rede. Gerar conversões de entrega quando necessário, por exemplo JPEG onde a API de imagens exigir, mantendo a arte original. Validar tamanho, dimensão, codec, duração e quantidade conforme a API escolhida.

Carrossel precisa dos arquivos de todos os slides ordenados; cada rede pode representar esse conteúdo de maneira diferente. Reels/TikTok em vídeo precisam de MP4 ou outro formato aceito, não apenas do roteiro/capa. Oferecer upload de vídeo inicialmente é mais simples que construir renderização automática. Não converter silenciosamente um Reels em imagem estática.

Guardar paths privados permanentes e emitir URL assinada somente perto da transferência, com tempo suficiente para a ingestão. O preview atual expira; não armazená-lo como URL de publicação futura. Para fotos TikTok por URL, usar domínio/prefixo verificável ou fluxo suportado do fornecedor. Downloads no servidor devem usar apenas referências próprias validadas, com limites, evitando SSRF e exposição de arquivos de outra marca.

## Plano de execução

1. **Piloto de fornecedor/acesso:** verificar duas marcas isoladas, tipos de conta, custos, OAuth, consentimento, envio de imagem, status e desconexão. Se direto, configurar apps e solicitar acessos em paralelo; separar perfil/Página LinkedIn. Não prometer prazo de aprovação.
2. **Fundação multitenant:** conexões, segredos, callbacks, mídia, snapshot aprovado, estados por destino, executor único e auditoria. Implementar limites de plano/consumo.
3. **Publicação de imagem:** Instagram profissional, Facebook Página e LinkedIn perfil conforme acesso confirmado; X com cobrança habilitada e orçamento. Testar agora, agendado e falha parcial.
4. **Carrossel e vídeo:** produzir/uploadar arquivos reais, validar plataformas, adaptar mídia e acompanhar processamento. Liberar TikTok público somente com integração auditada, controles e consentimento corretos.
5. **Operação:** reconexão, observabilidade, alertas de falha, custos, cancelamentos, política de retenção e testes recorrentes de compatibilidade. Métricas/importação histórica ficam para fase própria.

## Critérios de aceite e testes relevantes

| Caso | Resultado esperado |
| --- | --- |
| Duas marcas com usuários e contas diferentes | Cliente A não lê, conecta, publica ou cancela usando IDs da marca B; chave do fornecedor nunca vai ao navegador. |
| OAuth adulterado/reutilizado/expirado | Callback rejeitado; nenhuma conexão criada para a marca errada. |
| Três destinos, um falha | Dois posts preservados; repetição apenas no destino com falha comprovada. |
| Timeout após aceitação | Estado desconhecido reconciliado; nenhum segundo post automático sem verificar o primeiro. |
| Token expirado/revogado | Refresh único quando permitido; reconexão exibida, sem falso sucesso. |
| Dois workers e reinício no meio do envio | Claim/lease e recuperação não causam envio simultâneo ou perda silenciosa. |
| Agendamento com navegador fechado | Execução pelo servidor/fornecedor, fuso correto; editar/cancelar usa versão consistente. |
| URL de preview já expirada | Transferência usa referência canônica e URL nova; mídia completa e formatos válidos. |
| Webhook falso/repetido/fora de ordem | Assinatura e evento verificados; estado não regride nem cruza marcas. |
| TikTok Creator Inbox | Agenda diz “aguardando conclusão”; não “publicado na rede”. |
| X com caracteres Unicode, URL e saldo insuficiente | Validação ponderada, custo classificado corretamente e envio bloqueado quando necessário. |
| Carrossel sem slides/vídeo sem arquivo/privacidade não escolhida | Aprovação/envio bloqueados com instrução clara. |

Testes unitários/integração com fixtures verificam contratos e falhas; Playwright verifica conexão, agenda, estados e isolamento na interface. A aceitação final exige teste controlado nas redes reais, com autorização explícita dos donos das contas e conteúdo aprovado. Esta análise não executou publicações externas nem criou contas pagas.

## Prompt Optimizer e Orchestrator aplicados

A pesquisa foi dividida entre dois especialistas: Meta/LinkedIn e X/TikTok. O agente principal verificou o código, fontes de preços, fornecedores e arquitetura, e corrigiu a distinção entre publicação em perfil LinkedIn e acesso a Páginas. A análise do Supabase orienta a execução durável no servidor.

Contrato otimizado para a pesquisa: **usar documentação oficial atual; distinguir conta pessoal/profissional/Página, desenvolvimento/lançamento com clientes, publicação/rascunho e custo direto/fornecedor; informar fatos incertos; citar cada preço; não pressupor permissões por analogia entre redes**.

Prompt de implementação proposto:

> Implementar publicação social multitenant no PostFlow usando o ADR-0012 aprovado e o fornecedor validado no piloto. Preservar BFF Express, repositórios/RPCs, contratos puros em shared, membership por brand_id e Storage privado. Cada cliente autoriza sua conta por OAuth; segredos permanecem no servidor. Reutilizar a arte e manter legenda por rede; não anunciar carrossel/vídeo pronto sem os arquivos. Salvar snapshot aprovado e intenção de envio atomicamente, com um executor por job. Confirmar status por resposta autenticada e modo de publicação, reconciliar timeout desconhecido e não duplicar destinos bem-sucedidos. Implementar consentimento e capacidades por rede, cancelamento/versionamento, reconexão, limites e auditoria sem tokens. Validar os casos da tabela de aceite e realizar publicação real apenas de conteúdo aprovado em contas autorizadas. Documentar alterações e limitações no Jira/Confluence; não confundir mock com validação pública da API.

O prompt estrutura o trabalho; não substitui revisão de apps, credenciais, implementação ou testes. A decisão arquitetural e a contratação permanecem propostas.

## Governança

Implementação acompanhada em [SCRUM-58](https://joaovsilva3530.atlassian.net/browse/SCRUM-58), com a pesquisa disponível também no [Confluence](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/27000834). O card continua pendente até a execução e validação da integração. A análise não altera o aplicativo em produção.
