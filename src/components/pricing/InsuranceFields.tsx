import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useInsuranceOptions,
  useLatestOptionQuotes,
  todayISO,
  type Benchmark,
  type Commodity,
} from '@/hooks/useInsuranceOptions';

/**
 * Os três campos de seguro da combinação, em um só lugar.
 * Usado na tela de Configurações e no modal do cockpit — nunca duplicar.
 * Nenhum cálculo: só leitura de cadastro e escrita dos três campos.
 */

export type InsuranceCarryUntil = 'operation_end' | 'grain_reception';

export interface InsuranceValue {
  insurance_option_id?: string | null;
  insurance_coverage_pct?: number | null;
  insurance_carry_until?: InsuranceCarryUntil | null;
}

/** Os três andam juntos ou nenhum. Devolve a mensagem de erro, ou null se está ok. */
export function validateInsuranceTrio(v: InsuranceValue): string | null {
  const filled = [
    v.insurance_option_id != null && v.insurance_option_id !== '',
    v.insurance_coverage_pct != null,
    v.insurance_carry_until != null,
  ].filter(Boolean).length;

  if (filled === 0) return null;
  if (filled < 3) return 'Seguro incompleto: preencha opção, cobertura e carrego — ou remova o seguro';
  const cov = v.insurance_coverage_pct!;
  if (!(cov > 0 && cov <= 1)) return 'Cobertura do seguro deve estar entre 0% e 100%';
  return null;
}

/** Normaliza os três campos para gravação: preenchidos juntos ou nulos juntos. */
export function insurancePatch(v: InsuranceValue): Required<InsuranceValue> {
  const complete =
    v.insurance_option_id != null && v.insurance_option_id !== ''
    && v.insurance_coverage_pct != null
    && v.insurance_carry_until != null;
  return {
    insurance_option_id: complete ? v.insurance_option_id ?? null : null,
    insurance_coverage_pct: complete ? v.insurance_coverage_pct ?? null : null,
    insurance_carry_until: complete ? v.insurance_carry_until ?? null : null,
  };
}

export interface InsuranceFieldsProps {
  value: InsuranceValue;
  commodity: Commodity;
  benchmark: Benchmark;
  onChange: (patch: InsuranceValue) => void;
}

export function InsuranceFields({ value, commodity, benchmark, onChange }: InsuranceFieldsProps) {
  const { data: insuranceOptions } = useInsuranceOptions();
  const { data: latestQuotes } = useLatestOptionQuotes();

  const pairOptions = useMemo(
    () => (insuranceOptions ?? []).filter((o) => o.commodity === commodity && o.benchmark === benchmark),
    [insuranceOptions, commodity, benchmark],
  );

  const selectedQuote = value.insurance_option_id ? latestQuotes?.[value.insurance_option_id] : null;
  const selectedHasToday = selectedQuote?.trade_date === todayISO();

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Opção</Label>
        <Select
          value={value.insurance_option_id ?? ''}
          onValueChange={(v) => onChange({
            ...value,
            insurance_option_id: v,
            insurance_carry_until: value.insurance_carry_until ?? 'operation_end',
          })}
        >
          <SelectTrigger><SelectValue placeholder="Selecione a opção" /></SelectTrigger>
          <SelectContent>
            {pairOptions.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Nenhuma opção ativa para este par
              </div>
            )}
            {pairOptions.map((o) => {
              const quote = latestQuotes?.[o.id];
              const hasToday = quote?.trade_date === todayISO();
              return (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                  {hasToday ? '' : ' — sem cotação hoje'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {value.insurance_option_id && !selectedHasToday && (
          <p className="flex items-start gap-1.5 text-xs text-amber-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sem cotação de hoje — registre o prêmio em Mercado &gt; Opções antes de gerar a tabela.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cobertura (%)</Label>
          <Input
            type="number" step="any" placeholder="ex: 25"
            value={value.insurance_coverage_pct != null ? value.insurance_coverage_pct * 100 : ''}
            onChange={(e) => onChange({
              ...value,
              insurance_coverage_pct: e.target.value === '' ? null : Number(e.target.value) / 100,
            })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Carrego do prêmio</Label>
          <Select
            value={value.insurance_carry_until ?? 'operation_end'}
            onValueChange={(v) => onChange({ ...value, insurance_carry_until: v as InsuranceCarryUntil })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operation_end">Até o término da operação</SelectItem>
              <SelectItem value="grain_reception">Até a recepção do grão</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.insurance_option_id && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-destructive hover:text-destructive"
          onClick={() => onChange({
            ...value,
            insurance_option_id: null,
            insurance_coverage_pct: null,
            insurance_carry_until: null,
          })}
        >
          Remover seguro
        </Button>
      )}
    </div>
  );
}
