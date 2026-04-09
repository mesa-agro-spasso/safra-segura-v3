

# Correção do payload em handleBuildOrder — Orders.tsx

## Arquivo: `src/pages/Orders.tsx`

### Edição única — linhas 184-201

Substituir o bloco de montagem de `legsPayload` e `callApi` (linhas 185-201) pelo novo código que:

1. **Adiciona `currency`** a cada perna: `'USD'` para NDF; para as demais, `'USD'` se CBOT, `'BRL'` se B3
2. **Expande campos do snapshot** no payload: `pricing_id`, `commodity`, `exchange`, `origination_price_brl`, `futures_price`, `exchange_rate`, `ticker`, `payment_date`, `sale_date`, `grain_reception_date`
3. **Remove `warehouse_id` e `pricing_snapshot_id`** do payload da API (não existem no `BuildOrderRequest`)

Código substituto (linhas 184-201):

```tsx
      // 2. Call API to build order
      const snap = selectedSnapshotData;
      const legCurrency = (commodityType === 'soybean|cbot' || commodityType === 'corn|cbot') ? 'USD' : 'BRL';

      const legsPayload = legs.map(l => ({
        leg_type: l.leg_type,
        direction: l.direction,
        currency: l.leg_type === 'ndf' ? 'USD' : legCurrency,
        ticker: l.ticker || undefined,
        contracts: l.contracts ? parseFloat(l.contracts) : undefined,
        price: l.price ? parseFloat(l.price) : undefined,
        ndf_rate: l.ndf_rate ? parseFloat(l.ndf_rate) : undefined,
        strike: l.strike ? parseFloat(l.strike) : undefined,
        premium: l.premium ? parseFloat(l.premium) : undefined,
        option_type: l.option_type || undefined,
      }));

      const result = await callApi<Record<string, unknown>>('/orders/build', {
        pricing_id: snap?.id ?? null,
        commodity: com,
        exchange: bench,
        origination_price_brl: snap?.origination_price_brl ?? 0,
        futures_price: snap?.futures_price_brl ?? 0,
        exchange_rate: snap?.exchange_rate ?? null,
        ticker: snap?.ticker ?? '',
        payment_date: snap?.payment_date ?? '',
        sale_date: snap?.sale_date ?? '',
        grain_reception_date: snap?.grain_reception_date ?? snap?.payment_date ?? '',
        volume_sacks: parseFloat(volume),
        operation_id: operationId,
        use_custom_structure: true,
        legs: legsPayload,
      });
```

### O que NÃO muda

- Insert da operação (linhas 168-182)
- Insert do hedge_order (linhas 204-218)
- Abas "Ordens Existentes" e "Registro Manual"
- Nenhum outro arquivo

