## Fix — modais perdem dados em re-renders externos (alt+tab, refetch)

Os `useEffect([open])` / `useEffect([operation])` dos modais resetam estado a cada re-render do pai, apagando o que o usuário digitou. Solução: guardar o ID/estado anterior em `useRef` e só resetar quando realmente houve transição (modal abriu ou operação mudou).

### Arquivos alterados
- `src/pages/OperacoesD24.tsx` (3 modais)
- `src/pages/OrdensD24.tsx` (1 modal)

---

### 1. `OperacoesD24.tsx` — `NewOperationModal` (linhas 2018-2026)

Reset apenas na transição `open: false → true`.

```tsx
const prevOpenRef = React.useRef(false);
useEffect(() => {
  if (open && !prevOpenRef.current) {
    setWarehouseId(''); setCommodityKey(''); setVolume(''); setOriginPrice('');
    setSnapshotId(''); setTradeDate(new Date().toISOString().slice(0, 10));
    setPaymentDate(''); setReceptionDate(''); setSaleDate(''); setNotes('');
    setPlanResp(null);
  }
  prevOpenRef.current = open;
}, [open]);
```

### 2. `OperacoesD24.tsx` — `ClosingModal` (linhas 2281-2287)

Reset só quando muda a `operation.id`.

```tsx
const prevClosingIdRef = React.useRef<string | null>(null);
useEffect(() => {
  const newId = operation?.id ?? null;
  if (newId === null) { prevClosingIdRef.current = null; return; }
  if (newId === prevClosingIdRef.current) return;
  prevClosingIdRef.current = newId;
  setVolumeStr(String(operation!.volume_sacks));
  setStrategy('PROPORTIONAL');
  setProposal(null);
}, [operation]);
```

### 3. `OperacoesD24.tsx` — `RegisterExecutionModal` (linhas 2482-2508)

Reset só quando muda a `operation.id`; ao fechar (null) só limpa o ref.

```tsx
const prevOpIdRef = React.useRef<string | null>(null);
useEffect(() => {
  const newId = (operation as any)?.id ?? null;
  if (newId === null) { prevOpIdRef.current = null; return; }
  if (newId === prevOpIdRef.current) return;
  prevOpIdRef.current = newId;
  const rawPlan = (operation as any).hedge_plan;
  const planLegs = Array.isArray(rawPlan) ? rawPlan : (rawPlan?.plan ?? []);
  const initial: ExecLeg[] = (planLegs as any[]).map((l: any) => ({
    instrument_type: l.instrument_type ?? 'futures',
    direction: l.direction ?? 'sell',
    currency: l.currency ?? 'USD',
    ticker: l.ticker ?? '',
    contracts: l.contracts != null ? String(l.contracts) : '',
    price: l.price_estimated != null ? String(l.price_estimated) : '',
    ndf_rate: l.ndf_rate != null ? String(l.ndf_rate) : '',
    ndf_maturity: l.ndf_maturity ?? '',
    option_type: l.option_type ?? 'call',
    strike: l.strike != null ? String(l.strike) : '',
    premium: l.premium != null ? String(l.premium) : '',
    expiration_date: l.expiration_date ?? '',
    notes: '',
    is_counterparty_insurance: l.is_counterparty_insurance ?? false,
  }));
  setExecLegs(initial);
  setStonexText('');
}, [operation]);
```

### 4. `OrdensD24.tsx` — `CloseOrderModal` (linhas 439-445)

Reset só quando muda a `order.id` (ainda mantendo `defaultPrice` na deps para reaplicar quando market data chega).

```tsx
const prevOrderIdRef = React.useRef<string | null>(null);
useEffect(() => {
  const newId = order?.id ?? null;
  if (newId === null) { prevOrderIdRef.current = null; return; }
  if (newId === prevOrderIdRef.current) return;
  prevOrderIdRef.current = newId;
  setContracts(String(order!.contracts ?? ''));
  setPrice(defaultPrice);
  setNotes('');
}, [order, defaultPrice]);
```

### Restrições
- Apenas os 2 arquivos acima.
- Sem novos hooks, Edge Functions, ou mudanças de assinatura.
- O `useEffect([selectedSnapshot])` de auto-fill de datas (linha 2048) e o `ExecutionModal` de `OrdensD24` (linha 624) **não** estão no escopo.
