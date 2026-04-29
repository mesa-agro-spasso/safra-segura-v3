## Ajuste único em `src/pages/OperacoesD24.tsx`

Nenhum outro arquivo é tocado. As mudanças se concentram em três blocos: o hook de persistência de colunas, a definição `MTM_COLUMNS`, e o `<TableHeader>`/`<TableBody>` da tabela MTM.

### 1. Estender `usePersistedColumns` para aceitar defaults parciais

A versão atual (linhas 85–99) inicializa com **todas** as colunas visíveis quando `localStorage` está vazio. Para que as novas colunas adicionadas (volume, fisico_atual, mtm_fisico, mtm_futuros, mtm_ndf, mtm_opcao, exposicao, calculado_em) iniciem **desativadas** sem afetar o comportamento de `OP_COLUMNS` e `SUMMARY_COLUMNS`, adicionar um terceiro parâmetro opcional `defaultKeys?: string[]`. Quando informado, esse conjunto é usado como fallback; quando omitido, mantém o comportamento atual (todas visíveis).

```ts
function usePersistedColumns(storageKey: string, columns: Col[], defaultKeys?: string[]) {
  const allKeys = useMemo(() => columns.map(c => c.key), [columns]);
  const [visible, setVisible] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* noop */ }
    return new Set(defaultKeys ?? allKeys);
  });
  // ... resto inalterado
}
```

### 2. Substituir `MTM_COLUMNS` (linhas 156–166) pela lista completa

```ts
const MTM_COLUMNS: Col[] = [
  { key: 'operacao',     label: 'Operação' },
  { key: 'commodity',    label: 'Commodity' },
  { key: 'praca',        label: 'Praça' },
  { key: 'volume',       label: 'Volume (sc)' },
  { key: 'trade_date',   label: 'Data Entrada' },
  { key: 'sale_date',    label: 'Data Saída' },
  { key: 'fisico_atual', label: 'Físico Atual (R$/sc)' },
  { key: 'mtm_fisico',   label: 'MTM Físico' },
  { key: 'mtm_futuros',  label: 'MTM Futuros' },
  { key: 'mtm_ndf',      label: 'MTM NDF' },
  { key: 'mtm_opcao',    label: 'MTM Opção' },
  { key: 'mtm_total',    label: 'Total MTM' },
  { key: 'mtm_per_sack', label: 'Por Saca' },
  { key: 'breakeven',    label: 'Break-even' },
  { key: 'fisico_alvo',  label: 'Físico Alvo' },
  { key: 'exposicao',    label: 'Exposição Total' },
  { key: 'calculado_em', label: 'Calculado em' },
];

const MTM_DEFAULT_VISIBLE = [
  'operacao','commodity','praca','trade_date','sale_date',
  'mtm_total','mtm_per_sack','breakeven','fisico_alvo',
];
```

E na linha 192, passar o default:

```ts
const mtmCols = usePersistedColumns('cols_mtm', MTM_COLUMNS, MTM_DEFAULT_VISIBLE);
```

### 3. Atualizar `<TableHeader>` e `<TableBody>` da MTM (linhas 580–615)

Renomear "Entrada"/"Saída" para "Data Entrada"/"Data Saída" e adicionar as novas células. Helper local de formatação de data-hora:

```ts
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
```

(declarado próximo a `fmtDate` no topo do arquivo, linha ~78)

Cabeçalho — substituir bloco atual (linhas 580–591) por:

```tsx
<TableHeader>
  <TableRow>
    {mtmCols.visible.has('operacao')     && <TableHead>Operação</TableHead>}
    {mtmCols.visible.has('commodity')    && <TableHead>Commodity</TableHead>}
    {mtmCols.visible.has('praca')        && <TableHead>Praça</TableHead>}
    {mtmCols.visible.has('volume')       && <TableHead>Volume (sc)</TableHead>}
    {mtmCols.visible.has('trade_date')   && <TableHead>Data Entrada</TableHead>}
    {mtmCols.visible.has('sale_date')    && <TableHead>Data Saída</TableHead>}
    {mtmCols.visible.has('fisico_atual') && <TableHead>Físico Atual</TableHead>}
    {mtmCols.visible.has('mtm_fisico')   && <TableHead>MTM Físico</TableHead>}
    {mtmCols.visible.has('mtm_futuros')  && <TableHead>MTM Futuros</TableHead>}
    {mtmCols.visible.has('mtm_ndf')      && <TableHead>MTM NDF</TableHead>}
    {mtmCols.visible.has('mtm_opcao')    && <TableHead>MTM Opção</TableHead>}
    {mtmCols.visible.has('mtm_total')    && <TableHead>Total</TableHead>}
    {mtmCols.visible.has('mtm_per_sack') && <TableHead>Por Saca</TableHead>}
    {mtmCols.visible.has('breakeven')    && <TableHead>Break-even</TableHead>}
    {mtmCols.visible.has('fisico_alvo')  && <TableHead>Físico Alvo</TableHead>}
    {mtmCols.visible.has('exposicao')    && <TableHead>Exposição Total</TableHead>}
    {mtmCols.visible.has('calculado_em') && <TableHead>Calculado em</TableHead>}
  </TableRow>
</TableHeader>
```

