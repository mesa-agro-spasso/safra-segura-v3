import { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useFinancialCalendarData, type CalendarEvent } from '@/hooks/useFinancialCalendarData';
import AnnualGrid from './AnnualGrid';
import DayDetailPanel from './DayDetailPanel';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const messages = {
  today: 'Hoje',
  previous: 'Anterior',
  next: 'Próximo',
  month: 'Mês',
  week: 'Semana',
  day: 'Dia',
  agenda: 'Agenda',
  year: 'Ano',
  date: 'Data',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Nenhum evento neste período.',
};

export default function FinancialCalendar() {
  const { data: events = [], isLoading } = useFinancialCalendarData();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const eventPropGetter = useCallback((event: CalendarEvent) => ({
    style: {
      backgroundColor: event.type === 'inflow' ? '#10b981' : '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '0.75rem',
    },
  }), []);

  const handleSelectSlot = useCallback((slotInfo: { start: Date }) => {
    setSelectedDate(slotInfo.start);
    setPanelOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedDate(event.start);
    setPanelOpen(true);
  }, []);

  const panelEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = selectedDate.toISOString().split('T')[0];
    return events.filter((e) => e.start.toISOString().split('T')[0] === key);
  }, [selectedDate, events]);

  // Build the year view component with events injected
  const YearView = useMemo(() => {
    const Comp = (props: any) => (
      <AnnualGrid {...props} events={events} onSelectSlot={handleSelectSlot} />
    );
    Comp.navigate = AnnualGrid.navigate;
    Comp.title = AnnualGrid.title;
    Comp.range = AnnualGrid.range;
    return Comp;
  }, [events, handleSelectSlot]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Carregando calendário…</p>;
  }

  return (
    <div className="financial-calendar">
      <style>{`
        .financial-calendar .rbc-calendar {
          min-height: 600px;
        }
        .financial-calendar .rbc-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .financial-calendar .rbc-toolbar button {
          font-size: 0.85rem;
        }
        .financial-calendar .rbc-event {
          padding: 1px 4px;
        }
        /* legend */
        .cal-legend {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
        }
        .cal-legend span::before {
          content: '';
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 4px;
          vertical-align: middle;
        }
        .cal-legend .leg-out::before { background: #ef4444; }
        .cal-legend .leg-in::before { background: #10b981; }
      `}</style>

      <div className="cal-legend">
        <span className="leg-out">Saída (pagamento)</span>
        <span className="leg-in">Entrada (venda)</span>
      </div>

      <Calendar<CalendarEvent>
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={{
          month: true,
          week: true,
          agenda: true,
          year: YearView as any,
        }}
        defaultView="month"
        messages={messages}
        culture="pt-BR"
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventPropGetter}
        style={{ height: 620 }}
        popup
      />

      <DayDetailPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        date={selectedDate}
        events={panelEvents}
      />
    </div>
  );
}
