## Escopo
Adicionar sub-aba "Registros" em Administração (apenas em produção) e timbrar `is_staging` nas escritas do `activity_log`. Migração SQL já está aplicada — não tocar.

## 1) `src/lib/activityLog.ts`
Único ponto de insert em `activity_log`. Importar `getCurrentEnv` de `@/lib/envState` e adicionar ao payload:
```ts
is_staging: getCurrentEnv() === 'staging',
```

## 2) `src/pages/AdminUsers.tsx` → shell com Tabs
- Extrair todo o JSX/lógica atual num componente interno `UsersTab` (sem mudar nada).
- Novo `AdminUsers` retorna:
  ```tsx
  const { env } = useMesaEnv();
  const showRegistros = env === 'production';
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Administração</h2>
      </div>
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          {showRegistros && <TabsTrigger value="registros">Registros</TabsTrigger>}
        </TabsList>
        <TabsContent value="usuarios"><UsersTab /></TabsContent>
        {showRegistros && <TabsContent value="registros"><ActivityLogTab /></TabsContent>}
      </Tabs>
    </div>
  );
  ```
- O título "Administração de Usuários" interno do `UsersTab` é removido (já temos o título global).

## 3) `src/components/admin/ActivityLogTab.tsx` (novo)

### Estado de filtros server-side
- `startDate` / `endDate` (ISO via `DateInput`), default últimos 7 dias.
- `userEmail`, `action`, `entityType`, `entityId` (strings).
- `detailsQuery` (string) — tentativa server-side, fallback client.
- `showStaging` (boolean, default `false`) via `Switch`.
- Estado "aplicado" separado do estado dos inputs (botões "Aplicar"/"Limpar"); a query usa o estado aplicado.

### Query (React Query)
```ts
useQuery({
  queryKey: ['activity_log', applied],
  queryFn: async () => {
    let q = supabase.from('activity_log').select('*')
      .gte('occurred_at', `${applied.start}T00:00:00`)
      .lte('occurred_at', `${applied.end}T23:59:59`)
      .order('occurred_at', { ascending: false })
      .limit(1000);
    if (!applied.showStaging) q = q.eq('is_staging', false);
    if (applied.userEmail)  q = q.ilike('user_email', `%${applied.userEmail}%`);
    if (applied.action)     q = q.ilike('action', `%${applied.action}%`);
    if (applied.entityType) q = q.ilike('entity_type', `%${applied.entityType}%`);
    if (applied.entityId)   q = q.ilike('entity_id', `%${applied.entityId}%`);
    if (applied.detailsQuery) {
      // Tentativa server-side; se PostgREST rejeitar o cast, cair em fallback client.
      const tryQ = q.filter('details::text', 'ilike', `%${applied.detailsQuery}%`);
      const r = await tryQ;
      if (!r.error) return { rows: r.data, detailsServerOk: true };
      // fallback: refaz sem o filtro server-side
    }
    const r = await q;
    if (r.error) throw r.error;
    return { rows: r.data, detailsServerOk: false };
  },
});
```
Quando `detailsServerOk === false` e há `detailsQuery` aplicado, aplicar filtro client-side adicional em `JSON.stringify(row.details)`.

### UI
- Bloco de filtros (grid `md:grid-cols-3 lg:grid-cols-4 gap-3`): DateInput início, DateInput fim, inputs texto, Switch "Mostrar staging", botões Aplicar/Limpar.
- Tabela com colunas: **Quando** (`format(occurred_at, 'dd/MM/yyyy HH:mm:ss')`), **Usuário**, **Ação**, **Tipo entidade**, **ID entidade** (mono, truncado com `title` completo), **Detalhes** (`<pre>` truncado em ~120 chars; clique abre `Popover` com JSON completo formatado).
- Em cada `TableHead`, um `Input` pequeno (h-7) para refino client-side sobre o resultado já carregado (cada coluna filtra independentemente, AND entre elas).
- Rodapé: `Mostrando X de Y` e se `Y === 1000` aviso `"Limite de 1000 atingido — refine os filtros (especialmente datas)."`.

### Linha staging
Quando `showStaging` ligado, adicionar badge "STAGING" amarelo na coluna Quando para linhas com `is_staging === true`.

## Não-mexer
Sidebar, rotas, `useAuthorization`, migrações SQL, qualquer outro insert (não há outro insert em `activity_log` além de `logActivity`).
