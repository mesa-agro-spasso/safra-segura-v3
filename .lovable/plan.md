

# Correção de preço nas pernas — Orders.tsx

## Arquivo: `src/pages/Orders.tsx`

### Edição única — linhas 127-128

Substituir:
```tsx
    const futuresPrice = snap?.futures_price_brl ? String(snap.futures_price_brl.toFixed(2)) : '';
    const ndfRate = snap?.exchange_rate ? String(snap.exchange_rate.toFixed(4)) : '';
```

Por:
```tsx
    const exchangeRate = snap?.exchange_rate ?? 1;
    let futuresPrice = '';
    if (commodityType === 'soybean|cbot' && snap?.futures_price_brl && exchangeRate) {
      futuresPrice = (snap.futures_price_brl / exchangeRate / 2.20462).toFixed(4);
    } else if (commodityType === 'corn|cbot' && snap?.futures_price_brl && exchangeRate) {
      futuresPrice = (snap.futures_price_brl / exchangeRate / 2.3622 * 100).toFixed(2);
    } else if (commodityType === 'corn|b3' && snap?.futures_price_brl) {
      futuresPrice = snap.futures_price_brl.toFixed(2);
    }
    const ndfRate = snap?.exchange_rate ? String(snap.exchange_rate.toFixed(4)) : '';
```

### Lógica

- **soybean|cbot**: BRL/saca → USD/bushel (÷ câmbio ÷ 2.20462), 4 decimais
- **corn|cbot**: BRL/saca → USD cents/bushel (÷ câmbio ÷ 2.3622 × 100), 2 decimais
- **corn|b3**: já em BRL/saca, sem conversão, 2 decimais
- `ndfRate` inalterado

### O que NÃO muda

Tudo o mais: pernas geradas, editor, handleBuildOrder, outras abas.

