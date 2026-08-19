import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  digitsOf,
  formatDigitsLive,
  formatNumericDisplay,
  parseNumericInput,
  sanitizeNumericText,
  type Precision,
} from '@/lib/numericInput';

interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  /** Valor numérico atual (null quando vazio). */
  value: number | null | undefined;
  /** Emite o número normalizado; null quando vazio. Só dispara quando válido. */
  onChange: (value: number | null) => void;
  /** Casas decimais fixas do campo. */
  precision: Precision;
  /** Notifica validade para o formulário desabilitar o envio. */
  onValidityChange?: (valid: boolean) => void;
  /** Exibe a mensagem de erro abaixo do campo (padrão: true). */
  showError?: boolean;
}

/**
 * Entrada numérica com precisão fixa e formatação ao vivo (estilo app de banco).
 * Apenas normalização de digitação — nenhum cálculo: o valor sai como número
 * simples para o payload.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, precision, onValidityChange, showError = true, className, ...rest }, ref) => {
    const [text, setText] = React.useState<string>(formatNumericDisplay(value ?? null, precision));
    const [error, setError] = React.useState<string | null>(null);
    const [focused, setFocused] = React.useState(false);
    /** Modo legado: o usuário digitou separador ou colou um texto. */
    const [manual, setManual] = React.useState(false);

    React.useEffect(() => {
      if (!focused) {
        setText(formatNumericDisplay(value ?? null, precision));
        setError(null);
        setManual(false);
        onValidityChange?.(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, precision, focused]);

    const applyLegacy = (raw: string) => {
      const next = sanitizeNumericText(raw);
      setText(next);
      const { value: parsed, error: err } = parseNumericInput(next, precision);
      setError(err);
      onValidityChange?.(!err);
      if (!err) onChange(parsed);
    };

    const applyLive = (digits: string) => {
      const { text: nextText, value: nextValue } = formatDigitsLive(digits, precision);
      setText(nextText);
      setError(null);
      onValidityChange?.(true);
      onChange(nextValue);
    };

    const handleChange = (raw: string) => {
      if (manual) {
        applyLegacy(raw);
        return;
      }

      const prevDigits = digitsOf(text);
      const nextDigits = digitsOf(raw);
      const singleEdit = Math.abs(raw.length - text.length) <= 1;

      if (singleEdit && raw.length < text.length) {
        // Deleção: se apagou um separador, remove o último dígito assim mesmo.
        applyLive(nextDigits.length < prevDigits.length ? nextDigits : prevDigits.slice(0, -1));
        return;
      }
      if (singleEdit && nextDigits.length > prevDigits.length) {
        applyLive(nextDigits);
        return;
      }

      // Separador digitado ou colagem: comportamento clássico até sair do campo.
      setManual(true);
      applyLegacy(raw);
    };

    return (
      <div className="w-full">
        <Input
          ref={ref}
          value={text}
          inputMode="decimal"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setManual(false);
            const { value: parsed, error: err } = parseNumericInput(text, precision);
            if (!err) {
              setText(formatNumericDisplay(parsed, precision));
              onChange(parsed);
            }
          }}
          onChange={(e) => handleChange(e.target.value)}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          {...rest}
        />
        {showError && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
NumericInput.displayName = 'NumericInput';
