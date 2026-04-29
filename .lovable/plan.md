## Plano: src/pages/ArmazensD24.tsx

### Arquivos tocados
- **CRIAR** `src/pages/ArmazensD24.tsx`
- **EDITAR** `src/App.tsx` — apenas adicionar import e rota

Nenhum hook, serviço ou Edge Function novos. Sem escrita no banco.

---

### src/App.tsx — alteração mínima

Adicionar 1 import (ao lado de `OperacoesD24`):
```tsx
import ArmazensD24 from "./pages/ArmazensD24";
```

E 1 rota dentro do bloco protegido, ao lado de `/operacoes-d24`:
```tsx
<Route path="/armazens-d24" element={<ArmazensD24 />} />
```

Nenhuma outra mudança em App.tsx.

---

### src/pages/ArmazensD24.tsx — estrutura

**Imports**
- React, `useState`, `useMemo`
- `useNavigate` de `react-router-dom`
- Hooks: `useWarehouses`, `useActiveArmazens` de `@/hooks/useWarehouses`; `useOperationsWithDetails`; `useMtmSnapshots()` (sem filtro — pega tudo); `usePricingParameters`
- Tipos: `Warehouse`, `OperationWithDetails`, `MtmSnapshot` de `@/types`
- UI: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Tabs/TabsList/TabsTrigger/TabsContent`, `Table*`, `Badge`, `Button`, `Sheet/SheetContent/SheetHeader/SheetTitle`, `Collapsible/CollapsibleTrigger/CollapsibleContent`, `Separator`
- Ícones: `MapPin`, `ChevronDown`, `Settings as SettingsIcon`, `ExternalLink`

**Helpers locais (não importar de outras pages):**
- `STATUS_BADGE` e `STATUS_ORDER` — replicados localmente (mesmo padrão de `OperacoesD24.tsx`)
- `ACTIVE_STATUSES = new Set(['RASCUNHO','DRAFT','SUBMETIDA','EM_APROVACAO','APROVADA','HEDGE_CONFIRMADO','ENCERRAMENTO_SOLICITADO','ENCERRAMENTO_APROVADO','MONITORAMENTO'])` — todo status que não seja `ENCERRADA | CANCELADA | REPROVADA`
- `fmtDate`, `fmtBrl`, `fmtSc` (volume formatado com pt-BR)

**Fontes de dados (memoizado):**
1. `warehouses = useWarehouses()` filtrado em `useMemo` por `type !== 'HQ' && active === true`
2. `useActiveArmazens()` — usado apenas para resolver `display_name` de `reference_warehouse_id` na aba Configuração (referência nominal entre armazéns)
3. `operations = useOperationsWithDetails()` 
4. `snapshots = useMtmSnapshots()` (todos)
5. `pricingParameters = usePricingParameters()` — `executionSpread = pricingParameters?.[0]?.execution_spread_pct ?? 0.05`

**Snapshot mais recente por operação** (memo):
Reduce por `operation_id` mantendo o de maior `calculated_at`. Mapa `latestByOpId: Record<string, MtmSnapshot>`.

---

### Aba "Posição" — tabela consolidada

Para cada warehouse, computar via `useMemo`:
- `ops = operations.filter(o => o.warehouse_id === w.id && ACTIVE_STATUSES.has(o.status))`
- `commodities` = `Set` distinto de `o.commodity` em `ops`
- `volumeTotal` = soma `o.volume_sacks`
- `mtmTotal` = soma `latestByOpId[o.id]?.mtm_total_brl ?? 0`
- `breakevenMedio` = média ponderada por volume:
  - Para cada `o`: `snap = latestByOpId[o.id]`; se snap existe, calcular
    - `physical = snap.physical_price_current` (sem input manual)
    - `mtmPerSack = snap.mtm_per_sack_brl`
    - `be_i = (physical - mtmPerSack) * (1 + executionSpread)` (extensão direta da exceção D20)
    - acumula `Σ(be_i * volume_i)` e `Σ(volume_i)` apenas para os ops com snap
  - resultado = `sum / sumVol`, ou `null` se `sumVol === 0`
- `proximoVencimento` = menor `pricing_snapshots.sale_date` entre `ops` (string ISO; comparar com `localeCompare`)
- `statusMix`: contagens por bucket: RASCUNHO (inclui DRAFT), EM_APROVACAO, HEDGE_CONFIRMADO, OUTROS (todos os demais ativos)

**Renderização da tabela** (`<Table>`), colunas:
| Armazém | Commodity | Op. ativas | Volume (sc) | MTM Total (R$) | Break-even médio | Próx. venc. | Status mix |

- Armazém: `display_name` em texto + `abbr` em `text-xs text-muted-foreground`
- Commodity: badges das commodities distintas
- MTM Total: cor `text-green-500` se ≥0, `text-red-500` caso contrário; `fmtBrl`
- Break-even médio: `fmtBrl(beMedio)` ou "—"
- Próx. venc.: `fmtDate`
- Status mix: row com 4 mini-badges pequenos (`text-[10px]`), cada um com label+count, somente exibe se count>0

`<TableRow>` com `cursor-pointer hover:bg-muted/50` e `onClick` que define `selectedWarehouseId`.

Sem operações ativas → todas as métricas em zero/traço, linha **não** é ocultada.

---

### Sheet de detalhe (lateral direita, `sm:max-w-2xl`)

Aberto quando `selectedWarehouseId !== null`. `Sheet` controlado via `open` e `onOpenChange`.

Cabeçalho: `display_name` · `city/state` · Badge "Ativo"/"Inativo"

3 cards em grid:
- Volume Total (sc): `fmtSc(volumeTotal)`
- MTM Total: `fmtBrl(mtmTotal)` com cor por sinal
- Operações: count

Tabela das operações do armazém (apenas leitura), ordenadas por `STATUS_ORDER[status] ?? 50` ascendente, depois por `created_at` desc:
| Código (`display_code` se houver, senão `id.slice(0,8)`) | Commodity | Volume (sc) | Status (badge) | Pagamento | Saída | MTM (R$/sc) |

MTM/sc = `latestByOpId[o.id]?.mtm_per_sack_brl` formatado, com cor por sinal; "—" se sem snapshot.

Sem botões de ação.

---

### Aba "Configuração"

Lista vertical de `Card`, um por warehouse ativo (`type !== 'HQ'`).

Cada card:

**CardHeader:** `display_name` · `abbr` (chip muted) · `city/state` (text-xs)

**Seção Basis** (`Collapsible` com `defaultOpen`):
- Trigger: "Basis por commodity" + chevron
- Para cada commodity em `['soybean', 'corn']` (labels: "Soja CBOT", "Milho B3"):
  - Lê `cfg = (w.basis_config as any)?.[commodity]`
  - Se `cfg.mode === 'reference_delta'`: renderiza `Referência: {warehouse_display_name} + delta R$ {delta_brl}` (resolve nome via `allWarehouses.find(x => x.id === cfg.reference_warehouse_id)?.display_name ?? '—'`)
  - Caso contrário (fixed ou ausente): `R$ {cfg?.value ?? '—'}/sc`

**Seção Custos** (`Collapsible`, fechado por default):
Grid 2 colunas com pares label/valor:
- Armazenagem: `storage_cost` + `(${storage_cost_type})`
- Juros: `interest_rate` + `(${interest_rate_period})`
- Corretagem CBOT: `brokerage_per_contract_cbot` USD/contrato
- Corretagem B3: `brokerage_per_contract_b3` BRL/contrato
- Custo mesa: `desk_cost_pct` em % (multiplicar por 100 se fração; assumir já em fração e exibir `(x*100).toFixed(2)%`)
- Quebra mensal: `shrinkage_rate_monthly` mesmo padrão de %
- Recepção: `reception_cost` R$/sc

`null` → "—".

**CardFooter (div com `border-t pt-3`):**
Botão `variant="outline" size="sm"` "Editar em Configurações" + ícone `ExternalLink`, `onClick={() => navigate('/configuracoes')}`.

---

### Restrições reafirmadas
- Sem imports de `Settings.tsx`, `OperacoesD24.tsx`, `OrdensD24.tsx` — helpers replicados localmente.
- Sem novos hooks/serviços.
- Único cálculo financeiro: break-even por operação (D20 já autorizada) e sua média ponderada.
- Casts `as any` permitidos para `basis_config` e demais colunas D24.
- Resposta final incluirá o conteúdo completo do novo arquivo + diff de App.tsx para revisão.
