# Integrações — layout da referência — 12/10/2026

A captura fornecida pelo usuário orientou o layout: menu esquerdo, cabeçalho branco, abas e cartões de plataformas centralizados em duas colunas sobre fundo cinza. A marca, textos e dados continuam sendo do PostFlow.

## Entrega

- Menu **Integrações** com ícone de plug e rota `/integrations`.
- Links antigos `/social` continuam funcionando por redirecionamento, preservando parâmetros de OAuth e fragmentos.
- Tema claro limitado a essa página; cabeçalho, sidebar e menu móvel seguem a mesma aparência.
- Cartão de cada plataforma reúne estado, ajuda, contas reais da marca, validade da autorização, atualização, edição de acesso/reconexão e desconexão.
- Seleção pós-OAuth fica dentro do cartão correspondente. Editar acesso reinicia o consentimento na rede, sem formulário de senhas/tokens.
- Aba **Publicações** reúne a fila e confirmação por destino, com cancelamento e links existentes.
- Navegação de abas por teclado, foco visível e menu móvel acessível.

## Catálogo e disponibilidade real

Facebook Pages, Instagram profissional, LinkedIn perfil e TikTok foto única usam os adaptadores já implementados. Ainda aguardam os cadastros/credenciais/aprovações descritos no [guia de ativação](social-publishing-setup.md).

X, Canva, Threads, Pinterest, YouTube e WordPress são cartões de catálogo com **Não implementada**, explicação e controles bloqueados. Não existe conexão falsa ou backend novo para esses destinos. Documentação oficial consultada para as opções: [Canva](https://www.canva.dev/docs/apps/rest-apis/), [Pinterest](https://developers.pinterest.com/docs/api/v5/introduction/), [YouTube](https://developers.google.com/youtube/v3), [WordPress](https://developer.wordpress.org/rest-api/), [X](https://docs.x.com/x-api/introduction) e [Threads](https://developers.facebook.com/docs/threads/).

## Verificação

- Build/TypeScript e lint dos arquivos alterados aprovados.
- 16 testes existentes de interface, AppShell e rotas aprovados.
- 14 cenários de Playwright aprovados com HTTP fixtures: catálogo, seleção de conta, publicação enfileirada, consentimento, carrossel incompatível, edição não salva, abas e redirecionamento de OAuth.
- Oito larguras: 320, 390, 768, 1024, 1280, 1440, 1920 e 2560 pixels. Nenhuma rolagem horizontal da página ou dos cartões.
- Duas colunas acima de 600 pixels; uma coluna até 600. Sidebar vira menu móvel até 900 pixels. Conteúdo central possui largura máxima para preservar a proporção da referência em monitores grandes.
- Capturas e relatório reproduzíveis: `node scripts/social-publishing-ui-check.cjs`, com preview em `127.0.0.1:4173`; artefatos em `output/playwright/social-publishing`.

Esta entrega altera a interface; não cria apps externos, não adiciona migração e não publica conteúdo em redes sociais.
