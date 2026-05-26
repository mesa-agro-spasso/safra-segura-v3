import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateInputProps {
  /** ISO yyyy-MM-dd string (or null/undefined/empty for unset) */
  value?: string | null;
  /** Emits ISO yyyy-MM-dd string, or '' when cleared */
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  placeholder?: string;
}

const ISO = 'yyyy-MM-dd';
const BR = 'dd/MM/yyyy';

const isoToBr = (v?: string | null) => {
  if (!v) return '';
  const d = parse(v, ISO, new Date());
  return isValid(d) ? format(d, BR) : '';
};

const maskBr = (s: string) => {
  const d = s.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, disabled, required, id, placeholder = 'dd/mm/aaaa' }, ref) => {
    const [text, setText] = React.useState<string>(isoToBr(value));
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
      setText(isoToBr(value));
    }, [value]);

    const commit = (raw: string) => {
      if (!raw) {
        if (value) onChange('');
        return;
      }
      const d = parse(raw, BR, new Date());
      if (isValid(d) && raw.length === 10) {
        const iso = format(d, ISO);
        onChange(iso);
        setText(format(d, BR));
      } else {
        // revert to last valid
        setText(isoToBr(value));
      }
    };

    const selected = value ? parse(value, ISO, new Date()) : undefined;
    const validSelected = selected && isValid(selected) ? selected : undefined;

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          value={text}
          onChange={(e) => setText(maskBr(e.target.value))}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          inputMode="numeric"
          className={cn('pr-9', className)}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              tabIndex={-1}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent"
              aria-label="Abrir calendário"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={validSelected}
              defaultMonth={validSelected}
              onSelect={(d) => {
                if (d) {
                  onChange(format(d, ISO));
                  setText(format(d, BR));
                } else {
                  onChange('');
                  setText('');
                }
                setOpen(false);
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInput.displayName = 'DateInput';
