import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface WarehouseOption {
  id: string;
  display_name: string;
  inactive?: boolean;
}

interface Props {
  options: WarehouseOption[];
  /** null / vazio = Sede (acesso a todas as unidades). */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Seleção de unidades: "Sede" (nenhuma unidade = acesso total) ou N armazéns.
 * Sede é mutuamente exclusiva com a seleção de unidades.
 * Unidades inativas presentes no valor continuam listadas e selecionadas até
 * que o usuário as remova explicitamente.
 */
export function WarehouseMultiSelect({ options, value, onChange, disabled, className }: Props) {
  const isSede = value.length === 0;

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className={cn('rounded-md border border-border', className)}>
      <label
        className={cn(
          'flex items-center gap-2 border-b border-border px-3 py-2 text-sm',
          disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50',
        )}
      >
        <Checkbox checked={isSede} disabled={disabled} onCheckedChange={() => onChange([])} />
        <span className="font-medium">Sede (acesso a todas as unidades)</span>
      </label>
      <div className="max-h-48 overflow-y-auto">
        {options.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma unidade disponível.</p>
        )}
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm',
              disabled || isSede ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50',
            )}
          >
            <Checkbox
              checked={value.includes(o.id)}
              disabled={disabled}
              onCheckedChange={() => toggle(o.id)}
            />
            <span className="flex-1">{o.display_name}</span>
            {o.inactive && (
              <Badge variant="outline" className="text-[10px]">inativo</Badge>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Rótulo textual das unidades de um usuário. */
export function warehousesLabel(
  ids: string[] | null | undefined,
  nameById: Record<string, string>,
): string {
  if (!ids || ids.length === 0) return 'Sede';
  return ids.map((id) => nameById[id] ?? id).join(' · ');
}
