

# Alterar status inicial em handleSaveOrder

Arquivo único: `src/pages/Orders.tsx`

## Mudança

No insert de `operations` dentro de `handleSaveOrder`, trocar:

```ts
status: 'HEDGE_CONFIRMADO'
```

por:

```ts
status: 'RASCUNHO'
```

Nada mais é alterado.

