## Escopo

Apenas `src/components/GeneratePricingModal.tsx`. Etapas 2 e 3 do plano original descartadas (backend já corrigido e validado em produção: Confresa 0,27 → 3,19; ZCU27 inalterado em 1,17).

## 1. Helper de normalização (topo do arquivo)

Vocabulário aceito pelo motor, canonizado em `'monthly'` / `'yearly'`:

```text
'monthly' | 'am' | 'a.m' | 'a.m.'   -> 'monthly'
'yearly'  | 'aa' | 'a.a' | 'a.a.'   -> 'yearly'
null | string vazia                 -> 'monthly'   (campo ausente herda o default do sistema)
valor preenchido fora do vocabulário -> INVÁLIDO   (sem fallback silencioso)
```

Comparação com `trim()` e case-insensitive. A função devolve `'monthly' | 'yearly' | null`, onde `null` significa "cadastro inválido".

## 2. Validação bloqueante

Dentro do laço de combinações, ao resolver o armazém: se `normalizeInterestPeriod(warehouse.interest_rate_period)` retornar `null`, abortar a geração inteira com `toast.error` em português nomeando armazém e valor:

```text
Período de juros inválido no cadastro de Confresa: 'mensal' — corrija em Configurações
```

Aborta (não apenas pula a combinação), pelo mesmo motivo do bug do motor: fallback ou omissão silenciosa mascara cadastro podre.

## 3. Enviar no payload

No `baseCombo`, logo após `interest_rate`:

```ts
interest_rate_period: <valor normalizado>,
```

Herança igual aos demais custos — combinação sobrescreve armazém; como `pricing_combinations` ainda não tem a coluna, o valor efetivo vem do armazém.

## 4. Persistir em `inputs_json`

No mapeamento de snapshots, após `interest_rate`:

```ts
interest_rate_period: orig.interest_rate_period,
```

Grava o período efetivamente enviado ao motor, não um default reconstruído depois.

## O que NÃO muda

- Resolução de câmbio (spot/NDF por commodity e benchmark).
- Validações bloqueantes de NDF ausente e de dados de mercado com mais de 24h.
- Herança dos demais custos, regras de `payment_date`/`exp_date`, `pricing_method`, qualquer outro fluxo.
- Nenhuma migração de banco: `warehouses.interest_rate_period` já existe e está preenchido com `monthly`.

## Verificação

Type-check do projeto e conferência de que o payload passa a incluir `interest_rate_period: 'monthly'` para as combinações de Confresa.
