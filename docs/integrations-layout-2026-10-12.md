# Integrações — layout da referência — 12/10/2026

A captura fornecida pelo usuário orientou o layout: menu esquerdo, cabeçalho branco, abas e cartões de plataformas centralizados em duas colunas sobre fundo cinza. A marca, textos e dados continuam sendo do PostFlow.

## Entrega

- Menu **Integrações** com ícone de plug e rota `/integrations`.
- Links antigos `/social` continuam funcionando por redirecionamento, preservando parâmetros de OAuth e fragmentos.
- Temas claro, escuro e sistema compartilhados com as demais telas; cabeçalho, sidebar e menu móvel seguem a preferência global.
- Cartão de cada plataforma reúne estado, ajuda, contas reais da marca, validade da autorização, atualização, edição de acesso/reconexão e desconexão.
- Seleção pós-OAuth fica dentro do cartão correspondente. Editar acesso reinicia o consentimento na rede, sem formulário de senhas/tokens.
- Aba **Publicações** reúne a fila e confirmação por destino, com cancelamento e links existentes.
- Navegação de abas por teclado, foco visível e menu móvel acessível.

## Catálogo e disponibilidade real

Facebook Pages, Instagram profissional, LinkedIn perfil e TikTok foto única usam os adaptadores já implementados. Ainda aguardam os cadastros/credenciais/aprovações descritos no [guia de ativação](social-publishing-setup.md).

O painel exibe somente Facebook, Instagram, LinkedIn e TikTok, redes presentes na criação da marca com adaptadores implementados. Os cartões de X, Canva, Threads, Pinterest, YouTube e WordPress foram removidos a pedido do usuário. X e Blog continuam como destinos editoriais da criação de conteúdo, sem conexão ou publicação direta pela API. A configuração administrativa pendente continua visível nos quatro cartões reais, sem simular conexões.

## Verificação

- Build/TypeScript e lint dos arquivos alterados aprovados.
- 8 testes de interface, marca e AppShell aprovados após a redução do catálogo.
- 16 cenários Playwright aprovados: quatro cartões e sua identidade, seleção de conta, publicação enfileirada, consentimento, carrossel incompatível, edição não salva, abas e redirecionamento de OAuth. Inclui os temas claro e escuro com HTTP fixtures, sem publicar nas redes reais.
- Oito larguras: 320, 390, 768, 1024, 1280, 1440, 1920 e 2560 pixels. Nenhuma rolagem horizontal da página ou dos cartões.
- Duas colunas acima de 600 pixels; uma coluna até 600. Sidebar vira menu móvel até 900 pixels. Conteúdo central possui largura máxima para preservar a proporção da referência em monitores grandes.
- Capturas e relatório reproduzíveis: `node scripts/social-publishing-ui-check.cjs`, com preview em `127.0.0.1:4173`; artefatos em `output/playwright/social-publishing`.

Esta entrega altera a interface; não cria apps externos, não adiciona migração e não publica conteúdo em redes sociais.
