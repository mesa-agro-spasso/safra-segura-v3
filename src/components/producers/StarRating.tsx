import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readOnly = false, size = 16 }: StarRatingProps) {
  const interactive = !readOnly && !!onChange;
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3].map((n) => {
        const filled = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            tabIndex={interactive ? 0 : -1}
            onClick={() => {
              if (!interactive) return;
              onChange!(value === n ? null : n);
            }}
            className={cn(
              'p-0.5 leading-none rounded transition-transform',
              interactive && 'cursor-pointer hover:scale-125',
              !interactive && 'cursor-default',
            )}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={cn(
                'transition-colors',
                filled ? 'fill-primary text-primary' : 'text-muted-foreground',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
