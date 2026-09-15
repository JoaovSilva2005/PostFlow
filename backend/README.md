# Backend

O backend é uma API Express escrita em TypeScript. A entrada local está em `index.ts`; a Vercel reutiliza a mesma aplicação por meio de `api/index.ts`.

## Organização

| Pasta ou arquivo | Responsabilidade                               |
| ---------------- | ---------------------------------------------- |
| `app.ts`         | monta middlewares, rotas e tratamento de erros |
| `index.ts`       | inicia o servidor no desenvolvimento local     |
| `config`         | lê o ambiente e cria o cliente Supabase        |
| `modules`        | agrupa cada domínio da API                     |
| `shared`         | recursos comuns aos módulos                    |
| `test`           | implementações auxiliares usadas nos testes    |

## Módulo financeiro

Dentro de `modules/finance`:

- `financialRoutes.ts` recebe e valida HTTP;
- `financialService.ts` concentra cálculos e regras;
- `financialRepository.ts` define o contrato e acessa o Supabase;
- `resilientFinancialRepository.ts` mantém o modo de demonstração;
- `memoryFinancialRepository.ts` fornece dados temporários;
- `financialTypes.ts` documenta entradas e saídas;
- arquivos `*.test.ts` comprovam o comportamento.
