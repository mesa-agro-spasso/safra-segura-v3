## Lote 2C-2c — Volumes editáveis no Novo Batch + simplificação do modal

Editar **apenas** `src/pages/ArmazensD24.tsx`.

### 1. Estado e derivações de volumes editados (sub-view "new")

Adicionar junto aos estados de Block Trade:
```ts
const [btEditedVolumes, setBtEditedVolumes] = useState<Record<string, number | ''>>({});
```

`useEffect([btProposals])` que reinicializa o mapa com `volume_to_close_sacks` de cada proposal (ou limpa se `btProposals` for null).

Derivações:
```ts
const btTotalEdited = Object.values(btEditedVolumes).reduce((s,v)=>s+(Number(v)||0),0);
const btTotalExpected = btProposals?.total_volume_allocated_sacks ?? 0;
const btVolumeOk = Math.abs(btTotalEdited - btTotalExpected) < 0.01;
```

### 2. `handleBtSaveDraft`

Trocar o INSERT em `warehouse_closing_batches` para usar volumes editados:
- `allocation_snapshot`: map sobre `btProposals.proposals` substituindo `volume_to_close_sacks` por `Number(btEditedVolumes[p.operation_id] ?? p.volume_to_close_sacks)`.
- `total_volume_sacks`: `btTotalEdited`.

### 3. Painel direito da sub-view "new"

Substituir o bloco `{btProposals && (...)}` pela versão especificada:
- Tabela com colunas Operação / Disponível / **A fechar (Input editável)** / MTM usado.
- Indicador de total alocado (verde se `btVolumeOk`, vermelho caso contrário).
- Bloco de warnings preservado.
- **Único botão: "Salvar Rascunho"**, desabilitado se `btSubmitting || !btVolumeOk`.
- Mensagem de ajuda em vermelho quando `!btVolumeOk`.
- Remover completamente o botão "Ajustar e Executar".

### 4. `BlockTradeExecutionModal` — simplificar para 2 etapas

Volumes agora vêm fixos do `batch.allocation_snapshot`; o modal não edita mais volumes.

- Remover do estado interno: `volumes`, `totalEdited`, `volumeOk` e o `useEffect` que populava volumes.
- Manter: `step`, `prices`, `submitting`, `executedSummary`.
- **Etapa 1**: tabela read-only (display_code + volume_to_close_sacks do snapshot) à esquerda; inputs de preço por instrumento à direita. Botão "Revisar →" habilitado quando todos os preços > 0.
- **Etapa 2a (preview)**: usar `p.volume_to_close_sacks` direto do snapshot no cálculo proporcional (em vez de `volumes[p.operation_id]`).
- **`handleExecute`**: idem — `p.volume_to_close_sacks` direto do snapshot.
- **Etapa 2b**: inalterada.

### Checklist de validação

1. Inputs editáveis aparecem na coluna "A fechar".
2. Indicador total atualiza em tempo real, vermelho ao divergir.
3. Verde quando total bate.
4. "Salvar Rascunho" desabilitado enquanto diverge.
5. `allocation_snapshot` no Supabase reflete volumes editados; `total_volume_sacks` correto.
6. Modal de execução não tem inputs de volume — só preços.
7. "Ajustar e Executar" não existe mais no painel "Novo Batch".
