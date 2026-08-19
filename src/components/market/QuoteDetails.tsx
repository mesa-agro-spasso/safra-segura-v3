import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteQuote, useQuoteAuthors, type PhysicalQuote } from '@/hooks/usePhysicalPrices';

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const fmtBRL = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Exclusão de cotação (soft delete no backend), com confirmação. */
export function DeleteQuoteButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteQuote();

  const confirm = async () => {
    try {
      await del.mutateAsync(id);
      toast.success('Cotação excluída');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir a cotação');
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        aria-label="Excluir cotação"
        onClick={() => setOpen(true)}
        disabled={del.isPending}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta cotação?</AlertDialogTitle>
          <AlertDialogDescription>
            A cotação sai das telas, mas fica preservada e auditada. A série diária é refeita pela API.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface Props {
  quotes: PhysicalQuote[];
  isLoading?: boolean;
  emptyLabel?: string;
  canDelete?: boolean;
}

/** Detalhamento das cotações: comprador, prazo, nominal, VP, incoterm, notas e autor. */
export function QuoteDetailsTable({ quotes, isLoading, emptyLabel, canDelete = true }: Props) {
  const { data: authors = {} } = useQuoteAuthors(quotes.map((q) => q.created_by));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando cotações…</p>;
  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? 'Nenhuma cotação registrada.'}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Comprador</TableHead>
          <TableHead className="text-center">Pagamento</TableHead>
          <TableHead className="text-right">Nominal (R$/sc)</TableHead>
          <TableHead className="text-right">Valor presente (R$/sc)</TableHead>
          <TableHead className="text-center">Incoterm</TableHead>
          <TableHead>Notas</TableHead>
          <TableHead>Registrado por</TableHead>
          {canDelete && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.map((q) => (
          <TableRow key={q.id}>
            <TableCell className="font-medium">{q.buyer}</TableCell>
            <TableCell className="text-center">{fmtDate(q.payment_date)}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtBRL(q.price_brl_per_sack)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {q.present_value_brl == null
                ? <Badge variant="outline" className="text-[10px] font-normal">calculando</Badge>
                : fmtBRL(q.present_value_brl)}
            </TableCell>
            <TableCell className="text-center">{q.incoterm}</TableCell>
            <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={q.notes ?? ''}>
              {q.notes || '—'}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {(q.created_by && authors[q.created_by]) || '—'}
            </TableCell>
            {canDelete && <TableCell className="text-right"><DeleteQuoteButton id={q.id} /></TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
