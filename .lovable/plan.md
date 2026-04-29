## Substituir Dialog placeholder por RegisterExecutionModal funcional

Único arquivo modificado: `src/pages/OperacoesD24.tsx`.

### 1. Novo componente `RegisterExecutionModal` (adicionar após `NewOperationModal`, ~linha 1856 área de componentes auxiliares)

Mesmo padrão de `HedgePlanEditor`/`NewOperationModal`: componente funcional separado com estado local via `useState`.

**Tipos e props:**
```typescript
type ExecLeg = {
  instrument_type: string;
  direction: string;
  currency: string;
  ticker: string;
  contracts: string;
  price: string;
  ndf_rate: string;
  ndf_maturity: string;
  option_type: string;
  strike: string;
  premium: string;
  expiration_date: string;
  notes: string;
  is_counterparty_insurance: boolean;
};

interface RegisterExecutionModalProps {
  operation: OperationWithDetails | null;
  userId: string | null;
  onClose: () => void;
  onExecuted: () => void;
}
```

**Inicialização das legs:** `useEffect` disparado quando `operation` muda, lê `(operation as any).hedge_plan` (suporta tanto array direto quanto `{plan: [...]}`), mapeia para `ExecLeg[]` com strings (conforme spec). Reseta `stonexText` para `''`.

**Layout:** `Dialog` aberto quando `operation !== null`. Para cada leg, um card com:
- Header com 3 badges: `instrument_type`, `direction`, `currency`
- Campos por tipo (futures / ndf / option) conforme spec
- Label do preço/prêmio dinâmico baseado em `operation.exchange` (`cbot` → "USD/bushel", `b3` → "BRL/sc")
- Campo Obs. sempre editável

Abaixo das legs: `Textarea` para "Texto de confirmação StoneX (colar na íntegra)".

**Botão "Confirmar Execução":**
1. Valida cada leg: `contracts > 0` e (`price > 0` para futures/option) ou (`ndf_rate > 0` para ndf). Falha → `toast.error('Preencha todos os campos obrigatórios')`.
2. Calcula `CONTRACT_SIZE` = 450 (b3) ou 5000 (cbot).
3. Loop sequencial: INSERT em `orders` via `supabase.from('orders' as any).insert(payload as never)` — uma linha por leg, com payload exato da spec (incluindo `stonex_confirmation_text` em todas as linhas, `is_closing: false`, `executed_at`, `executed_by: userId`).
4. Em qualquer erro: `toast.error` com mensagem.
5. Sucesso: chama `onExecuted()`.

Estado de loading (`submitting`) desabilita o botão durante o INSERT.

### 2. Substituir o Dialog placeholder (linhas 1839–1851)

Trocar o bloco `<Dialog open={!!registerExecutionOp} ...>...</Dialog>` por:

```tsx
<RegisterExecutionModal
  operation={registerExecutionOp}
  userId={user?.id ?? null}
  onClose={() => setRegisterExecutionOp(null)}
  onExecuted={() => {
    queryClient.invalidateQueries({ queryKey: ['operations_with_details'] });
    queryClient.invalidateQueries({ queryKey: ['operations'] });
    setRegisterExecutionOp(null);
    toast.success('Execução registrada — operação avançada para ACTIVE');
  }}
/>
```

(O toast e a invalidação ficam centralizados no `onExecuted` do parent, conforme spec — o componente filho não dispara o toast de sucesso final.)

### Restrições respeitadas

- Apenas `src/pages/OperacoesD24.tsx`.
- Sem novos hooks, sem Edge Functions, sem novos imports além dos já presentes (Dialog, Button, Input, Label, Textarea, Badge, Select, supabase, toast — todos já importados pelo arquivo).
- INSERT direto via `supabase.from('orders' as any)` para preservar a auth/RLS atual (`executed_by = auth.uid()`).
- Avanço de status para `ACTIVE` é feito automaticamente pelo trigger `advance_operation_after_order` no banco — frontend só insere.
- Apenas trechos modificados serão exibidos com contexto de localização.
