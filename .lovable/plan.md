

# Aba "Alçadas" em Settings.tsx

Arquivo único: `src/pages/Settings.tsx`.

## Mudanças

### 1. Imports a adicionar
- `useEffect` de `react`
- `useQuery, useQueryClient` de `@tanstack/react-query`
- `supabase` de `@/integrations/supabase/client`
- `useAuth` de `@/contexts/AuthContext`

### 2. Novo componente `AlcadasTab`
- Fetch `['approval-policy']` → `approval_policies` ativa (`maybeSingle`)
- Estado `thresholdX` / `thresholdY` (string), populados via `useEffect` quando policy carrega:
  - `thresholdX = policy.threshold_x_tons`
  - `thresholdY = policy.threshold_x_tons + policy.threshold_y_tons` (limite superior absoluto)
- Empty state se `!policy`: aviso "Nenhuma política ativa configurada"
- 2 inputs numéricos:
  - **Faixa 1 até (toneladas)** — hint: "Operações até este volume exigem aprovação da Faixa 1"
  - **Faixa 2 até (toneladas)** — hint: "Limite superior da Faixa 2 — deve ser maior que o valor da Faixa 1"
- Validação no save: `Number(thresholdY) > Number(thresholdX)`, ambos `>= 0`. Se inválido → toast.error e não salva
- Bloco explicativo (3 linhas, `text-xs text-muted-foreground`):
  - Até X ton: Mesa + Comercial N1 + Comercial N2 + Financeiro N1
  - De X+1 até Y ton: Mesa + Comercial N1 + 2× Comercial N2 + Financeiro N1 + Financeiro N2
  - Acima de Y ton: Mesa + Comercial N1 + Presidência + Financeiro N1 + Financeiro N2
- `handleSave` (admin only): update por `id`, gravando `threshold_y_tons = Number(thresholdY) - Number(thresholdX)` (delta)
- Toast sucesso/erro, invalida `['approval-policy']` e `['pending-approvals-count']`
- Botão "Salvar" condicional a `profile?.is_admin === true`; se não-admin, mostrar nota "Somente administradores podem editar"

### 3. Registro nas Tabs
- `<TabsTrigger value="alcadas">Alçadas</TabsTrigger>` após "Parâmetros"
- `<TabsContent value="alcadas"><AlcadasTab /></TabsContent>`

## Fora de escopo
Outras abas, criação/versionamento de policies, edge functions, migrations, mudanças no Approvals/usePendingApprovalsCount (já consomem `x + y` corretamente).

