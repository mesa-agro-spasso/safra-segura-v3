## Objetivo

Mostrar, ao gerar a tabela de preços, quais combinações a API descartou — e só liberar a tabela depois da confirmação.

## Fluxo novo

```text
Gerar → POST /pricing/table → { results, discarded }
   ├─ discarded vazio  → salva snapshots, fecha modal (igual hoje)
   └─ discarded cheio  → salva snapshots, troca o conteúdo do modal
                          pela lista de descartes → "Entendi" → fecha,
                          tabela aparece
```

Se `results` vier vazio, é 200 normal: sem toast de erro, apenas o diálogo e depois a tabela vazia.

## Alterações

**`src/components/GeneratePricingModal.tsx`**
- Tipar a resposta como `{ results: [...]; discarded?: DiscardedCombination[] }`.
- Novo estado `discarded`. Quando não vazio, o modal permanece aberto e renderiza a etapa "Combinações descartadas" (lista + botão único "Entendi" que fecha e limpa o estado). Quando vazio, comportamento atual intacto.
- Toast de sucesso ajustado para refletir também o número de descartes quando houver.
- Limpar `discarded` ao reabrir o modal, para que o diálogo reapareça a cada geração.

**`src/components/DiscardedCombinationsList.tsx`** (novo)
- Recebe `DiscardedCombination[]`, renderiza uma linha por descarte: `display_name · commodity · ticker` + motivo em português.
- Mapa de códigos → texto:
  - `PAYMENT_DATE_BEFORE_TRADE_DATE` → "Data de pagamento vencida (DD/MM/AAAA). Corrija o cadastro da combinação."
  - `PAYMENT_DATE_AFTER_SALE_DATE` → "Pagamento (DD/MM/AAAA) posterior à venda (DD/MM/AAAA)."
  - Código desconhecido → exibe o `detail` da API (fallback obrigatório, a lista vai crescer).
- Formatação DD/MM/AAAA é só troca de string do ISO `YYYY-MM-DD` — sem `new Date()`, sem comparação, sem cálculo.

**`src/types/index.ts`**
- `DiscardedCombination`: `index`, `warehouse_id`, `display_name`, `commodity`, `benchmark`, `ticker`, `reason`, `detail`, `payment_date`, `sale_date`, `trade_date` (campos de data opcionais/nuláveis).

## Não muda

Payload enviado (nada de filtro prévio ou correção de data), Edge Function, schema, formulários de combinação/armazém, detalhamento de custos e painel de basis.

## Validação manual

1. Gerar sem combinação inválida → sem diálogo.
2. Gerar com a combinação soja ZSF27 / praça 050 (pagamento 24/08/2026, venda 14/08/2026) → aparece no diálogo com motivo "pagamento posterior à venda" e não entra na tabela.
3. Confirmar → tabela com as demais praças.
4. Gerar de novo → diálogo reaparece.
