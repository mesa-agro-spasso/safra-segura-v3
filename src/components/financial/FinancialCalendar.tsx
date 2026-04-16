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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<any>('month');

  const eventPropGetter = useCallback((event: CalendarEvent) => ({
    style: {
      backgroundColor: event.type === 'inflow' ? 'hsl(160 70% 40%)' : 'hsl(0 72% 55%)',
      color: 'hsl(0 0% 100%)',
      border: 'none',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 500,
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

  // Year navigation handlers
  const goToPreviousYear = () => setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
  const goToNextYear = () => setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
  const goToCurrentYear = () => setCurrentDate(new Date());

  return (
    <div className="financial-calendar">
      <style>{`
        .financial-calendar .rbc-calendar {
          min-height: 600px;
          background: hsl(var(--card));
          border-radius: 0.5rem;
          padding: 0.75rem;
          color: hsl(var(--foreground));
        }
        .financial-calendar .rbc-toolbar {
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          color: hsl(var(--foreground));
        }
        .financial-calendar .rbc-toolbar-label {
          font-weight: 600;
          font-size: 1rem;
          color: hsl(var(--foreground));
        }
        .financial-calendar .rbc-toolbar button {
          font-size: 0.85rem;
          color: hsl(var(--foreground));
          background: hsl(var(--secondary));
          border: 1px solid hsl(var(--border));
          border-radius: 0.375rem;
          padding: 0.35rem 0.75rem;
          transition: background 0.15s;
        }
        .financial-calendar .rbc-toolbar button:hover,
        .financial-calendar .rbc-toolbar button:focus {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
          border-color: hsl(var(--primary));
        }
        .financial-calendar .rbc-toolbar button.rbc-active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
          box-shadow: none;
        }
        .financial-calendar .rbc-month-view,
        .financial-calendar .rbc-time-view,
        .financial-calendar .rbc-agenda-view {
          border-color: hsl(var(--border));
          background: hsl(var(--card));
        }
        .financial-calendar .rbc-header {
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
          border-color: hsl(var(--border));
          padding: 0.5rem 0.25rem;
          font-weight: 500;
          font-size: 0.8rem;
        }
        .financial-calendar .rbc-day-bg,
        .financial-calendar .rbc-month-row,
        .financial-calendar .rbc-time-content,
        .financial-calendar .rbc-time-header-content {
          border-color: hsl(var(--border));
        }
        .financial-calendar .rbc-off-range-bg {
          background: hsl(var(--muted) / 0.4);
        }
        .financial-calendar .rbc-off-range {
          color: hsl(var(--muted-foreground) / 0.5);
        }
        .financial-calendar .rbc-today {
          background: hsl(var(--primary) / 0.15);
        }
        .financial-calendar .rbc-date-cell {
          color: hsl(var(--foreground));
          padding: 0.25rem 0.4rem;
          font-size: 0.8rem;
        }
        .financial-calendar .rbc-button-link {
          color: hsl(var(--foreground));
        }
        .financial-calendar .rbc-show-more {
          color: hsl(var(--primary));
          background: transparent;
          font-weight: 500;
        }
        .financial-calendar .rbc-event {
          padding: 2px 5px;
          box-shadow: 0 1px 2px hsl(0 0% 0% / 0.2);
        }
        .financial-calendar .rbc-event:focus {
          outline: 2px solid hsl(var(--ring));
        }
        .financial-calendar .rbc-agenda-table {
          color: hsl(var(--foreground));
        }
        .financial-calendar .rbc-agenda-table thead > tr > th {
          background: hsl(var(--muted));
          color: hsl(var(--muted-foreground));
          border-color: hsl(var(--border));
        }
        .financial-calendar .rbc-agenda-table tbody > tr > td {
          border-color: hsl(var(--border));
        }
        /* legend */
        .cal-legend {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
          color: hsl(var(--muted-foreground));
        }
        .cal-legend span::before {
          content: '';
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }
        .cal-legend .leg-out::before { background: hsl(0 72% 55%); }
        .cal-legend .leg-in::before { background: hsl(160 70% 40%); }
        /* Year view nav */
        .year-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding: 0.5rem 0.25rem;
        }
        .year-nav-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }
        .year-nav-buttons {
          display: flex;
          gap: 0.5rem;
        }
      `}</style>

      <div className="cal-legend">
        <span className="leg-out">Saída (pagamento)</span>
        <span className="leg-in">Entrada (venda)</span>
      </div>

      {currentView === 'year' && (
        <div className="year-nav">
          <div className="year-nav-buttons">
            <button
              type="button"
              onClick={goToPreviousYear}
              className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              ← Ano anterior
            </button>
            <button
              type="button"
              onClick={goToCurrentYear}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground border border-primary hover:opacity-90 transition-opacity"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={goToNextYear}
              className="px-3 py-1.5 text-sm rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Próximo ano →
            </button>
          </div>
          <div className="year-nav-title">{currentDate.getFullYear()}</div>
        </div>
      )}

      <Calendar<CalendarEvent>
        localizer={localizer}
        events={events}
        date={currentDate}
        onNavigate={(d) => setCurrentDate(d)}
        view={currentView}
        onView={(v) => setCurrentView(v)}
        startAccessor="start"
        endAccessor="end"
        views={
          { month: true, week: true, agenda: true, year: YearView } as any
        }
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
