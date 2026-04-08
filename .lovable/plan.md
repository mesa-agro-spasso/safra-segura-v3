

# Integração Milho B3 — Pricing Combinations, Modal de Geração e Ordens

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Settings.tsx` | Filtro ticker + bloqueio soybean+b3 + limpar ticker ao mudar commodity/benchmark |
| `src/components/GeneratePricingModal.tsx` | canGenerate relaxado, aviso prévio de B3 sem preço |
| `src/pages/Orders.tsx` | Label do snapshot com benchmark |
| `mem://features/b3-corn-pricing-integration` | Novo — contrato do feature |

## Fase 1 — Settings.tsx (dropdown de ticker)

### 1a. Bloqueio soybean + b3
Linhas 201-206: quando `commodity === 'soybean'`, o dropdown de benchmark só mostra `CBOT` (remover o `SelectItem value="b3"`). Implementar condicionalmente:

```tsx
<SelectContent>
  <SelectItem value="cbot">CBOT</SelectItem>
  {(editing.commodity ?? 'soybean') !== 'soybean' && (
    <SelectItem value="b3">B3</SelectItem>
  )}
</SelectContent>
```

Adicionalmente, no `onValueChange` de commodity: se mudar para `soybean` e benchmark atual é `b3`, resetar benchmark para `cbot`.

### 1b. Filtro de ticker com benchmark
Linhas 213-219: substituir filtro por versão com benchmark:

```tsx
.filter((m) => {
  const commodity = editing.commodity ?? 'soybean';
  const benchmark = editing.benchmark ?? 'cbot';
  if (commodity === 'soybean' && benchmark === 'cbot') return m.commodity === 'SOJA';
  if (commodity === 'corn' && benchmark === 'cbot') return m.commodity === 'MILHO_CBOT';
  if (commodity === 'corn' && benchmark === 'b3') return m.commodity === 'MILHO';
  return false;
})
```

### 1c. Limpar ticker ao mudar commodity ou benchmark
No `onValueChange` de commodity e benchmark, adicionar `ticker: ''` ao `setEditing`.

## Fase 2 — GeneratePricingModal.tsx

### 2a. Classificar combinações
Adicionar `useMemo` que separa combinações em `cbotCombos` e `b3Combos`, e identifica `b3MissingPrice` (tickers B3 cujo `market.price` é null/undefined ou cujo ticker não existe em `marketMap`).

### 2b. canGenerate relaxado
Substituir linha 58:

```tsx
const hasCbot = cbotCombos.length > 0;
const hasB3 = b3Combos.length > 0;
const needsSpot = hasCbot; // CBOT combos need spotRate
const canGenerate = (combinations?.length ?? 0) > 0
  && (!needsSpot || spotRate !== null);
```

### 2c. Aviso prévio de B3 sem preço
No corpo do modal (entre o resumo e o footer), adicionar bloco condicional:

```tsx
{b3MissingPrice.length > 0 && (
  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 space-y-1">
    <p className="text-xs font-semibold text-yellow-500">
      ⚠ {b3MissingPrice.length} ticker(s) B3 sem preço — serão pulados:
    </p>
    <ul className="text-xs text-yellow-400 list-disc pl-4">
      {b3MissingPrice.map(t => <li key={t}>{t}</li>)}
    </ul>
    <p className="text-xs text-muted-foreground">
      Preencha os preços na aba Mercado → Milho B3 antes de gerar.
    </p>
  </div>
)}
```

### 2d. Mensagem de spotRate condicional
Se `needsSpot` é false (só B3), não mostrar alerta de USD/BRL como erro — mostrar como info: "Câmbio não necessário (apenas combinações B3)".

### 2e. handleGenerate — pular B3 sem preço
No loop `for (const combo of combinations)`, após obter `market`, adicionar check:
- Se `combo.commodity === 'corn' && combo.benchmark === 'b3' && (!market || market.price == null)`, pular com `continue` (sem toast, já avisou no modal).

## Fase 3 — Orders.tsx (label do snapshot)

Linha 153: melhorar label do dropdown de snapshots para incluir benchmark:

```tsx
{s.commodity} - {s.benchmark?.toUpperCase() ?? 'CBOT'} - {s.warehouse_id} - R${s.origination_price_brl.toFixed(2)}
```

O payload de `/orders/build` já envia `pricing_snapshot_id` e a API resolve tudo server-side. Nenhuma mudança de lógica necessária — a API já suporta B3.

## Fase 4 — Memória

Criar `mem://features/b3-corn-pricing-integration` com o contrato de tradução commodity/benchmark → market_data.commodity e as regras de exchange_rate (null para B3). Atualizar `mem://index.md`.

