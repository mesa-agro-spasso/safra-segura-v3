## Alterações em `src/pages/OperacoesD24.tsx`

Único arquivo tocado. Duas mudanças.

---

### Parte 1 — `handleSave` no `NewOperationModal` (linha ~1173)

Trocar `hedge_plan: planResp.plan` por objeto contendo as mensagens:

```typescript
hedge_plan: {
  plan: planResp.plan,
  order_message: planResp.order_message,
  confirmation_message: planResp.confirmation_message,
},
```

Resto do `payload` e do `try/catch` permanece intacto.

---

### Parte 2 — Reescrita do Sheet de detalhe (linhas 845–935)

Substituir o `<Tabs>` interno por seções `Collapsible` (shadcn). O `<Sheet>`, `<SheetContent>` e `<SheetHeader>` permanecem; só o corpo (a IIFE entre linhas 855–933) é reescrito.

**Imports a adicionar** (topo do arquivo):

- `Collapsible, CollapsibleTrigger, CollapsibleContent` de `@/components/ui/collapsible`
- `ChevronDown`, `Copy` de `lucide-react`

**Helpers locais** (dentro da IIFE, sem novo arquivo):

```typescript
const opD24 = selectedOperation as any;
const rawPlan = opD24.hedge_plan;
const planLegs = Array.isArray(rawPlan) ? rawPlan : (rawPlan?.plan ?? []);
const orderMsg = Array.isArray(rawPlan) ? null : (rawPlan?.order_message ?? null);
const confirmMsg = Array.isArray(rawPlan) ? null : (rawPlan?.confirmation_message ?? null);
const ps = selectedOperation.pricing_snapshots;
const opMtmSnapshot = mtmSnapshots?.find(s => s.operation_id === selectedOperation.id);
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success('Copiado');
};
```

**Componente local** `Section` para evitar repetição:

```typescript
const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ...
```

Renderiza `<Collapsible defaultOpen>` com trigger uppercase + chevron rotacionado via `data-[state=open]:rotate-180`, e `CollapsibleContent` com grid de conteúdo.

**Seções renderizadas em ordem**:

1. **Identificação** (aberta) — ID (font-mono text-xs), Código, Status (badge via `STATUS_BADGE`), Commodity ("Soja CBOT" / "Milho B3"), Exchange, Volume, Criada em, Notas (condicional)
2. **Precificação** (aberta) — Preço originação (de `opD24.origination_price_brl`), Trade date, Pagamento, Recepção, Saída (todos via `fmtDate`)
3. **Snapshot de Referência** (fechada) — Ticker, Futuros BRL, Câmbio (4 casas), Target basis, Desconto adicional + iteração de `Object.entries(ps?.outputs_json ?? {})` filtrando não-nulos; chave em `font-mono text-xs`
4. **Plano de Hedge** (aberta) — itera `planLegs`; cada leg num card com badge `instrument_type`/`direction`/`currency` e campos condicionais (ticker, contratos/volume, preço, NDF rate+maturity, option type/strike/prêmio/vencimento, notes). Vazio → "Nenhum plano definido."
5. **Mensagens** (aberta, condicional `orderMsg || confirmMsg`) — `<pre className="whitespace-pre-wrap text-xs ...">` + botão `Copy` (icon button) por mensagem
6. **Ordens Vinculadas** (aberta) — usa `ordersForSelectedOperation`; cada ordem num card com display_code, badge status, volume_sacks, e legs resumidas como `leg_type(direction)` join `' + '`
7. **MTM** (fechada) — usa `opMtmSnapshot`; ausente → "Nenhum MTM calculado."; presente → physical_price_current, futures_price_current, spot_rate_current, mtm_total_brl (verde/vermelho), mtm_per_sack_brl, total_exposure_brl, calculated_at

Layout do conteúdo: grid 2 colunas (`grid grid-cols-[140px_1fr] gap-y-1 text-sm`), label em `text-muted-foreground`, valor à direita (ou esquerda da coluna 2).

---

### Restrições

- Apenas `src/pages/OperacoesD24.tsx` modificado
- Nenhum hook, serviço, Edge Function ou tipo novo
- Sem mudanças de schema/RLS
- Casts `as any` para `opD24` e campos não tipados
- `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` continuam usados em outros lugares do arquivo, então imports permanecem
