

# Correção de erro + reteste do fluxo de mercado

## Item 3 — Confirmado
Os valores `SOJA`, `MILHO_CBOT`, `MILHO`, `FX` no frontend já batem com o constraint atualizado. Nenhuma alteração.

## Item 4 — Melhorar exibição de erro
Em `src/pages/Market.tsx`, no `catch` do `handleAutoFetch`, trocar:
```typescript
// DE:
toast.error(err instanceof Error ? err.message : 'Erro ao buscar dados');

// PARA:
const msg = err instanceof Error ? err.message : typeof err === 'object' && err !== null && 'message' in err ? String((err as any).message) : JSON.stringify(err);
toast.error(`Erro ao atualizar mercado: ${msg}`);
```

## Item 5 — Reteste
Após a alteração, usar `supabase--curl_edge_functions` para chamar o `api-proxy` com endpoint `/market/quotes` via GET, confirmar resposta 200. Em seguida, navegar para `/mercado` no browser, clicar "Atualizar Automático", e verificar via `supabase--read_query` que `market_data` tem linhas com commodity `FX`, `SOJA`, `MILHO_CBOT`. Por fim, screenshot para confirmar renderização nas tabelas.

## Arquivos modificados
- `src/pages/Market.tsx` — apenas o bloco catch (~1 linha)

