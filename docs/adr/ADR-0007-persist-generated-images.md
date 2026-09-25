# ADR-0007: Persistir imagens geradas no Storage privado

## Status

Accepted — 2026-09-25

## Contexto

A geração devolve uma imagem ao estúdio como data URL. O post era salvo na agenda sem essa imagem, então a prévia deixava de representar o conteúdo gerado após recarregar a página.

## Decisão

Ao criar um post com imagem, o backend valida e envia os bytes para o bucket privado `post-draft-images` no Supabase Storage. `post_drafts.image_path` guarda somente o caminho do objeto, nunca a data URL. A API devolve uma URL assinada com validade de uma hora para a prévia; leituras posteriores emitem uma URL nova. Upload e remoção usam o cliente administrativo exclusivamente no servidor.

A identidade UUID é criada ou validada antes do upload, e a mesma identidade é usada na linha do post e no caminho do objeto. Se a gravação transacional falhar após o upload, o backend tenta remover o objeto recém-criado. A exclusão do post também remove sua imagem. Posts sem `image_path` exibem uma prévia editorial e podem gerar uma arte sob demanda: esse fluxo consome uma unidade de imagem, preserva a legenda e grava a arte privada no Storage. A prévia renova URLs assinadas expiradas. Quando uma geração multirrede inclui imagens, cada post usa o endpoint individual para manter seu arquivo.

Ao alterar a data na agenda, o cliente envia apenas os dados já persistidos do post com a nova data. Legenda, horário e situação alterados localmente continuam pendentes até “Salvar alterações”.

## Consequências

- A imagem gerada continua disponível na agenda após recarregar.
- O bucket é privado e o navegador recebe somente URLs assinadas temporárias.
- Gerar imagem para um post existente consome somente a franquia de imagens e mantém legenda e hashtags.
- A data do post passa a ser persistida imediatamente; as demais edições seguem o salvamento explícito.
- Uma falha no Storage não grava a imagem no banco e não expõe o caminho interno ao cliente.

## Validação

- Testes de backend cobrem upload, caminho gravado e URL assinada.
- Testes de interface cobrem prévia, troca imediata de data e preservação de edições locais.
- A migração cria o bucket privado e a coluna opcional `image_path`.
