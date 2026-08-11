import type { ReactNode } from 'react';
import type { ReferenceTable } from '@/hooks/useReferenceData';
import { formatCNPJ, formatCEP } from '@/lib/validators';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'cnpj'
  | 'cep'
  | 'uf'
  | 'email';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Nota discreta sob o campo. */
  note?: string;
  section?: string;
  wide?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => ReactNode;
}

export interface EntityConfig {
  table: ReferenceTable;
  label: string;
  singular: string;
  idMin: number;
  idMax: number;
  idLabel: string;
  fields: FieldConfig[];
  columns: ColumnConfig[];
  searchKeys: string[];
}

const text = (v: unknown) => (v == null || v === '' ? '—' : String(v));

export const COMPANIES: EntityConfig = {
  table: 'companies',
  label: 'Empresas',
  singular: 'empresa',
  idMin: 3,
  idMax: 12,
  idLabel: 'Código',
  searchKeys: ['id', 'legal_name', 'trade_name', 'cnpj', 'sankhya_code', 'address_city'],
  fields: [
    { key: 'legal_name', label: 'Razão social', type: 'text', required: true, section: 'Identidade', wide: true },
    { key: 'trade_name', label: 'Nome fantasia', type: 'text', section: 'Identidade' },
    {
      key: 'activity',
      label: 'Atividade',
      type: 'select',
      required: true,
      section: 'Identidade',
      options: [
        { value: 'TRADING', label: 'Trading' },
        { value: 'STORAGE', label: 'Armazenagem' },
      ],
    },
    { key: 'cnpj', label: 'CNPJ', type: 'cnpj', section: 'Identidade' },
    { key: 'state_registration', label: 'Inscrição estadual', type: 'text', section: 'Identidade' },
    { key: 'sankhya_code', label: 'Código Sankhya', type: 'text', section: 'Identidade' },
    { key: 'address_street', label: 'Logradouro', type: 'text', section: 'Endereço', wide: true },
    { key: 'address_number', label: 'Número', type: 'text', section: 'Endereço' },
    { key: 'address_complement', label: 'Complemento', type: 'text', section: 'Endereço' },
    { key: 'address_district', label: 'Bairro', type: 'text', section: 'Endereço' },
    { key: 'address_city', label: 'Cidade', type: 'text', section: 'Endereço' },
    { key: 'address_state', label: 'UF', type: 'uf', section: 'Endereço' },
    { key: 'address_zip', label: 'CEP', type: 'cep', section: 'Endereço' },
    { key: 'notes', label: 'Observações', type: 'textarea', section: 'Outros', wide: true },
  ],
  columns: [
    { key: 'id', label: 'Código' },
    { key: 'legal_name', label: 'Razão social' },
    { key: 'trade_name', label: 'Fantasia', render: (r) => text(r.trade_name) },
    {
      key: 'activity',
      label: 'Atividade',
      render: (r) => (r.activity === 'TRADING' ? 'Trading' : r.activity === 'STORAGE' ? 'Armazenagem' : text(r.activity)),
    },
    { key: 'cnpj', label: 'CNPJ', render: (r) => formatCNPJ(r.cnpj as string) || '—' },
    {
      key: 'address_city',
      label: 'Cidade/UF',
      render: (r) => [r.address_city, r.address_state].filter(Boolean).join('/') || '—',
    },
  ],
};

