import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: number;
}

export function StarRating({ value, onChange, readOnly = false, size = 16 }: StarRatingProps) {
  const stars = [1, 2, 3];
  return (
    <div className="inline-flex items-center gap-0.5">
      {stars.map((n) => {
        const filled = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={(e) => {
              e.stopPropagation();
              if (readOnly || !onChange) return;
              // click same star twice clears
              onChange(value === n ? null : n);
            }}
            className={cn(
              'transition-colors',
              !readOnly && 'cursor-pointer hover:scale-110',
              readOnly && 'cursor-default',
            )}
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          >
            <Star
              size={size}
              className={cn(
                filled ? 'fill-primary text-primary' : 'text-muted-foreground',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
