# Agenda: geração completa em um clique

Implementação [ad5b124](https://github.com/JoaovSilva2005/PostFlow/commit/ad5b1240e09bf6c952ca1b174f7d6b763ca5cfa2), publicada em 12/10/2026 no
[deployment de produção](https://vercel.com/dranoxs-projects/post-flow/14FG8zj4DfZwAF146dQsD81u8hiK),
com estado Ready / Current. A publicação foi iniciada no painel após conferir o
SHA, pois o push não disparou deploy automático.

## Comportamento

Em [Agenda](https://post-flow-ochre.vercel.app/calendar), o botão **Gerar rascunhos
e imagens** gera uma legenda por rede e uma arte por data, compartilhada entre as
redes selecionadas. Só confirma sucesso depois de salvar no banco e Storage.
Inclui progresso, cancelamento antes de salvar, bloqueio de duplo envio e
reaproveitamento de textos/artes concluídos em nova tentativa na mesma sidebar.

Estático gera peça única; carrossel gera estrutura dos slides e capa; Reels gera
roteiro e capa, sem vídeo. Os posts permanecem em rascunho para revisão e
agendamento. Publicação nas redes segue manual.

## Validação

- 232 testes em 44 arquivos passaram, além dos checks de esquema e inventário
  de 17 migrations. TypeScript/build passaram; lint sem novos erros.
- Playwright: seis cenários, 390/1440px × estático/carrossel/Reels, passaram
  localmente e na versão publicada, com HTTP controlado. Verificados três posts,
  uma imagem, legendas por rede, persistência, recarga e imagem carregada.
- Integração PostgreSQL/Storage reais com IA/auth/franquia de teste: três posts,
  imagens com mesmos bytes, download e renovação de links assinados aprovados;
  dados temporários removidos.
- Produção real pela UI autenticada: um clique gerou três legendas e uma imagem,
  salvando os posts Instagram/Facebook/X de **12/10/2026 às 16:30**. Conferência
  por API de banco e Storage confirmou três legendas distintas e arte com o
  mesmo SHA-256 nos três objetos. Recarga confirmou os posts e as três imagens
  1024×1024 carregadas. Exemplos mantidos em rascunho para revisão do usuário.

A credencial local OpenAI retornou 401 na tentativa de IA real local. Essa
limitação não ocorre na credencial de produção, onde a geração real passou.

Evidências locais ignoradas pelo Git: `output/playwright/calendar-generation/`
(capturas e relatório) e `output/calendar-generation/production-integration.json`.

## Rastreabilidade

- [SCRUM-66](https://joaovsilva3530.atlassian.net/browse/SCRUM-66).
- [Confluence: Agenda — posts com arte compartilhada](https://joaovsilva3530.atlassian.net/wiki/spaces/DDS/pages/27066369).
- [ADR-0011](adr/ADR-0011-complete-calendar-posts.md).

Persistência usa gravações individuais com compensação; falha de compensação
pode exigir reconciliação. Cache de retry vive em memória e se perde ao fechar
ou recarregar. Contagem de X segue o limite de caracteres da aplicação, sem
integração de publicação e contagem ponderada da plataforma.
