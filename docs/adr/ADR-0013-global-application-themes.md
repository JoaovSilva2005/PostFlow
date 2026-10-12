# ADR-0013 — Tema global da aplicação

## Status

Accepted — 12/10/2026, solicitado pelo usuário em SCRUM-67.

## Decisão

A aparência usa os tokens semânticos de `src/styles/tokens.css`, com valores escuros padrão e uma alternativa clara em `:root[data-theme='light']`. Componentes utilizam os mesmos tokens de texto, superfícies, bordas, ações e estados. Integrações conserva seu layout, mas deixa de impor uma paleta própria.

`src/app/theme.ts` controla a preferência Escuro/Claro/Sistema em um pequeno store de interface compartilhado por `useSyncExternalStore`. O tema é independente de dados de conta ou marca e não justifica persistência no banco, mudança em Auth ou novo serviço. O seletor usa esse único estado no login e no menu da aplicação. A escolha fica em `postflow.theme`, local a este navegador/dispositivo; não altera as cores configuradas para a marca.

O bootstrap em `index.html` aplica a preferência antes do primeiro paint; a inicialização do aplicativo mantém o mesmo contrato e atualiza o `theme-color`. Sistema acompanha `prefers-color-scheme`; mudanças de armazenamento sincronizam abas. Se storage for bloqueado, a troca continua válida na sessão. Sem preferência salva, o padrão permanece escuro.

## Consequências

Novos cards e telas devem utilizar os tokens globais. Cores de sucesso, alerta, erro e informação possuem texto, fundo e borda distintos nos dois modos. Valores literais só são adequados para cores intrínsecas de logos, arte, sombras específicas e documentos de impressão. O overlay de selo sobre fotografia é escuro nos dois temas, pois precisa garantir contraste independentemente da imagem.

Prévias de comprovantes acadêmicos/NFS-e simulada e impressão permanecem em papel branco com tinta escura; controles ao redor seguem o tema. Nenhum filtro de inversão altera imagens ou o produto inteiro. O layout de borda a borda de Integrações passa a ser uma opção de composição do AppShell, separada da aparência.

## Verificação

Testar escolha/persistência, sincronização entre abas, acompanhamento do sistema, storage bloqueado, login/cadastro e todas as telas nos dois modos. O contraste medido dos tokens não substitui uma revisão de imagens ou de cada composição. Resultados e reprodução estão em [temas da aplicação](../application-themes-2026-10-12.md).