export const BROKERS: EntityConfig = {
  table: 'brokers',
  label: 'Corretoras',
  singular: 'corretora',
  idMin: 3,
  idMax: 12,
  idLabel: 'Código',
  searchKeys: ['id', 'legal_name', 'trade_name', 'cnpj', 'client_code', 'contact_name', 'contact_email'],
  fields: [
    { key: 'legal_name', label: 'Razão social', type: 'text', required: true, section: 'Identidade', wide: true },
    { key: 'trade_name', label: 'Nome fantasia', type: 'text', section: 'Identidade' },
    { key: 'cnpj', label: 'CNPJ', type: 'cnpj', section: 'Identidade' },
    { key: 'client_code', label: 'Código de cliente', type: 'text', section: 'Identidade' },
    { key: 'contact_name', label: 'Contato', type: 'text', section: 'Contato' },
    { key: 'contact_email', label: 'E-mail', type: 'email', section: 'Contato' },
    { key: 'contact_phone', label: 'Telefone', type: 'text', section: 'Contato' },
    {
      key: 'brokerage_per_contract_cbot',
      label: 'Corretagem por contrato CBOT',
      type: 'number',
      section: 'Corretagem',
      note: 'Sem efeito no sistema hoje — o valor é apenas registrado.',
    },
    {
      key: 'brokerage_per_contract_b3',
      label: 'Corretagem por contrato B3',
      type: 'number',
      section: 'Corretagem',
      note: 'Sem efeito no sistema hoje — o valor é apenas registrado.',
    },
    { key: 'notes', label: 'Observações', type: 'textarea', section: 'Outros', wide: true },
  ],
  columns: [
    { key: 'id', label: 'Código' },
    { key: 'legal_name', label: 'Razão social' },
    { key: 'trade_name', label: 'Fantasia', render: (r) => text(r.trade_name) },
    { key: 'cnpj', label: 'CNPJ', render: (r) => formatCNPJ(r.cnpj as string) || '—' },
    { key: 'client_code', label: 'Cód. cliente', render: (r) => text(r.client_code) },
    { key: 'contact_name', label: 'Contato', render: (r) => text(r.contact_name) },
  ],
};

export const TRADING_LOCATIONS: EntityConfig = {
  table: 'trading_locations',
  label: 'Praças',
  singular: 'praça',
  idMin: 3,
  idMax: 16,
  idLabel: 'Código',
  searchKeys: ['id', 'name', 'city', 'state'],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, section: 'Identidade', wide: true },
    { key: 'city', label: 'Cidade', type: 'text', section: 'Identidade' },
    { key: 'state', label: 'UF', type: 'uf', section: 'Identidade' },
    { key: 'notes', label: 'Observações', type: 'textarea', section: 'Outros', wide: true },
  ],
  columns: [
    { key: 'id', label: 'Código' },
    { key: 'name', label: 'Nome' },
    { key: 'city', label: 'Cidade', render: (r) => text(r.city) },
    { key: 'state', label: 'UF', render: (r) => text(r.state) },
  ],
};

export const HARVESTS: EntityConfig = {
  table: 'harvests',
  label: 'Safras',
  singular: 'safra',
  idMin: 3,
  idMax: 16,
  idLabel: 'Código',
  searchKeys: ['id', 'name', 'commodity'],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, section: 'Identidade', wide: true },
    {
      key: 'commodity',
      label: 'Commodity',
      type: 'select',
      required: true,
      section: 'Identidade',
      options: [
        { value: 'soybean', label: 'Soja' },
        { value: 'corn', label: 'Milho' },
      ],
    },
    { key: 'start_date', label: 'Início', type: 'date', section: 'Período' },
    { key: 'end_date', label: 'Fim', type: 'date', section: 'Período' },
    { key: 'notes', label: 'Observações', type: 'textarea', section: 'Outros', wide: true },
  ],
  columns: [
    { key: 'id', label: 'Código' },
    { key: 'name', label: 'Nome' },
    {
      key: 'commodity',
      label: 'Commodity',
      render: (r) => (r.commodity === 'soybean' ? 'Soja' : r.commodity === 'corn' ? 'Milho' : text(r.commodity)),
    },
    { key: 'start_date', label: 'Início', render: (r) => formatDateBr(r.start_date as string | null) },
    { key: 'end_date', label: 'Fim', render: (r) => formatDateBr(r.end_date as string | null) },
  ],
};

export function formatDateBr(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export const CEP_FORMATTER = formatCEP;

export const ENTITY_CONFIGS: EntityConfig[] = [COMPANIES, BROKERS, TRADING_LOCATIONS, HARVESTS];
