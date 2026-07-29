## Estado atual (verificado)

- `pricing_parameters` tem 3 linhas: `soybean_cbot` (0.10), `corn_b3` (0.05), `corn_cbot` (0.05); a coluna `rounding_increment` existe e é nullable.
- `ParametersTab` em `src/pages/Settings.tsx` já itera sobre as 3 linhas no card de sigma, mas `getLabel` só reconhece dois ids — `corn_cbot` hoje aparece rotulado errado como "Milho B3".
- `useUpdatePricingParameter` (`src/hooks/usePricingParameters.ts`) só faz UPDATE e ainda não conhece `rounding_increment`.
- `GeneratePricingModal` não envia `rounding_increment` no payload de `/pricing/table` — permanece assim.
- `PricingParameter` em `src/types/index.ts` não tem o campo.

## O que muda

**1. `src/types/index.ts`**
- Adicionar `rounding_increment: number | null` em `PricingParameter`.

**2. `src/hooks/usePricingParameters.ts`**
- `useUpdatePricingParameter` aceita `rounding_increment?: number | null` e inclui no UPDATE quando a chave for passada (inclusive quando o valor for `null`, usando checagem por presença de propriedade, não `!== undefined` sobre valor). Continua UPDATE por `id`, sem insert/delete. Log de atividade preservado.

**3. `src/pages/Settings.tsx` — `ParametersTab`**
- Corrigir `getLabel`: `soybean_cbot` → "Soja CBOT", `corn_b3` → "Milho B3", `corn_cbot` → "Milho CBOT"; fallback para o próprio id.
- Novo card "Incremento de arredondamento", uma linha por par (as três), cada uma com:
  - Label "Incremento de arredondamento (R$/sc)" + nome do par;
  - input numérico (`step="0.01"`, `min="0"`), buffer de string próprio (`round_<id>`), aceitando vírgula como separador decimal (mesmo parse usado no resto do app);
  - texto "Atual: R$ X,XX/sc" ou, quando `null`/0, "Piso desligado — preço arredondado em 2 casas";
  - aviso no topo do card explicando que vazio ou zero desliga o piso intencionalmente;
  - erro inline (texto vermelho abaixo do input, botão bloqueado) para valor negativo ou não numérico — sem toast como único canal.
- Botão "Salvar" por linha abre um `AlertDialog` de confirmação com: nome do par, valor atual → valor novo e, quando o novo for vazio/zero, a frase de que o piso será desligado. Só grava após confirmar.
- Gravação: campo vazio → `null`; `0` digitado → `0` (mantém o que o usuário escreveu; o backend trata 0 como piso desligado); demais → número.
- Após sucesso: `toast.success`, limpa o buffer, invalidação já vem do hook.

## Regras respeitadas

- Zero cálculo no frontend: a tela grava o número, não simula preço nem arredonda nada.
- `rounding_increment` nunca entra no payload de `POST /pricing/table` — `GeneratePricingModal` não é tocado.
- Só UPDATE em `pricing_parameters`.

## Fora do escopo

Schema, Edge Functions, warehouses, combinações, tabela de preços e geração de tabela.

## Validação manual (Eduardo)

1. Soja de 0,10 → 0,50, salvar, gerar tabela: preços de soja em múltiplo de 0,50.
2. Voltar para 0,10 e conferir múltiplo antigo.
3. Limpar o campo do milho B3, salvar, gerar tabela: centavo livre.
4. Tentar salvar negativo: erro inline, botão bloqueado.
5. No Supabase, `rounding_increment` do milho B3 = `null`.
