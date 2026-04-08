

# Ajustes no fluxo de pernas — Orders.tsx

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Orders.tsx` | 2 edições cirúrgicas |

## Ajuste 1 — disabled no Select "Preço de Referência" (linha 302)

Trocar:
```tsx
disabled={!commodityType}
```
Por:
```tsx
disabled={!commodityType || !volume || parseFloat(volume) <= 0}
```

Atualizar também o placeholder (linha 303) para refletir:
```tsx
placeholder={!commodityType ? 'Selecione commodity primeiro' : (!volume || parseFloat(volume) <= 0) ? 'Preencha volume primeiro' : 'Selecione'}
```

## Ajuste 2 — useEffect de geração de pernas (linhas 104-117)

Substituir o bloco inteiro pelo novo useEffect que:
- Guarda contra volume vazio/zero
- Calcula contratos automaticamente via `calculateContracts(commodityType, vol)`:
  - soybean|cbot → `floor((vol × 2.20462) / 5000)`
  - corn|b3 → `floor(vol / 450)`
  - corn|cbot → `floor((vol × 2.3622) / 5000)`
- Preenche `contracts` em cada perna gerada
- Dependency array: `[selectedSnapshot, commodityType, volume]`

O campo `contracts` continua editável — o useEffect apenas preenche o valor inicial.

## O que NÃO muda

Tudo o mais: handleBuildOrder, handleManualSave, editor de pernas, abas "Ordens Existentes" e "Registro Manual".

