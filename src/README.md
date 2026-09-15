# Frontend

O frontend usa React, TypeScript e Vite. A organização é orientada a funcionalidades para manter os arquivos que mudam juntos no mesmo lugar.

| Pasta        | Responsabilidade                                 |
| ------------ | ------------------------------------------------ |
| `app`        | rotas, proteção de acesso e estado compartilhado |
| `components` | componentes visuais reutilizáveis                |
| `domain`     | tipos centrais do PostFlow                       |
| `features`   | telas, estilos, serviços específicos e testes    |
| `services`   | Supabase, persistência e sessão compartilhados   |
| `styles`     | tokens visuais e estilos globais                 |
| `test`       | configuração e utilitários de testes             |

Para seguir uma tela, comece por `app/App.tsx`, abra a pasta correspondente em `features` e depois o arquivo de teste ao lado do componente.
