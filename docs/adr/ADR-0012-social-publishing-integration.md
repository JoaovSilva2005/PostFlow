# ADR-0012: Integração multitenant de publicação social

## Status

Proposed — 2026-10-12. Pesquisa concluída; fornecedor, apps e implementação ainda não aprovados/ativados.

## Contexto

O usuário quer que clientes do PostFlow conectem suas próprias redes desde a primeira versão e publiquem/agendem os conteúdos da agenda. Hoje os destinos são editoriais, o status pode ser alterado manualmente e não há envio social. O carrossel tem estrutura/capa e o Reels tem roteiro/capa, sem todos os arquivos necessários à publicação.

O BFF Express e seus repositórios/RPCs são a fronteira de autorização aceita nos ADRs 0001, 0005, 0007 e 0009. A geração compartilhada da agenda, ADR-0011 de posts completos, permanece separada da execução da publicação.

## Proposta

1. Introduzir módulo de publicação no BFF com porta `SocialPublisher` e adaptadores por API direta ou fornecedor gerenciado. Avaliar piloto Zernio antes de escolher; Ayrshare e APIs diretas são alternativas. Não adotar SDK de fornecedor diretamente no front-end.
2. Vincular conexões à marca autorizada. Manter tokens cifrados/segredos no servidor, OAuth state de uso único e PKCE quando suportado. A chave global do fornecedor e IDs externos não substituem autorização por membership.
3. Separar status editorial de status verificado por conta. Guardar snapshot aprovado, consentimento, arquivos, data UTC/fuso IANA, intenção de envio, tentativa e IDs externos. Persistir snapshot e intenção atomicamente.
4. Ter um executor por job: claim com lease no banco e worker chamado por Supabase Cron para APIs diretas; ou agendamento remoto do fornecedor, reconciliado pelo PostFlow. Nunca ambos despachando o mesmo post. Reutilizar os padrões de dados e o BFF; não criar serviço/ORM paralelo.
5. Normalizar upload/processamento/publicação/rascunho do criador. Sucesso de transporte não significa post público. Reconciliação de resultado desconhecido vem antes de repetir um envio que pode ter sido aceito. Idempotência externa depende da API; não prometer exatamente uma vez em qualquer rede.
6. Usar paths canônicos de mídia e URLs de transferência emitidas perto do envio. Validar arquivos e capacidades por rede. Liberar carrossel/vídeo apenas com mídia completa e consentimento exigido.
7. Preservar auditoria e isolamento, verificar webhooks conforme o fornecedor, deduplicar eventos, revalidar permissões/orçamento no despacho e tratar revogação, refresh, cancelamento e edição concorrente.

## Alternativas

- API unificada: menor custo de manutenção inicial, custo recorrente e dependência de fornecedor. Não elimina restrições das redes ou a autorização multitenant do PostFlow.
- Adaptadores diretos desde o início: mais controle, maior trabalho com acesso público, formatos, versões, tokens e observabilidade.
- Agendamento no navegador: rejeitado porque não funciona de forma durável com navegador fechado ou sessão expirada.
- Tratar o status manual `published` como confirmação externa: rejeitado por produzir sucesso sem evidência.

## Consequências e limites

O módulo deve suportar sucesso parcial por destino e reconexão. Posts com imagens são a primeira entrega; processamento de vídeo e slides completos exige outra capacidade de mídia. Perfis e Páginas LinkedIn têm caminhos de acesso distintos. O lançamento público depende das aprovações aplicáveis; contas internas não validam acesso para clientes.

O plano comercial precisa considerar conexões, consumo de IA, chamadas pagas do X, infraestrutura e termos das redes. Um piloto deve verificar OAuth, consentimento, privacidade, retenção e custo efetivo antes de contratar. Não há garantia de horário exato de conclusão em todas as redes.

## Validação e referência

Executar os casos de isolamento de marcas, callbacks inválidos, workers concorrentes, sucesso parcial, timeout após aceitação, tokens expirados, edição/cancelamento, mídia futura e webhooks descritos em [análise de 12/10/2026](../social-publishing-analysis-2026-10-12.md). Confirmar publicação real com contas autorizadas e conteúdo aprovado. Este ADR será Accepted somente quando a estratégia for escolhida e incorporada à implementação.
