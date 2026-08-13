import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useCreateProducer, useProducers, useUpdateProducer } from '@/hooks/useProducers';
import { useReferenceRows } from '@/hooks/useReferenceData';
import { pgErrorDetail, pgErrorMessage } from '@/lib/pgError';
import { formatTaxId, isValidTaxId, maskTaxId, normalizeSearch, onlyDigits } from '@/lib/validators';
import type { Producer } from '@/types';

type FormState = {
  full_name: string;
  tax_id: string;
  responsible_name: string;
  phone: string;
  email: string;
  farm_address: string;
  sankhya_code: string;
  notes: string;
  location_ids: string[];
};

const EMPTY: FormState = {
  full_name: '',
  tax_id: '',
  responsible_name: '',
  phone: '',
  email: '',
  farm_address: '',
  sankhya_code: '',
  notes: '',
  location_ids: [],
};

const toForm = (p: Producer): FormState => ({
  full_name: p.full_name ?? '',
  tax_id: formatTaxId(p.tax_id),
  responsible_name: p.responsible_name ?? '',
  phone: p.phone ?? '',
  email: p.email ?? '',
  farm_address: p.farm_address ?? '',
  sankhya_code: p.sankhya_code ?? '',
  notes: p.notes ?? '',
  location_ids: p.location_ids ?? [],
});

const nullIfBlank = (v: string) => {
  const t = v.trim();
  return t === '' ? null : t;
};

export function ProducersTab() {
  const { data: producers = [], isLoading } = useProducers();
  const { data: locations = [] } = useReferenceRows('trading_locations');
  const createProducer = useCreateProducer();
  const updateProducer = useUpdateProducer();

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Producer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const isNew = creating;
  const open = creating || editing !== null;

  const locationName = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locations) map.set(l.id, l.name);
    return map;
  }, [locations]);

  const activeLocations = useMemo(() => locations.filter((l) => l.active !== false), [locations]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return producers.filter((p) => {
      if (!showInactive && p.active === false) return false;
      if (!q) return true;
      const haystack = [p.full_name, p.tax_id, p.responsible_name, p.email, p.sankhya_code]
        .filter(Boolean)
        .map((v) => normalizeSearch(String(v)))
        .join(' ');
      return haystack.includes(q);
    });
  }, [producers, search, showInactive]);

  const openCreate = () => {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (p: Producer) => {
    setForm(toForm(p));
    setCreating(false);
    setEditing(p);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleError = (err: unknown) =>
    toast.error(pgErrorMessage(err), { description: pgErrorDetail(err) });

  const submit = async () => {
    if (!form.full_name.trim()) {
      toast.error('Preencha o campo "Nome".');
      return;
    }
    const digits = onlyDigits(form.tax_id);
    if (digits && !isValidTaxId(digits)) {
      toast.error(
        digits.length === 11 || digits.length === 14
          ? 'Documento inválido: verifique os dígitos informados.'
          : 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).',
      );
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      tax_id: digits === '' ? null : digits,
      responsible_name: nullIfBlank(form.responsible_name),
      phone: nullIfBlank(form.phone),
      email: nullIfBlank(form.email),
      farm_address: nullIfBlank(form.farm_address),
      sankhya_code: nullIfBlank(form.sankhya_code),
      notes: nullIfBlank(form.notes),
      location_ids: form.location_ids,
    };
    try {
      if (isNew) {
        await createProducer.mutateAsync({ ...payload, active: true } as never);
        toast.success('Produtor criado.');
      } else {
        await updateProducer.mutateAsync({ id: editing!.id, ...payload } as never);
        toast.success('Produtor atualizado.');
      }
      close();
    } catch (err) {
      handleError(err);
    }
  };

  const toggleActive = async (p: Producer, active: boolean) => {
    try {
      await updateProducer.mutateAsync({ id: p.id, active } as never);
    } catch (err) {
      handleError(err);
    }
  };

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
          Novo produtor
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Praças</TableHead>
              <TableHead className="w-28">Ativo</TableHead>
              <TableHead className="w-20 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id} className={p.active === false ? 'opacity-60' : undefined}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell className="font-mono text-xs">{formatTaxId(p.tax_id) || '—'}</TableCell>
                <TableCell>{p.responsible_name || '—'}</TableCell>
                <TableCell>{p.phone || '—'}</TableCell>
                <TableCell>{p.email || '—'}</TableCell>
                <TableCell>
                  {(p.location_ids ?? []).length === 0
                    ? '—'
                    : (p.location_ids ?? [])
                        .map((id) => locationName.get(id) ?? `${id} (desconhecida)`)
                        .join(', ')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.active !== false} onCheckedChange={(v) => toggleActive(p, v)} />
                    <Badge variant={p.active === false ? 'outline' : 'default'}>
                      {p.active === false ? 'Inativo' : 'Ativo'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
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
            <DialogTitle>{isNew ? 'Novo produtor' : 'Editar produtor'}</DialogTitle>
            <DialogDescription>
              Produtores não são excluídos — apenas inativados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identidade
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="p-full-name">Nome *</Label>
                  <Input
                    id="p-full-name"
                    value={form.full_name}
                    onChange={(e) => setField('full_name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-tax-id">CPF / CNPJ</Label>
                  <Input
                    id="p-tax-id"
                    value={form.tax_id}
                    onChange={(e) => setField('tax_id', maskTaxId(e.target.value))}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-sankhya">Código Sankhya</Label>
                  <Input
                    id="p-sankhya"
                    value={form.sankhya_code}
                    onChange={(e) => setField('sankhya_code', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contato
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-responsible">Responsável</Label>
                  <Input
                    id="p-responsible"
                    value={form.responsible_name}
                    onChange={(e) => setField('responsible_name', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">Telefone</Label>
                  <Input
                    id="p-phone"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-email">E-mail</Label>
                  <Input
                    id="p-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="p-farm">Endereço da fazenda</Label>
                  <Input
                    id="p-farm"
                    value={form.farm_address}
                    onChange={(e) => setField('farm_address', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Praças
              </p>
              <LocationMultiSelect
                options={activeLocations.map((l) => ({ id: l.id, name: l.name }))}
                value={form.location_ids}
                onChange={(v) => setField('location_ids', v)}
                nameOf={(id) => locationName.get(id)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Outros
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="p-notes">Observações</Label>
                <Textarea
                  id="p-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={createProducer.isPending || updateProducer.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LocationMultiSelect({
  options,
  value,
  onChange,
  nameOf,
}: {
  options: { id: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  nameOf: (id: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-normal">
            {value.length === 0 ? 'Selecionar praças' : `${value.length} praça(s) selecionada(s)`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command
            filter={(itemValue, search) =>
              normalizeSearch(itemValue).includes(normalizeSearch(search)) ? 1 : 0
            }
          >
            <CommandInput placeholder="Buscar praça…" />
            <CommandList>
              <CommandEmpty>Nenhuma praça encontrada.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => toggle(o.id)}>
                    <Check
                      className={`mr-2 h-4 w-4 ${value.includes(o.id) ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1">
              {nameOf(id) ?? `${id} (desconhecida)`}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== id))}
                aria-label="Remover praça"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
