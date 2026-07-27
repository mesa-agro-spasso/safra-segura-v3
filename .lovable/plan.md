## Problema confirmado

Em `src/components/GeneratePricingModal.tsx` (linhas 161-168), a resolução de câmbio é:

```
soybean        -> market.ndf_estimated ?? spotRate
corn + cbot    -> spotRate            <-- regra antiga, errada
corn + b3      -> null
```

Consulta ao banco confirma que as linhas `MILHO_CBOT` já têm tudo: `price` em `usd_per_bushel` (ex. ZCU27 = 4.9225), `ndf_estimated` (ZCU27 = 5.5567), `exp_date` e `updated_at`. O spot atual (~5.09) é usado indevidamente, subprecificando.

## Mudanças (arquivo único: `src/components/GeneratePricingModal.tsx`)

**1. Câmbio corn+cbot**
- `exchange_rate = market.ndf_estimated` para `commodity === 'corn' && benchmark === 'cbot'`.
- Sem fallback para spot. Soja e B3 inalterados.

**2. Erro bloqueante — NDF ausente**
- Antes de montar o payload, varrer as combinações corn+cbot ativas e coletar tickers cujo `ndf_estimated` é null/undefined.
- Se houver algum: abortar toda a geração (nenhuma chamada à API) com `toast.error` nomeando os tickers: "NDF indisponível para ZCU27 — atualize os dados na aba Mercado".

**3. Erro bloqueante — dados vencidos (>24h)**
- Para as mesmas linhas `MILHO_CBOT` usadas, comparar `updated_at` com agora; se `> 24h`, abortar a geração com mensagem em português: "Dados de mercado desatualizados para ZCU27 (atualizado há Xh) — atualize a aba Mercado antes de gerar".
- Reuso do helper existente `getHoursAgo` de `@/hooks/useMarketData` (leitura pura, sem cálculo financeiro).

**4. Reflexo na UI do modal**
- Mesma lógica exposta como estado derivado (`useMemo`) para: mostrar bloco de aviso vermelho listando tickers com NDF ausente / dados velhos e desabilitar o botão **Gerar** (`canGenerate`), no mesmo padrão do bloco amarelo já existente de "B3 sem preço".

**5. Verificações (corrigir só se divergente)**
- `benchmark`: já vai explícito no payload via `combo.benchmark` — combinações corn+cbot são cadastradas com `'cbot'`; será confirmado na implementação e, se algum caminho enviar valor implícito, passa a enviar `'cbot'` explicitamente.
- `futures_price`: já usa `market.price` (USD/bushel canônico). `raw_price` não é lido em lugar nenhum do modal — nenhuma mudança prevista.

## Escopo negativo respeitado
- Sem alterações em soja CBOT, milho B3, `MarketBolsa.tsx`, hooks de mercado ou endpoints.
- Nenhum cálculo financeiro novo: o modal apenas lê `market_data` e monta payload.
- Código e comentários em inglês; mensagens de UI em português.
