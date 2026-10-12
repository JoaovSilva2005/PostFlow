# ADR-0011: Posts com arte compartilhada na agenda

## Status

Accepted — 2026-10-12

## Contexto

O usuário precisa criar posts com legenda e imagem pelo mesmo botão da agenda.
Ele confirmou que deseja reutilizar a mesma arte, com uma legenda por rede.
O planejador já retorna conteúdo estruturado e o BFF já gera imagens e persiste
arquivos no Storage privado (ADRs 0007, 0008 e 0010).

## Decisão

- Encadear o lote de textos, uma imagem por data e o salvamento dos posts com
  imagem. Reutilizar os endpoints, contratos e franquias existentes.
- Cada combinação data × rede mantém sua legenda e estrutura editorial; as redes
  da mesma data recebem a mesma arte quadrada. Não recortar a arte por rede.
- Só anunciar conclusão depois do salvamento. Falha ou cancelamento antes dessa
  etapa não salva rascunhos incompletos. Bloquear envio repetido durante geração.
- Repetir uma tentativa com o mesmo briefing aproveita textos e artes já gerados
  nessa sidebar; o cache vive apenas em memória e é descartado ao fechar ou mudar
  a configuração. Isso evita repetir chamadas bem-sucedidas após falha parcial.
- Carrossel contém estrutura de slides e uma capa; Reels contém roteiro e uma
  capa, sem vídeo renderizado. Explicitar esses limites na interface.
- Manter geração manual como recuperação para rascunhos antigos sem imagem.

## Consequências

Um clique entrega os posts para revisão e agendamento. O consumo é um texto por
rascunho e uma imagem por data. As gravações com imagens usam a compensação já
existente no repositório: falhas de rede na compensação podem exigir reconciliação,
e não há transação distribuída entre o cliente, o provedor e o Storage.
Fechar/recarregar a página descarta o cache de uma tentativa ainda não salva.
Publicação nas redes continua manual.

## Validação

Testar três redes, várias datas e os três formatos; assegurar imagem compartilhada,
legendas por rede, progresso, bloqueio de envio duplicado, cancelamento, falhas e
reaproveitamento de geração em nova tentativa. Conferir persistência e recarga.
