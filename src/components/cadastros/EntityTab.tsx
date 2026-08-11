import { useMemo, useState } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  useCreateReferenceRow,
  useReferenceRows,
  useUpdateReferenceRow,
  type ReferenceTable,
} from '@/hooks/useReferenceData';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import {
  isValidCEP,
  isValidCNPJ,
  isValidEntityId,
  isValidUF,
  maskCEP,
  maskCNPJ,
  maskEntityId,
  maskUF,
  onlyDigits,
} from '@/lib/validators';
import type { EntityConfig, FieldConfig } from './entityConfigs';

type Row = Record<string, unknown>;
type FormState = Record<string, string>;

const emptyForm = (config: EntityConfig): FormState => {
  const form: FormState = { id: '' };
  for (const f of config.fields) form[f.key] = '';
  return form;
};

const rowToForm = (config: EntityConfig, row: Row): FormState => {
  const form: FormState = { id: String(row.id ?? '') };
  for (const f of config.fields) {
    const v = row[f.key];
    if (v == null) form[f.key] = '';
    else if (f.type === 'cnpj') form[f.key] = maskCNPJ(String(v));
    else if (f.type === 'cep') form[f.key] = maskCEP(String(v));
    else form[f.key] = String(v);
  }
  return form;
};

function validate(config: EntityConfig, form: FormState, isNew: boolean): string | null {
  if (isNew && !isValidEntityId(form.id, config.idMin, config.idMax)) {
    return `${config.idLabel} deve ter de ${config.idMin} a ${config.idMax} caracteres, apenas letras maiúsculas e números.`;
  }
  for (const f of config.fields) {
    const v = (form[f.key] ?? '').trim();
    if (f.required && !v) return `Preencha o campo "${f.label}".`;
    if (!v) continue;
    if (f.type === 'cnpj' && !isValidCNPJ(v)) return 'CNPJ inválido: verifique os dígitos informados.';
    if (f.type === 'cep' && !isValidCEP(v)) return 'CEP deve ter 8 dígitos.';
    if (f.type === 'uf' && !isValidUF(v)) return 'UF deve ter duas letras maiúsculas.';
    if (f.type === 'number' && Number.isNaN(Number(v.replace(',', '.')))) return `Valor inválido em "${f.label}".`;
  }
  if (config.table === 'harvests' && form.start_date && form.end_date && form.end_date < form.start_date) {
    return 'A data final não pode ser anterior à data inicial.';
  }
  return null;
}

function formToPayload(config: EntityConfig, form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of config.fields) {
    const raw = (form[f.key] ?? '').trim();
    if (f.type === 'number') payload[f.key] = raw === '' ? null : Number(raw.replace(',', '.'));
    else if (f.type === 'cnpj' || f.type === 'cep') payload[f.key] = raw === '' ? null : onlyDigits(raw);
    else payload[f.key] = raw === '' ? null : raw;
  }
  return payload;
}

export function EntityTab({ config }: { config: EntityConfig }) {
  const { data: rows = [], isLoading } = useReferenceRows(config.table as ReferenceTable);
  const createRow = useCreateReferenceRow(config.table as ReferenceTable);
  const updateRow = useUpdateReferenceRow(config.table as ReferenceTable);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(config));

  const isNew = creating;
  const open = creating || editing !== null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows as unknown as Row[]).filter((r) => {
      if (!showInactive && r.active === false) return false;
      if (!q) return true;
      return config.searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, showInactive, config.searchKeys]);

  const openCreate = () => {
    setForm(emptyForm(config));
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: Row) => {
    setForm(rowToForm(config, row));
    setCreating(false);
    setEditing(row);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleError = (err: unknown) =>
    toast.error(pgErrorMessage(err), { description: pgErrorDetail(err) });

  const submit = async () => {
    const problem = validate(config, form, isNew);
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload = formToPayload(config, form);
    try {
      if (isNew) {
        await createRow.mutateAsync({ ...payload, id: form.id, active: true } as never);
        toast.success('Registro criado.');
      } else {
        await updateRow.mutateAsync({ id: String(editing?.id), patch: payload as never });
        toast.success('Registro atualizado.');
      }
      close();
    } catch (err) {
      handleError(err);
    }
  };

  const toggleActive = async (row: Row, active: boolean) => {
    try {
      await updateRow.mutateAsync({ id: String(row.id), patch: { active } as never });
    } catch (err) {
      handleError(err);
    }
  };

  const sections = useMemo(() => {
    const map = new Map<string, FieldConfig[]>();
    for (const f of config.fields) {
      const key = f.section ?? 'Dados';
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()];
  }, [config.fields]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Mostrar inativos
        </label>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova {config.singular}
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {config.columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead className="w-28">Ativo</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={config.columns.length + 2} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={config.columns.length + 2} className="text-muted-foreground">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={String(row.id)} className={row.active === false ? 'opacity-60' : undefined}>
                {config.columns.map((c) => (
                  <TableCell key={c.key} className={c.key === 'id' ? 'font-mono text-xs' : undefined}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.active !== false}
                      onCheckedChange={(v) => toggleActive(row, v)}
                    />
                    <Badge variant={row.active === false ? 'outline' : 'default'}>
                      {row.active === false ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew ? `Nova ${config.singular}` : `Editar ${config.singular}`}
            </DialogTitle>
            <DialogDescription>
              O código (ID) é definido na criação e não pode ser alterado depois.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="entity-id">{config.idLabel} *</Label>
                <Input
                  id="entity-id"
                  value={form.id}
                  disabled={!isNew}
                  className="font-mono"
                  onChange={(e) => setField('id', maskEntityId(e.target.value, config.idMax))}
                  placeholder={`${config.idMin}–${config.idMax} caracteres (A–Z, 0–9)`}
                />
              </div>
            </div>

            {sections.map(([section, fields]) => (
              <div key={section} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.map((f) => (
                    <div
                      key={f.key}
                      className={`space-y-1.5 ${f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}`}
                    >
                      <Label htmlFor={`f-${f.key}`}>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </Label>
                      <FieldInput
                        field={f}
                        value={form[f.key] ?? ''}
                        onChange={(v) => setField(f.key, v)}
                      />
                      {f.note && <p className="text-[11px] text-muted-foreground/70">{f.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createRow.isPending || updateRow.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `f-${field.key}`;

  if (field.type === 'select') {
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === 'textarea') {
    return <Textarea id={id} value={value} rows={3} onChange={(e) => onChange(e.target.value)} />;
  }

  if (field.type === 'date') {
    return <DateInput id={id} value={value} onChange={onChange} />;
  }

  const transform =
    field.type === 'cnpj'
      ? maskCNPJ
      : field.type === 'cep'
        ? maskCEP
        : field.type === 'uf'
          ? maskUF
          : (v: string) => v;

  return (
    <Input
      id={id}
      value={value}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      type={field.type === 'email' ? 'email' : 'text'}
      onChange={(e) => onChange(transform(e.target.value))}
    />
  );
}
