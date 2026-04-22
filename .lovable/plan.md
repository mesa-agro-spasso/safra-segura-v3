

# Nova seção "Preço de Entrada (Executado)" no modal MTM

## Escopo
Apenas `src/pages/OperationsMTM.tsx`. A Edge Function `api-proxy` NÃO é tocada — o endpoint `/utils/convert-price` já está no whitelist gerenciado manualmente.

## Mudanças em `src/pages/OperationsMTM.tsx`

### 1. Estado de seções colapsáveis
Adicionar `entrada: false` ao objeto `expandedSections`:
```ts
{ identificacao:false, datas:false, mercado:false, entrada:false, custos:false, basis:false, resultado:false }
```

### 2. Novo estado para preços convertidos
```ts
const [convertedLegPrices, setConvertedLegPrices] = useState<{
  status: 'idle' | 'loading' | 'ready' | 'error';
  values: Record<number, number | null>;   // index da leg → preço BRL/sc
  fxMissing: Record<number, boolean>;      // marca legs sem câmbio
}>({ status: 'idle', values: {}, fxMissing: {} });
```

### 3. useEffect com guard de race condition
Disparado quando `detailResult` muda. Localiza `matchedOrder` via `orders?.find(...)`:

```ts
const executed = matchedOrder?.executed_legs as any[] | null | undefined;
const legsSource = (executed?.length ? executed : (matchedOrder?.legs as any[])) ?? [];
const isFallback = !(executed && executed.length > 0);
```

**Câmbio:**
- `ndfLeg = legsSource.find(l => l.leg_type === 'ndf')`
- Se existe → `exchange_rate = ndfLeg.ndf_rate`
- Senão → `matchedOrder?.operation?.pricing_snapshots?.outputs_json?.exchange_rate`

**Conversões em paralelo** — montar lista única `[{ idx, value, kind: 'price'|'premium' }]` cobrindo futures (`leg.price`) e option (`leg.premium`). Pular legs de milho B3 (`exchange === 'b3'`) e legs sem câmbio (marcar `fxMissing[idx] = true`).

Para cada item conversível:
```ts
supabase.functions.invoke('api-proxy', {
  body: { endpoint: '/utils/convert-price', body: {
    value, from_unit:'usd_per_bushel', to_unit:'brl_per_sack',
    commodity: matchedOrder.commodity === 'soybean' ? 'soybean' : 'corn',
    exchange_rate,
  }},
})
```

Padrão de cancelamento:
```ts
let cancelled = false;
(async () => {
  setConvertedLegPrices({ status:'loading', values:{}, fxMissing:{} });
  try {
    const results = await Promise.all(...);
    if (!cancelled) setConvertedLegPrices({ status:'ready', values, fxMissing });
  } catch (e) {
    if (!cancelled) {
      setConvertedLegPrices({ status:'error', values:{}, fxMissing:{} });
      toast.error('Erro ao converter preços de entrada');
    }
  }
})();
return () => { cancelled = true; };
```
Dependências: `[detailResult, matchedOrder?.id]`.

### 4. Nova `<CollapsibleSection sectionKey="entrada" label="Preço de Entrada (Executado)">`
Inserida entre as seções "mercado" e "custos".

**Lógica de render:**
1. Recomputar `legsSource`, `isFallback`, `exchange_rate`.
2. `validLegs = legsSource.filter(l => ['futures','option','ndf'].includes(l.leg_type))`.
3. Se `validLegs.length === 0` → `<p className="text-sm text-muted-foreground">Nenhuma perna de hedge encontrada</p>`.
4. Para cada leg, linha `flex justify-between py-1`.

**Formatadores locais:**
```ts
const fmtMoney = (v:number) => new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:4 }).format(v);
const fmtCt    = (v:number) => v.toLocaleString('pt-BR',{ minimumFractionDigits:2, maximumFractionDigits:2 });
const fmtVol   = (v:number) => v.toLocaleString('pt-BR',{ maximumFractionDigits:2 });
```

**Sufixos por linha** (combináveis):
```ts
const suffix = `${isFallback ? ' *' : ''}${fxMissing[i] ? ' **' : ''}`;
// Exemplos: " *", " **", " *,**" — usar formato " *,**" quando ambos
const buildSuffix = () => {
  const marks = [isFallback && '*', fxMissing[i] && '**'].filter(Boolean);
  return marks.length ? ` ${marks.join(',')}` : '';
};
```

**Renderização por tipo:**

- **futures**:  
  `Futuro {ticker} · {direction} · {fmtCt(contracts)} ct       {priceLabel}{suffix}`
  - exchange === 'b3' → `${fmtMoney(leg.price)}/sc`
  - status loading → `'carregando...'`
  - status error → `'erro'`
  - fxMissing[i] → `'R$ —/sc'`
  - ready → `${fmtMoney(values[i])}/sc`

- **option**:  
  `Opção {Call|Put} K={strike} · {direction} · {fmtCt(contracts)} ct    {premiumLabel}{suffix}`
  - strike CBOT → `USD ${strike.toFixed(4)}/bu`
  - strike B3 → `${fmtMoney(strike)}/sc`
  - premium segue mesma lógica de futures (B3 direto, CBOT via API)

- **ndf**:  
  `Câmbio NDF · {direction} · USD {fmtVol(volume_units)}      {fmtMoney(ndf_rate)}{suffix}`
  - sem conversão; `ndf_rate` direto. Suffix aplica apenas `*` (fallback) — NDF nunca é fxMissing.

5. **Notas de rodapé** (após o map, símbolos distintos):
- Se alguma linha tem `isFallback` → `<p className="text-xs text-muted-foreground">* Preço da precificação original — ordem sem execução registrada</p>`
- Se alguma linha tem `fxMissing` → `<p className="text-xs text-muted-foreground">** Câmbio não disponível para conversão</p>`
- Linhas com ambos os marcadores exibem `*,**` no sufixo.

## Constraints
- Nenhum cálculo financeiro local — conversão USD/bu→BRL/sc passa exclusivamente por `/utils/convert-price`.
- Nenhuma alteração fora de `src/pages/OperationsMTM.tsx`.
- Nenhuma alteração na Edge Function `api-proxy`.
- Nenhuma query nova ao Supabase — usa `matchedOrder` já carregado via `useHedgeOrders`.
- Cancelamento via flag `cancelled` no cleanup do useEffect.
- `Promise.all` paralelo para conversões da mesma operação.
- Label exato: `"Preço de Entrada (Executado)"`.
- Posição: entre "Snapshot de Mercado" e "Custos de Originação".

## Fora de escopo
Backfill de ordens seed, alterações em hooks/schema/outros componentes, edição da Edge Function.

