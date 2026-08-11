// Traduz erros do Postgres/PostgREST para mensagens legíveis em português.
type PgLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const CONSTRAINT_LABELS: Array<{ match: RegExp; message: string }> = [
  { match: /cnpj/i, message: 'CNPJ inválido: verifique os dígitos informados.' },
  { match: /_id_(check|format)/i, message: 'Código (ID) fora do formato aceito: use apenas letras maiúsculas e números.' },
  { match: /activity/i, message: 'Atividade inválida: escolha Trading ou Armazenagem.' },
  { match: /commodity/i, message: 'Commodity inválida: escolha Soja ou Milho.' },
  { match: /state|_uf/i, message: 'UF inválida: use duas letras maiúsculas.' },
  { match: /zip|cep/i, message: 'CEP inválido: use 8 dígitos.' },
  { match: /date/i, message: 'Datas inválidas: a data final não pode ser anterior à inicial.' },
];

export function pgErrorMessage(error: unknown): string {
  const e = (error ?? {}) as PgLike;
  const raw = [e.message, e.details, e.hint].filter(Boolean).join(' ');

  if (e.code === '23505') return 'Já existe um registro com esse código (ID).';
  if (e.code === '23503') return 'Registro referenciado não existe ou está em uso por outro cadastro.';
  if (e.code === '42501' || /row-level security/i.test(raw)) {
    return 'Sem permissão para gravar. Esta tela é restrita a administradores.';
  }
  if (e.code === '23502') return 'Campo obrigatório não preenchido.';
  if (e.code === '23514' || /violates check constraint/i.test(raw)) {
    const hit = CONSTRAINT_LABELS.find((c) => c.match.test(raw));
    return hit ? hit.message : 'Valor recusado por uma regra do banco de dados.';
  }
  return e.message || 'Erro ao gravar o registro.';
}

/** Detalhe cru do banco, para exibir como texto de apoio no toast. */
export function pgErrorDetail(error: unknown): string | undefined {
  const e = (error ?? {}) as PgLike;
  const detail = [e.code ? `[${e.code}]` : null, e.message, e.details].filter(Boolean).join(' ');
  return detail || undefined;
}
