/**
 * Normalização de entrada numérica (sem qualquer aritmética financeira).
 * Precisão fixa por campo: 2 casas (R$/saca, basis, descontos) ou 4 casas (câmbio).
 */

export type Precision = 2 | 4;

export interface ParseResult {
  /** Valor numérico, ou null quando o campo está vazio. */
  value: number | null;
  /** Mensagem de erro em português, ou null quando válido. */
  error: string | null;
}

const ALLOWED = /^-?[0-9.,]*$/;

/** Remove caracteres não aceitos enquanto o usuário digita. */
export function sanitizeNumericText(raw: string): string {
  const negative = raw.trim().startsWith('-');
  const body = raw.replace(/[^0-9.,]/g, '');
  return (negative ? '-' : '') + body;
}

export function parseNumericInput(raw: string, precision: Precision): ParseResult {
  const text = raw.trim();
  if (text === '' || text === '-') return { value: null, error: null };
  if (!ALLOWED.test(text)) return { value: null, error: 'Use apenas números, vírgula ou ponto.' };

  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  if (body === '') return { value: null, error: 'Valor inválido.' };

  const lastSep = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'));

  let intPart: string;
  let decPart: string;

  if (lastSep === -1) {
    const digits = body.replace(/\D/g, '');
    if (digits === '') return { value: null, error: 'Valor inválido.' };
    if (precision === 2) {
      if (digits.length <= 2) {
        intPart = '0';
        decPart = digits.padStart(2, '0');
      } else {
        intPart = digits.slice(0, -2);
        decPart = digits.slice(-2);
      }
    } else {
      intPart = digits;
      decPart = '0'.repeat(precision);
    }
  } else {
    intPart = body.slice(0, lastSep).replace(/\D/g, '');
    decPart = body.slice(lastSep + 1).replace(/\D/g, '');
    if (decPart.length > precision) {
      return { value: null, error: `Máximo de ${precision} casas decimais.` };
    }
    if (intPart === '' && decPart === '') return { value: null, error: 'Valor inválido.' };
    intPart = intPart === '' ? '0' : intPart;
    decPart = decPart.padEnd(precision, '0');
  }

  const num = Number(`${intPart}.${decPart || '0'}`);
  if (!Number.isFinite(num)) return { value: null, error: 'Valor inválido.' };
  return { value: negative ? -num : num, error: null };
}

/** Exibição pt-BR com precisão fixa: "11.111,11", "78,4300". */
export function formatNumericDisplay(value: number | null | undefined, precision: Precision): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
