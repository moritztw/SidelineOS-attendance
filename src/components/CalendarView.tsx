import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  PauseCircle,
  Plus,
  X,
} from 'lucide-react';
import { buildEventDetailUrl, isModifiedLinkClick } from '../services/routing.ts';
import type { AttendanceStatus, EventCategory, EventSummaryView } from '../types.ts';
import { PendingResponsesCard, UpcomingEventsCard } from './SidebarCards.tsx';
import {
  CategoryIconBadge,
  STATUS_META,
  formatEventTimeRange,
  formatTargetSummary,
} from './StatusControls.tsx';

type CalendarMode = 'MONTH' | 'WEEK' | 'YEAR';

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayStart(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function buildMonthCells(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = getMondayStart(firstOfMonth);
  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDayOfWeek = lastOfMonth.getDay();
  const trailingDays = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const totalDays =
    Math.round((lastOfMonth.getTime() - gridStart.getTime()) / 86_400_000) + 1 + trailingDays;
  const cellCount = totalDays <= 35 ? 35 : 42;

  const cells: Date[] = [];
  for (let i = 0; i < cellCount; i += 1) {
    const cell = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push(cell);
  }
  return cells;
}

function buildWeekDays(anchor: Date): Date[] {
  const monday = getMondayStart(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
  });
}

function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / 604_800_000);
}

