# Temas da aplicação — 12/10/2026

SCRUM-67. O aplicativo possui três preferências: **Escuro**, **Claro** e **Sistema**. O seletor está no menu lateral (abra o menu no celular) e na tela de login/cadastro. A escolha é salva neste navegador e permanece ao trocar de tela ou recarregar. Sem preferência salva, o padrão continua escuro.

## Paleta e telas

A identidade verde usa menta sobre superfícies escuras e verde profundo sobre branco/cinza claro. Login, cadastro, marca, criação, agenda, integrações, cobrança, financeiro, fiscal, contábil e planos administrativos utilizam a mesma paleta. Cards, texto, controles, tabelas, mensagens de sucesso/erro/alerta e modais possuem tokens semânticos nos dois modos. Integrações deixou de forçar o tema claro.

Logos e cores definidas para a marca não são recoloridos. Imagens também mantêm suas cores; o selo branco sobre uma foto possui fundo escuro próprio para continuar legível sobre imagens claras. Documentos fiscais acadêmicos e impressão continuam em papel branco, com tinta escura, enquanto os controles ao redor acompanham o tema.

## Preferência e arquitetura

Ver [ADR-0013](adr/ADR-0013-global-application-themes.md). `src/app/theme.ts` compartilha o estado de interface entre os seletores, sem modificar a sessão ou o workspace. `postflow.theme` é uma preferência local; não sincroniza entre dispositivos e não usa uma tabela no banco.

O bootstrap aplica o tema antes de pintar a tela; o aplicativo atualiza o atributo de tema e a cor da barra do navegador. Sistema acompanha mudanças de aparência do dispositivo. O evento de storage sincroniza as abas da mesma origem. Se o navegador bloquear o armazenamento, trocar o tema ainda funciona durante a sessão aberta.

## Validação

| Verificação                 | Resultado                                                              |
| --------------------------- | ---------------------------------------------------------------------- |
| Suíte completa              | 49 arquivos / 271 testes aprovados                                     |
| Testes novos da preferência | 4 casos: escolha/persistência, sistema, abas/reset e storage bloqueado |
| Build / TypeScript          | Aprovados; aviso já existente de bundle maior que 500 kB               |
| Lint dos arquivos alterados | Aprovado                                                               |
| Playwright                  | 68 combinações de telas/tema/largura e 9 fluxos adicionais aprovados   |
| Banco                       | Contrato e inventário de 18 migrações aprovados; nenhuma migração nova |

Os cenários de navegador usam HTTP fixtures e não realizam chamadas pagas de IA, publicações sociais ou operações em contas reais. Eles cobrem 11 rotas em dark/light a 390/1440 pixels, com casos adicionais a 320/2560. As verificações incluem ausência de overflow horizontal, superfície dos painéis, texto e cor de tema, recarregamento/navegação, menu móvel, modais de edição/geração, modo Sistema, duas abas e armazenamento bloqueado.

Textos principais e secundários têm contraste de pelo menos 4,5 nos fundos verificados; os estados semânticos também possuem pares coerentes. Isso não constitui certificação integral de acessibilidade de todo conteúdo ou de qualquer imagem enviada pelo usuário.

Reprodução:

```text
npx vitest run --maxWorkers=2
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173
node scripts/theme-ui-check.cjs
```

O script grava relatório de contraste/superfícies e capturas em `output/playwright/themes`, ignorado pelo Git. O preview e o navegador de testes são isolados da sessão do usuário.

## Prompt Optimizer e Orchestrator

Contrato otimizado: entregar um tema global persistido, com seletor acessível, uma fonte de tokens, nenhuma alteração de Auth/dados, e cores coerentes de UI em todas as telas. Manter cores intrínsecas de imagens/logos/documentos; não inverter a página nem manter temas locais forçados. Considerar escolha explícita, modo Sistema, reload, mudança entre abas, armazenamento indisponível, celular e cards com avisos.

O Orchestrator atribuiu estilos de criação/login e módulos administrativos a duas folhas com propriedade distinta. A raiz implementou preferência, bootstrap, seletores, tokens, AppShell e integração, revisou as mudanças e corrigiu o contraste do selo de mídia. A conferência final utilizou os mesmos casos e capturas nos dois modos; falhas de asserção de RGB/hex e seleção de wrappers transparentes no primeiro script foram corrigidas sem alterar o produto para satisfazer testes.
