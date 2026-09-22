# Shared

Esta pasta contém apenas contratos e regras puras que podem ser usados pelo
frontend e pelo backend.

Regras para novos arquivos:

- não importar React, Express, Vite, Supabase, Node ou APIs de navegador;
- não acessar banco, rede, cookies ou variáveis de ambiente;
- manter tipos e funções determinísticas, fáceis de testar em isolamento;
- colocar infraestrutura, telas e adaptadores em `src/` ou `backend/`.

O `src/domain` continua oferecendo fachadas de compatibilidade para o
frontend, mas a implementação compartilhada fica aqui. Isso evita que o
backend dependa da árvore de apresentação.
