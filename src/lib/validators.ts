// Validações espelhando as constraints do banco. Nenhum cálculo de negócio.

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatCNPJ(value?: string | null): string {
  if (!value) return '';
  const d = onlyDigits(value);
  return d.length === 14 ? maskCNPJ(d) : value;
}

/** Espelha public.is_valid_cnpj: 14 dígitos, não repetidos, dígitos verificadores corretos. */
export function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv = (weights: number[], len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const r = 11 - (sum % 11);
    return r >= 10 ? 0 : r;
  };

  return Number(d[12]) === dv(w1, 12) && Number(d[13]) === dv(w2, 13);
}

export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatCEP(value?: string | null): string {
  if (!value) return '';
  const d = onlyDigits(value);
  return d.length === 8 ? maskCEP(d) : value;
}

export const isValidCEP = (v: string) => onlyDigits(v).length === 8;

export const maskUF = (v: string) => v.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2);
export const isValidUF = (v: string) => /^[A-Z]{2}$/.test(v);

/** id textual: apenas A-Z e 0-9, dentro do intervalo de tamanho da entidade. */
export const maskEntityId = (v: string, max: number) =>
  v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, max);

export const isValidEntityId = (v: string, min: number, max: number) =>
  new RegExp(`^[A-Z0-9]{${min},${max}}$`).test(v);