export function CalendarView({
  events,
  isStaff,
  locale = 'de',
  getEventHref,
  onSelectEvent,
  onCreateEvent,
}: {
  events: EventSummaryView[];
  isStaff: boolean;
  locale?: string;
  getEventHref?: (eventId: string) => string;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
}) {
  const isEn = locale.startsWith('en');
  const loc = isEn ? 'en-GB' : 'de-DE';
  const resolveHref = getEventHref ?? ((id: string) => buildEventDetailUrl(id, { currentTab: 'calendar' }));

  const initialAnchor = useMemo(() => {
    const now = new Date();
    const upcoming = events.find((ev) => Date.parse(ev.endsAt) >= now.getTime() - 1800_000);
    if (upcoming) {
      const parsed = new Date(upcoming.startsAt);
      if (!Number.isNaN(parsed.getTime())) {
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [mode, setMode] = useState<CalendarMode>('MONTH');
  const [anchorDate, setAnchorDate] = useState<Date>(initialAnchor);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'ALL'>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'INVITED'>('ALL');

  const todayKey = toLocalDateKey(new Date());

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      if (scopeFilter === 'INVITED' && !ev.isInvited) return false;
      return true;
    });
  }, [events, categoryFilter, scopeFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventSummaryView[]>();
    for (const ev of filteredEvents) {
      const d = new Date(ev.startsAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = toLocalDateKey(d);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }
    return map;
  }, [filteredEvents]);

  const upcomingEvents = useMemo(() => {
    const nowMs = Date.now();
    return filteredEvents.filter((ev) => Date.parse(ev.endsAt) >= nowMs - 1800_000);
  }, [filteredEvents]);

  const openInvitedEvents = useMemo(() => {
    const nowMs = Date.now();
    return events.filter(
      (ev) => ev.isInvited && ev.myResponse === null && Date.parse(ev.startsAt) >= nowMs
    );
  }, [events]);

  function navigate(step: -1 | 1) {
    setAnchorDate((prev) => {
      if (mode === 'MONTH') {
        return new Date(prev.getFullYear(), prev.getMonth() + step, 1);
      }
      if (mode === 'WEEK') {
        return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + step * 7);
      }
      return new Date(prev.getFullYear() + step, prev.getMonth(), 1);
    });
  }

  function jumpToToday() {
    const now = new Date();
    setAnchorDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const periodHeading = useMemo(() => {
    if (mode === 'YEAR') {
      return String(anchorDate.getFullYear());
    }
    if (mode === 'WEEK') {
      const weekDays = buildWeekDays(anchorDate);
      const kw = getIsoWeekNumber(weekDays[0]);
      const startLabel = weekDays[0].toLocaleDateString(loc, { day: '2-digit', month: '2-digit' });
      const endLabel = weekDays[6].toLocaleDateString(loc, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      return `${isEn ? 'Wk' : 'KW'} ${kw} · ${startLabel} – ${endLabel}`;
    }
    return anchorDate.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  }, [mode, anchorDate, loc, isEn]);

  const weekdayHeaders = isEn
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  const shortWeekdays = isEn ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const monthCells = useMemo(
    () => buildMonthCells(anchorDate.getFullYear(), anchorDate.getMonth()),
    [anchorDate]
  );

  const weekDays = useMemo(() => buildWeekDays(anchorDate), [anchorDate]);

  return (
    <div className="space-y-4">
      {/* Kalender-Kopfzeile */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Links: Titel + Modus-Umschalter + Heute / Navigation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-semibold text-sl-heading whitespace-nowrap">
            {isEn ? 'Calendar' : 'Kalender'}
          </h2>

          <div
            role="group"
            aria-label={isEn ? 'Calendar view mode' : 'Kalenderansicht'}
            className="flex items-center gap-1 p-1 rounded-lg bg-sl-surface border border-sl-border"
          >
            {(
              [
                { id: 'MONTH', labelDe: 'Monat', labelEn: 'Month' },
                { id: 'WEEK', labelDe: 'Woche', labelEn: 'Week' },
                { id: 'YEAR', labelDe: 'Jahr', labelEn: 'Year' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === item.id
                    ? 'bg-sl-elevated text-sl-heading'
                    : 'text-sl-muted hover:text-sl-heading'
                }`}
              >
                {isEn ? item.labelEn : item.labelDe}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={jumpToToday}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-sl-border bg-sl-surface text-sl-primary hover:text-sl-heading hover:border-sl-border-strong transition-colors whitespace-nowrap"
            >
              {isEn ? 'Today' : 'Heute'}
            </button>
            <div className="inline-flex items-center rounded-lg border border-sl-border bg-sl-surface overflow-hidden">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label={isEn ? 'Previous period' : 'Vorheriger Zeitraum'}
                className="p-1.5 text-sl-muted hover:text-sl-heading hover:bg-sl-elevated transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                aria-label={isEn ? 'Next period' : 'Nächster Zeitraum'}
                className="p-1.5 text-sl-muted hover:text-sl-heading hover:bg-sl-elevated border-l border-sl-border transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mitte: Aktueller Monat / Woche / Jahr */}
        <div className="text-base sm:text-lg font-semibold text-sl-heading font-mono tabular-nums">
          {periodHeading}
        </div>

        {/* Rechts: Filter-Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EventCategory | 'ALL')}
            aria-label={isEn ? 'Filter by category' : 'Nach Kategorie filtern'}
            className="px-3 py-1.5 text-xs rounded-lg border border-sl-border bg-sl-surface text-sl-heading"
          >
            <option value="ALL">{isEn ? 'All Events' : 'Alle Termine'}</option>
            <option value="TRAINING">{isEn ? 'Practice' : 'Training'}</option>
            <option value="GAME">{isEn ? 'Game' : 'Spiel'}</option>
            <option value="MEETING">Meeting</option>
            <option value="OTHER">{isEn ? 'Other' : 'Sonstiges'}</option>
          </select>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as 'ALL' | 'INVITED')}
            aria-label={isEn ? 'Filter by invitation' : 'Nach Einladung filtern'}
            className="px-3 py-1.5 text-xs rounded-lg border border-sl-border bg-sl-surface text-sl-heading"
          >
            <option value="ALL">{isEn ? 'All Invitations' : 'Alle Einladungen'}</option>
            <option value="INVITED">{isEn ? 'My Invitations' : 'Eigene Einladungen'}</option>
          </select>
        </div>
      </div>

      {/* Hauptbereich: 2-Spalten (Kalender-Raster + Rechte Sidebar) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <div className="min-w-0">
          {mode === 'MONTH' && (
            <div className="rounded-xl border border-sl-border bg-sl-surface overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-7 border-b border-sl-border bg-sl-elevated/40">
                  {weekdayHeaders.map((dayName) => (
                    <div
                      key={dayName}
                      className="px-2.5 py-2.5 text-center text-xs font-semibold text-sl-primary border-r border-sl-border last:border-r-0"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {monthCells.map((cellDate, idx) => {
                    const key = toLocalDateKey(cellDate);
                    const isCurrentMonth = cellDate.getMonth() === anchorDate.getMonth();
                    const isToday = key === todayKey;
                    const dayEvents = eventsByDate.get(key) ?? [];

                    return (
                      <div
                        key={key}
                        className={`min-h-[122px] p-2 border-b border-r border-sl-border ${
                          (idx + 1) % 7 === 0 ? 'border-r-0' : ''
                        } ${
                          !isCurrentMonth
                            ? 'bg-sl-canvas/70'
                            : isToday
                              ? 'bg-sl-accent/5 ring-1 ring-inset ring-sl-accent/50'
                              : 'bg-sl-surface'
                        }`}
                      >
                        <div className="flex items-center justify-end mb-1.5">
                          <span
                            className={`text-xs font-mono tabular-nums ${
                              isToday
                                ? 'px-1.5 py-0.5 rounded bg-sl-accent text-sl-accent-contrast font-semibold'
                                : isCurrentMonth
                                  ? 'text-sl-primary font-medium'
                                  : 'text-sl-subtle'
                            }`}
                          >
                            {cellDate.getDate()}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <CalendarEventChip
                              key={ev.id}
                              event={ev}
                              href={resolveHref(ev.id)}
                              locale={locale}
                              onSelect={() => onSelectEvent(ev.id)}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAnchorDate(cellDate);
                                setMode('WEEK');
                              }}
                              className="w-full text-left px-1.5 py-0.5 text-[11px] font-medium text-sl-accent hover:underline"
                            >
                              +{dayEvents.length - 3} {isEn ? 'more' : 'weitere'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {mode === 'WEEK' && (
            <div className="rounded-xl border border-sl-border bg-sl-surface overflow-x-auto">
              <div className="min-w-[720px] grid grid-cols-7 divide-x divide-sl-border">
                {weekDays.map((dayDate) => {
                  const key = toLocalDateKey(dayDate);
                  const isToday = key === todayKey;
                  const dayEvents = eventsByDate.get(key) ?? [];

                  return (
                    <div key={key} className="min-h-[420px] flex flex-col">
                      <div
                        className={`px-2.5 py-3 border-b border-sl-border text-center ${
                          isToday ? 'bg-sl-accent/10' : 'bg-sl-elevated/40'
                        }`}
                      >
                        <div className="text-[11px] text-sl-muted">
                          {dayDate.toLocaleDateString(loc, { weekday: 'short' })}
                        </div>
                        <div
                          className={`mt-0.5 text-sm font-mono tabular-nums font-semibold ${
                            isToday ? 'text-sl-accent' : 'text-sl-heading'
                          }`}
                        >
                          {dayDate.toLocaleDateString(loc, { day: '2-digit', month: '2-digit' })}
                        </div>
                      </div>

                      <div className="p-2 space-y-2 flex-1">
                        {dayEvents.length === 0 ? (
                          <p className="text-[11px] text-sl-subtle text-center pt-6">—</p>
                        ) : (
                          dayEvents.map((ev) => (
                            <CalendarEventChip
                              key={ev.id}
                              event={ev}
                              href={resolveHref(ev.id)}
                              locale={locale}
                              detailed
                              onSelect={() => onSelectEvent(ev.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'YEAR' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }, (_, monthIdx) => {
                const year = anchorDate.getFullYear();
                const monthDate = new Date(year, monthIdx, 1);
                const monthTitle = monthDate.toLocaleDateString(loc, { month: 'long' });
                const cells = buildMonthCells(year, monthIdx);
                let monthEventCount = 0;

                for (const c of cells) {
                  if (c.getMonth() === monthIdx) {
                    monthEventCount += (eventsByDate.get(toLocalDateKey(c)) ?? []).length;
                  }
                }

                return (
                  <button
                    key={monthIdx}
                    type="button"
                    onClick={() => {
                      setAnchorDate(new Date(year, monthIdx, 1));
                      setMode('MONTH');
                    }}
                    className="text-left rounded-xl border border-sl-border bg-sl-surface hover:border-sl-border-strong p-3.5 space-y-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-sl-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-sl-heading">{monthTitle}</span>
                      <span className="text-xs font-mono tabular-nums text-sl-muted">
                        {monthEventCount} {isEn ? 'ev.' : 'Term.'}
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                      {shortWeekdays.map((wd) => (
                        <span key={wd} className="text-sl-subtle font-medium">
                          {wd}
                        </span>
                      ))}
                      {cells.map((c) => {
                        const key = toLocalDateKey(c);
                        const inMonth = c.getMonth() === monthIdx;
                        const hasEvents = inMonth && (eventsByDate.get(key)?.length ?? 0) > 0;
                        const isToday = key === todayKey;

                        return (
                          <span
                            key={key}
                            className={`py-0.5 rounded font-mono tabular-nums ${
                              !inMonth
                                ? 'text-sl-subtle/35'
                                : isToday
                                  ? 'bg-sl-accent text-sl-accent-contrast font-semibold'
                                  : hasEvents
                                    ? 'bg-sl-success/20 text-sl-success-text font-semibold'
                                    : 'text-sl-muted'
                            }`}
                          >
                            {c.getDate()}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {events.length === 0 && (
            <div className="mt-4 rounded-xl border border-sl-border bg-sl-surface p-6 text-center space-y-2.5">
              <CalendarDays className="w-7 h-7 text-sl-subtle mx-auto" />
              <p className="text-sm font-medium text-sl-heading">
                {isEn ? 'No events in this season yet.' : 'Noch keine Termine in dieser Saison.'}
              </p>
              {isStaff && (
                <button
                  type="button"
                  onClick={onCreateEvent}
                  className="px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-semibold text-sl-accent-contrast inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Create First Event' : 'Ersten Termin anlegen'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rechte Sidebar: Anstehende Termine + Offene Rückmeldungen */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <UpcomingEventsCard
            events={upcomingEvents}
            locale={locale}
            getEventHref={resolveHref}
            onSelectEvent={onSelectEvent}
            maxItems={4}
          />
          <PendingResponsesCard
            events={openInvitedEvents}
            locale={locale}
            getEventHref={resolveHref}
            onSelectEvent={onSelectEvent}
            maxItems={8}
          />
        </aside>
      </div>
    </div>
  );
}

function CalendarEventChip({
  event,
  href,
  locale,
  detailed = false,
  onSelect,
}: {
  event: EventSummaryView;
  href: string;
  locale: string;
  detailed?: boolean;
  onSelect: () => void;
}) {
  const isEn = locale.startsWith('en');
  const status: AttendanceStatus | null = event.myResponse?.status ?? null;
  const statusMeta = status ? STATUS_META[status] : null;
  const isOpen = event.isInvited && status === null;

  const StatusGlyph =
    status === 'PRESENT'
      ? Check
      : status === 'INACTIVE'
        ? PauseCircle
        : status === 'UNCERTAIN'
          ? HelpCircle
          : status === 'ABSENT'
            ? X
            : AlertCircle;

  return (
    <a
      href={href}
      onClick={(e) => {
        if (isModifiedLinkClick(e)) return;
        e.preventDefault();
        onSelect();
      }}
      className={`block w-full text-left rounded-lg border px-2 py-1.5 transition-colors space-y-1 focus-visible:outline-2 focus-visible:outline-sl-accent ${
        !event.isInvited
          ? 'border-sl-border bg-sl-canvas/60 opacity-75 hover:opacity-100'
          : 'border-sl-border-strong/70 bg-sl-elevated/60 hover:bg-sl-elevated hover:border-sl-accent/60'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <CategoryIconBadge category={event.category} size="xs" />
          <span className="text-xs font-semibold text-sl-heading truncate">{event.title}</span>
        </div>
        {(statusMeta || isOpen) && (
          <StatusGlyph
            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
              statusMeta ? statusMeta.textClass : 'text-sl-warning-text'
            }`}
          />
        )}
      </div>

      <div className="text-[10px] font-mono tabular-nums text-sl-muted truncate">
        {formatEventTimeRange(event.startsAt, event.endsAt, locale)}
      </div>

      {detailed && (
        <div className="text-[10px] text-sl-muted truncate">
          {formatTargetSummary(event, locale)}
        </div>
      )}

      {statusMeta ? (
        <div className={`text-[10px] font-medium truncate ${statusMeta.textClass}`}>
          {isEn ? statusMeta.labelEn : statusMeta.labelDe}
        </div>
      ) : isOpen ? (
        <div className="text-[10px] font-medium text-sl-warning-text truncate">
          {isEn ? 'Response open' : 'Offene Rückmeldung'}
        </div>
      ) : null}
    </a>
  );
}
