

# Correção: NDF estimado como taxa de câmbio + atualização de memória

## Mudança no código

**Arquivo: `src/components/GeneratePricingModal.tsx`**, linha 114.

Substituir `exchange_rate: spotRate` por lógica condicional:

```typescript
// Resolver exchange_rate por commodity/benchmark
let exchangeRate: number | null = null;
if (combo.commodity === 'soybean') {
  exchangeRate = market.ndf_estimated ?? spotRate;
} else if (combo.commodity === 'corn' && combo.benchmark === 'cbot') {
  exchangeRate = spotRate;
}
// corn + b3: não envia exchange_rate (null)
```

E no payload: `exchange_rate: exchangeRate`

Remover o `spotRate` do bloco `inputs_json` também — usar o mesmo `exchangeRate` resolvido.

## Atualização de memória

**Arquivo: `mem://features/pricing-combinations-contract`** — adicionar seção:

```
## exchange_rate (resolução)

- soybean (CBOT): usar ndf_estimated do market_data do ticker. Fallback: USD/BRL spot.
- corn (CBOT): usar USD/BRL spot.
- corn (B3): não enviar exchange_rate.

## Futuro: ndf_rate_override

- Campo ainda não existe em pricing_combinations.
- Quando implementado: ndf_rate_override prevalece sobre ndf_estimated. Quando null, usa ndf_estimated.
- NÃO implementar agora — apenas documentar.
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/GeneratePricingModal.tsx` | Resolver exchange_rate por commodity/benchmark |
| `mem://features/pricing-combinations-contract` | Adicionar regras de exchange_rate e nota sobre ndf_rate_override futuro |