Corpo — substituir bloco atual (linhas 599–613) acrescentando as novas células e mantendo a ordem do header:

```tsx
const matched = orders?.find(o => o.operation_id === r.operation_id);
const ps = matched?.operation?.pricing_snapshots;
const wName = matched?.operation?.warehouses?.display_name ?? '—';
const total = (r.mtm_total_brl as number) ?? 0;
const physInput = physicalPrices[r.operation_id as string];
const physVal = physInput
  ? parseFloat(physInput)
  : (r as any).market_snapshot?.physical_price_current;

return (
  <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailResult(r)}>
    {mtmCols.visible.has('operacao')     && <TableCell className="font-mono text-xs">{(r.operation_id as string)?.slice(0, 8)}</TableCell>}
    {mtmCols.visible.has('commodity')    && <TableCell>{matched?.commodity === 'soybean' ? 'Soja' : matched?.commodity === 'corn' ? 'Milho' : '—'}</TableCell>}
    {mtmCols.visible.has('praca')        && <TableCell>{wName}</TableCell>}
    {mtmCols.visible.has('volume')       && <TableCell>{((matched?.volume_sacks ?? (r as any).volume_sacks ?? 0) as number).toLocaleString('pt-BR')}</TableCell>}
    {mtmCols.visible.has('trade_date')   && <TableCell>{fmtDate(ps?.trade_date)}</TableCell>}
    {mtmCols.visible.has('sale_date')    && <TableCell>{fmtDate(ps?.sale_date)}</TableCell>}
    {mtmCols.visible.has('fisico_atual') && <TableCell>{physVal != null ? `R$ ${Number(physVal).toFixed(2)}` : '—'}</TableCell>}
    {mtmCols.visible.has('mtm_fisico')   && <TableCell>{fmtBrl((r as any).mtm_physical_brl)}</TableCell>}
    {mtmCols.visible.has('mtm_futuros')  && <TableCell>{fmtBrl((r as any).mtm_futures_brl)}</TableCell>}
    {mtmCols.visible.has('mtm_ndf')      && <TableCell>{fmtBrl((r as any).mtm_ndf_brl)}</TableCell>}
    {mtmCols.visible.has('mtm_opcao')    && <TableCell>{fmtBrl((r as any).mtm_option_brl)}</TableCell>}
    {mtmCols.visible.has('mtm_total')    && <TableCell className={`font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {total.toFixed(2)}</TableCell>}
    {mtmCols.visible.has('mtm_per_sack') && <TableCell>R$ {((r.mtm_per_sack_brl as number) ?? 0).toFixed(2)}/sc</TableCell>}
    {mtmCols.visible.has('breakeven')    && <TableCell className="text-xs tabular-nums">R$ {calcBreakeven(r).toFixed(2)}/sc</TableCell>}
    {mtmCols.visible.has('fisico_alvo')  && <TableCell className="text-xs tabular-nums">R$ {calcTargetPhysical(r).toFixed(2)}/sc</TableCell>}
    {mtmCols.visible.has('exposicao')    && <TableCell>{fmtBrl((r as any).total_exposure_brl)}</TableCell>}
    {mtmCols.visible.has('calculado_em') && <TableCell className="text-xs">{fmtDateTime((r as any).calculated_at)}</TableCell>}
  </TableRow>
);
```

### Notas de escopo

- `OP_COLUMNS` (Operações) **mantém** os labels "Entrada"/"Saída" — escopo do pedido é a aba MTM.
- A segunda referência a `MTM_COLUMNS` na linha 625 (segundo card de resultado MTM) automaticamente herda os novos defaults via `mtmCols`, sem alteração de código.
- Casts `as any` seguem o padrão já adotado no arquivo para campos D24 não cobertos pelos tipos gerados do Supabase.
- Usuários que já têm `cols_mtm` salvo no `localStorage` mantêm sua seleção atual; novas colunas só aparecem desativadas para quem nunca personalizou.
