import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteQuote, useQuoteAuthors, type PhysicalQuote } from '@/hooks/usePhysicalPrices';

const fmtDate = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-');
const fmtBRL = (v: number | null | undefined) =>
  v == null ? '-' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Botão com ícone colorido; exibe rótulo textual quando `showLabel`. */
export function ActionIconButton({
  icon, label, tone, onClick, disabled, showLabel,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'create' | 'edit' | 'delete';
  onClick: () => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const toneClass =
    tone === 'create'
      ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
      : tone === 'edit'
        ? 'text-amber-600 hover:text-amber-700 dark:text-amber-400'
        : 'text-destructive hover:text-destructive';

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'sm' : 'icon'}
      className={showLabel ? `h-7 gap-1.5 px-2 text-xs ${toneClass}` : `h-7 w-7 ${toneClass}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </Button>
  );

  if (showLabel) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Exclusão de cotação (soft delete no backend), com confirmação. */
export function DeleteQuoteButton({
  id, showLabel, disabled,
}: { id: string | null | undefined; showLabel?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteQuote();

  const confirm = async () => {
    if (!id) return;
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
      <ActionIconButton
        icon={<Trash2 className="h-3.5 w-3.5" />}
        label="Excluir cotação"
        tone="delete"
        showLabel={showLabel}
        disabled={disabled || !id || del.isPending}
        onClick={() => setOpen(true)}
      />
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

/** Trio de ações: nova, editar e excluir cotação. */
export function QuoteActions({
  onCreate, onEdit, deleteId, showLabels, canEdit = true,
}: {
  onCreate?: () => void;
  onEdit?: () => void;
  deleteId?: string | null;
  showLabels?: boolean;
  canEdit?: boolean;
}) {
  return (
    <div className={showLabels ? 'flex flex-wrap items-center gap-2' : 'flex items-center justify-end gap-0.5'}>
      {onCreate && (
        <ActionIconButton
          icon={<Plus className="h-3.5 w-3.5" />}
          label="Nova cotação"
          tone="create"
          showLabel={showLabels}
          onClick={onCreate}
        />
      )}
      {onEdit && (
        <ActionIconButton
          icon={<Pencil className="h-3.5 w-3.5" />}
          label="Editar cotação"
          tone="edit"
          showLabel={showLabels}
          disabled={!canEdit}
          onClick={onEdit}
        />
      )}
      <DeleteQuoteButton id={deleteId} showLabel={showLabels} />
    </div>
  );
}

interface Props {
  quotes: PhysicalQuote[];
  isLoading?: boolean;
  emptyLabel?: string;
  canDelete?: boolean;
  onEdit?: (quote: PhysicalQuote) => void;
}

/** Detalhamento das cotações: comprador, prazo, nominal, VP, incoterm, notas e autor. */
export function QuoteDetailsTable({ quotes, isLoading, emptyLabel, canDelete = true, onEdit }: Props) {
  const { data: authors = {} } = useQuoteAuthors(quotes.map((q) => q.created_by));

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando cotações…</p>;
  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel ?? 'Nenhuma cotação registrada.'}</p>;
  }

  const showActions = canDelete || !!onEdit;

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
          {showActions && <TableHead className="text-right">Ações</TableHead>}
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
            {showActions && (
              <TableCell>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {onEdit && (
                    <ActionIconButton
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Editar cotação"
                      tone="edit"
                      showLabel
                      onClick={() => onEdit(q)}
                    />
                  )}
                  {canDelete && <DeleteQuoteButton id={q.id} showLabel />}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
