import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRegistryPending, type PendingRecord } from '@/hooks/useRegistryPending';

const ENTITY_LABELS: Record<string, string> = {
  companies: 'Empresa',
  brokers: 'Corretora',
  warehouses: 'Armazém',
};

const MISSING_FIELD_LABELS: Record<string, string> = {
  cnpj: 'CNPJ',
  state_registration: 'Inscrição estadual',
  sankhya_code: 'Código Sankhya',
  address: 'Endereço',
  client_code: 'Código de cliente',
  location_id: 'Praça',
  trading_company_id: 'Comercializadora',
  storage_company_id: 'Empresa de armazenagem',
  capacity_kg: 'Capacidade',
};

function labelForField(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field;
}

function navigatePath(record: PendingRecord): string {
  if (record.entity === 'warehouses') return '/configuracoes?tab=warehouses';
  return `/cadastros?tab=${record.entity}`;
}

export function PendingTab() {
  const { grouped, isLoading } = useRegistryPending();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
        Carregando pendências…
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-md border border-border p-8 text-center space-y-3">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <p className="font-medium">Nenhuma pendência encontrada</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Todos os cadastros estão completos. Os campos listados nesta aba são apenas recomendados —
          um registro pendente continua plenamente utilizável no sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Campos recomendados ainda vazios. Esses registros continuam utilizáveis; a lista serve apenas
        para acompanhamento.
      </p>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Entidade</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Campos pendentes</TableHead>
              <TableHead className="w-32 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((record) => (
              <TableRow key={`${record.entity}:${record.record_id}`}>
                <TableCell>{ENTITY_LABELS[record.entity] ?? record.entity}</TableCell>
                <TableCell className="font-medium">{record.label}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {record.missing_fields.map((field) => (
                      <Badge key={field} variant="secondary">
                        {labelForField(field)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(navigatePath(record))}
                  >
                    Editar
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
