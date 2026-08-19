import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { NumericInput } from '@/components/ui/numeric-input';
import { ApiError } from '@/lib/api';
import { addBusinessSafeDays, addDaysISO, useCreateQuote } from '@/hooks/usePhysicalPrices';
import type { TradingLocationLite } from '@/hooks/useMyLocations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: TradingLocationLite[];
  defaultLocationId?: string;
  defaultCommodity?: 'soybean' | 'corn';
  defaultDate?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function PhysicalQuoteDialog({
  open, onOpenChange, locations, defaultLocationId, defaultCommodity, defaultDate,
}: Props) {
  const create = useCreateQuote();

  const [locationId, setLocationId] = useState(defaultLocationId ?? '');
  const [commodity, setCommodity] = useState<'soybean' | 'corn'>(defaultCommodity ?? 'soybean');
  const [referenceDate, setReferenceDate] = useState(defaultDate ?? todayISO());
  const [buyer, setBuyer] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [priceValid, setPriceValid] = useState(true);
  const [paymentDate, setPaymentDate] = useState(defaultDate ?? todayISO());
  const [notes, setNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{ location?: string; buyer?: string; price?: string; payment?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocationId(defaultLocationId ?? locations[0]?.id ?? '');
    setCommodity(defaultCommodity ?? 'soybean');
    const d = defaultDate ?? todayISO();
    setReferenceDate(d);
    setPaymentDate(d);
    setBuyer('');
    setPrice(null);
    setPriceValid(true);
    setNotes('');
    setFieldErrors({});
    setFormError(null);
  }, [open, defaultLocationId, defaultCommodity, defaultDate, locations]);

  const handleSubmit = async () => {
    const errs: typeof fieldErrors = {};
    if (!locationId) errs.location = 'Selecione a praça.';
    if (!buyer.trim()) errs.buyer = 'Informe o comprador.';
    if (price === null) errs.price = 'Informe o preço.';
    if (paymentDate < referenceDate) errs.payment = 'A data de pagamento não pode ser anterior à data de referência.';
    setFieldErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length > 0) return;

    try {
      await create.mutateAsync({
        location_id: locationId,
        commodity,
        reference_date: referenceDate,
        buyer: buyer.trim(),
        payment_date: paymentDate,
        price_brl_per_sack: price as number,
        incoterm: 'FOB',
        notes: notes.trim() || null,
      });
      toast.success('Cotação registrada. O valor presente será calculado em instantes.');
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar a cotação.';
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 422) {
        // Validação de negócio da API (ex.: preço fora da banda). Não é falha do app.
        setFieldErrors((prev) => ({ ...prev, price: message }));
        setFormError(message);
        toast.error('Cotação recusada pela validação de preço.', { description: message });
      } else {
        setFormError(message);
        toast.error(message);
      }
    }

  };

  const canSubmit = priceValid && !create.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar cotação física</DialogTitle>
          <DialogDescription>
            Uma cotação por comprador e prazo de pagamento. O valor presente é calculado pela API.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>Preços PF ou de cooperativa não devem ser lançados.</span>
        </div>

        {formError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Praça</Label>
            <Select value={locationId} onValueChange={(v) => { setLocationId(v); setFieldErrors((p) => ({ ...p, location: undefined })); }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.location && <p className="text-xs text-destructive">{fieldErrors.location}</p>}
          </div>
          <div className="space-y-1">
            <Label>Commodity</Label>
            <Select value={commodity} onValueChange={(v) => setCommodity(v as 'soybean' | 'corn')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="soybean">Soja</SelectItem>
                <SelectItem value="corn">Milho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data de referência</Label>
            <DateInput
              pickerOnly
              value={referenceDate}
              onChange={(v) => { setReferenceDate(v); if (paymentDate < v) setPaymentDate(v); }}
            />
          </div>
          <div className="space-y-1">
            <Label>Comprador</Label>
            <Input
              value={buyer}
              onChange={(e) => { setBuyer(e.target.value); setFieldErrors((p) => ({ ...p, buyer: undefined })); }}
              placeholder="Nome do comprador"
            />
            {fieldErrors.buyer && <p className="text-xs text-destructive">{fieldErrors.buyer}</p>}
          </div>
          <div className="space-y-1">
            <Label>Preço (R$/sc)</Label>
            <NumericInput
              precision={2}
              value={price}
              onChange={(v) => { setPrice(v); setFieldErrors((p) => ({ ...p, price: undefined })); }}
              onValidityChange={setPriceValid}
              placeholder="0,00"
            />
            {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
          </div>
          <div className="space-y-1">
            <Label>Incoterm</Label>
            <Select value="FOB" onValueChange={() => undefined}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FOB">FOB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Data de pagamento</Label>
            <div className="flex items-center gap-2">
              <DateInput
                pickerOnly
                value={paymentDate}
                onChange={(v) => { setPaymentDate(v); setFieldErrors((p) => ({ ...p, payment: undefined })); }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setPaymentDate(addBusinessSafeDays(referenceDate, 3))}>+3d</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPaymentDate(addDaysISO(referenceDate, 30))}>+30d</Button>
            </div>
            {fieldErrors.payment && <p className="text-xs text-destructive">{fieldErrors.payment}</p>}
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {create.isPending ? 'Salvando...' : 'Salvar cotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
