import { useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import type { CalendarEvent } from '@/hooks/useFinancialCalendarData';
import { Navigate } from 'react-big-calendar';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AnnualGridProps {
  date: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; action: string }) => void;
}

function AnnualGrid({ date, events, onSelectSlot }: AnnualGridProps) {
  const year = date.getFullYear();

  const eventsByDay = useMemo(() => {
    const map: Record<string, { inflow: boolean; outflow: boolean }> = {};
    for (const ev of events) {
      const key = ev.start.toISOString().split('T')[0];
      if (!map[key]) map[key] = { inflow: false, outflow: false };
      if (ev.type === 'inflow') map[key].inflow = true;
      else map[key].outflow = true;
    }
    return map;
  }, [events]);

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  const handleDayClick = (day: Date) => {
    onSelectSlot?.({ start: day, end: day, action: 'click' });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
      {months.map((month) => {
        // Collect modifiers for this month
        const inflowDays: Date[] = [];
        const outflowDays: Date[] = [];
        const bothDays: Date[] = [];

        for (const [key, val] of Object.entries(eventsByDay)) {
          const d = new Date(key + 'T12:00:00');
          if (d.getFullYear() === year && d.getMonth() === month.getMonth()) {
            if (val.inflow && val.outflow) bothDays.push(d);
            else if (val.inflow) inflowDays.push(d);
            else if (val.outflow) outflowDays.push(d);
          }
        }

        return (
          <div key={month.getMonth()} className="border rounded-md p-1">
            <DayPicker
              month={month}
              locale={ptBR}
              disableNavigation
              className={cn("p-1 pointer-events-auto text-xs [&_table]:w-full")}
              modifiers={{
                inflow: inflowDays,
                outflow: outflowDays,
                both: bothDays,
              }}
              modifiersStyles={{
                inflow: { backgroundColor: 'rgba(16,185,129,0.25)', borderRadius: '50%' },
                outflow: { backgroundColor: 'rgba(239,68,68,0.25)', borderRadius: '50%' },
                both: {
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 50%, rgba(239,68,68,0.3) 50%)',
                  borderRadius: '50%',
                },
              }}
              onDayClick={handleDayClick}
            />
          </div>
        );
      })}
    </div>
  );
}

// Static navigation methods required by react-big-calendar custom views
AnnualGrid.navigate = (date: Date, action: string) => {
  switch (action) {
    case Navigate.PREVIOUS:
      return new Date(date.getFullYear() - 1, 0, 1);
    case Navigate.NEXT:
      return new Date(date.getFullYear() + 1, 0, 1);
    default:
      return date;
  }
};

AnnualGrid.title = (date: Date) => `${date.getFullYear()}`;

AnnualGrid.range = (date: Date) => {
  return [new Date(date.getFullYear(), 0, 1)];
};

export default AnnualGrid;
