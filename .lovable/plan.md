# Plano: Remover campo legado `insurance_json` da interface `PricingSnapshot`

## Contexto
A coluna `insurance_json` foi removida da tabela `pricing_snapshots` no banco de dados. O campo opcional correspondente ainda existe na interface TypeScript `PricingSnapshot`, em `src/types/index.ts`, e descreve uma coluna que não existe mais.

## Alteração
- Remover a propriedade opcional `insurance_json?: Record<string, unknown>;` (e o comentário legado acima dela) da interface `PricingSnapshot` em `src/types/index.ts`.

## Escopo
- Apenas o arquivo `src/types/index.ts`.
- Nenhum outro arquivo será alterado.
- Nenhuma lógica de negócio será modificada.
