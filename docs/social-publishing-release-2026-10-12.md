# Integração social direta — 12/10/2026

## Resultado e ativação

Implementados cadastro de conexões por marca, OAuth com seleção de conta, publicação de imagem revisada, agendamento em fila persistente, cancelamento antes do envio, reconexão e acompanhamento por destino. A interface fica em `/social` e no painel **Publicar nas redes** de cada post da agenda.

O usuário corrigiu a informação inicial: **não possui apps de desenvolvedor**. Portanto não existe OAuth externo/publicação real comprovada nesta entrega. Os quatro adaptadores ficam bloqueados até os cadastros, segredos e executor; TikTok também exige domínio verificado e auditoria. A migração foi aplicada no Supabase PostFlow; o cron de publicação não foi ativado. SCRUM-58 permanece em andamento para ativação e teste real.

## Escopo e decisão

- Facebook Pages, Instagram profissional com Instagram Login (sem exigir Página Facebook nesse fluxo), LinkedIn perfil pessoal e TikTok foto única por Direct Post.
- APIs diretas, sem agregador pago e sem X. Custos de hospedagem, armazenamento e IA continuam separados.
- Cada rascunho envia a legenda específica de sua rede, com a imagem compartilhada preparada na geração. Várias contas da mesma rede podem receber solicitações independentes.
- Carrossel/Reels não enviam apenas a capa. Faltam arquivos de slides/vídeo para suportar esses formatos externamente.
- Situação manual da agenda e resultado externo são separados. HTTP 202/`queued` não significa publicado.

Legenda e hashtags são validadas juntas antes de armazenar intenção/mídia: Instagram 2.200, LinkedIn 3.000 e TikTok fotos 4.000 caracteres; título TikTok 90. Facebook fica limitado conservadoramente a 5.000 pelo PostFlow, sem afirmar que esse é o limite nativo da rede. Fontes: [LinkedIn UGC](https://learn.microsoft.com/en-us/linkedin/compliance/integrations/shares/ugc-post-api), [TikTok fotos](https://developers.tiktok.com/docs/en/content-posting-api-reference-photo-post) e [Meta Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

## Evidências

| Verificação                                       | Resultado                                                             | Natureza                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Vitest completo (`npx vitest run --maxWorkers=2`) | 48 arquivos, 267 testes aprovados                                     | Serviço/rotas/adaptadores/UI; provedores externos usam fixtures                                                       |
| Playwright standalone                             | 8 cenários aprovados, desktop 1440 e mobile 390; zero erros de página | Navegador real, respostas HTTP simuladas; zero posts nas redes                                                        |
| Build e TypeScript                                | Aprovados                                                             | `npm run build`; aviso de bundle acima de 500 kB                                                                      |
| Contrato SQL e inventário                         | Aprovados; 18 migrações                                               | Scripts locais do banco                                                                                               |
| Segurança transacional Postgres                   | Aprovada, rollback completo                                           | Banco Supabase real; índice de intenção, FK multitenant, lease, dispatch desconhecido, disconnect, auditoria e grants |
| Storage e filtro REST                             | Aprovados, arquivo temporário removido                                | Bucket privado, leitura administrativa, leitura anônima negada, cancelamento inexistente sem alterar outros jobs      |

Reprodução:

```text
npx vitest run --maxWorkers=2
node scripts/database/testSchema.mjs
node scripts/database/testMigrationInventory.mjs
npm run build
node --import tsx scripts/database/verifySocialPublishing.mjs
node scripts/social-publishing-ui-check.cjs
```

O último comando exige preview em `http://127.0.0.1:4173` (ou `QA_BASE_URL`). Gera capturas/relatório em `output/playwright/social-publishing`, diretório ignorado pelo Git. A verificação SQL reproduzível está em `database/verification/social-publication-safety.sql` e recusa execução com fila social ativa; fixtures fazem rollback e não chamam redes. O script Storage usa somente IDs aleatórios novos e apaga sua própria imagem em `finally`.

## Revisão e correções

- Tokens AES-256-GCM vinculados a marca/rede/conta; state de uso único e credenciais ausentes em DTOs.
- Prévia aprovada deve corresponder ao rascunho persistido. Imagem JPEG privada e legenda ficam imutáveis por intenção; edição futura não muda envio já aprovado.
- Marcador de dispatch é salvo antes da chamada pública. Timeout após possível aceitação vai para `unknown`, com consulta de status, sem reenvio cego.
- Falha de reconciliação não limpa o marcador. Lease expirado após dispatch mantém resultado desconhecido.
- Instagram renova o token de longa duração antes de expirar, sem depender de um `refresh_token` inexistente nesse fluxo.
- TikTok consulta capacidades em preparação, antes do dispatch, para permitir retry de uma consulta que falhou sem envio.
- Permissões da marca e situação do plano são revalidadas no worker. A execução tem timeout por chamada e não inicia jobs perto do limite serverless.
- Desconectar remove credenciais locais e cancela apenas intenções ainda não enviadas; não desfaz posts já aceitos.

## Prompt Optimizer e Orchestrator

Contrato de implementação refinado pelo Prompt Optimizer: entregar integração multitenant no BFF existente, com portas/adaptadores, mídia e intenção persistidas, validação de consentimento e status verdadeiro. Não inventar aprovação, conexão, mídia de vídeo, post publicado ou credenciais. Sucesso exige testes negativos de tenant/state, concorrência, conteúdo alterado, timeout após envio, formatos incompatíveis e interface responsiva. Relatar separadamente fixtures, banco real e ativação externa.

O Orchestrator dividiu adaptadores e interface entre dois agentes; o agente principal integrou serviço, rotas, criptografia, repositório, migração, operação e documentação. A revisão final foi somente leitura e seus problemas concretos foram corrigidos antes da publicação.

## Próximos passos necessários

Seguir [cadastros, callbacks, credenciais e cron](social-publishing-setup.md), habilitar apenas os acessos efetivamente concedidos e validar OAuth/publicação com duas marcas/clientes autorizados. Não concluir SCRUM-58 por testes de fixtures. LinkedIn não tenta leituras restritas para resolver um ID perdido; resultados ambíguos exigem consulta manual da conta. Webhooks, métricas e importação de posts históricos ficam para outra entrega.

A auditoria do projeto também encontrou avisos preexistentes: proteção de senha vazada desabilitada no Supabase ([orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)) e dependência transitiva `shell-quote` de `concurrently` apontada pelo npm audit. Eles não foram introduzidos pelo módulo e não constituem prova de acesso externo aprovado.
