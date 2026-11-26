import { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Lock, Paperclip } from 'lucide-react';
import type { AttendanceStatus, EventCategory, EventSummaryView } from '../types.ts';
import {
  STATUS_META,
  formatCategoryLabel,
  formatEventDateRange,
  formatTargetSummary,
} from './StatusControls.tsx';

export function CalendarView({
  events,
  isStaff,
  locale = 'de',
  onSelectEvent,
  onQuickRsvp,
  onCreateEvent,
}: {
  events: EventSummaryView[];
  isStaff: boolean;
  locale?: string;
  onSelectEvent: (eventId: string) => void;
  onQuickRsvp: (eventId: string, status: AttendanceStatus) => Promise<void>;
  onCreateEvent: () => void;
}) {
  const isEn = locale.startsWith('en');
  const [timeScope, setTimeScope] = useState<'UPCOMING' | 'ALL' | 'PAST'>('UPCOMING');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'ALL'>('ALL');
  const [onlyInvited, setOnlyInvited] = useState(false);

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    return events.filter((ev) => {
      const startMs = Date.parse(ev.startsAt);
      if (timeScope === 'UPCOMING' && Number.isFinite(startMs) && startMs < nowMs - 3600_000) {
        return false;
      }
      if (timeScope === 'PAST' && Number.isFinite(startMs) && startMs >= nowMs) {
        return false;
      }
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) {
        return false;
      }
      if (onlyInvited && !ev.isInvited) {
        return false;
      }
      return true;
    });
  }, [events, timeScope, categoryFilter, onlyInvited]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-sl-surface border border-sl-border">
          {(['UPCOMING', 'ALL', 'PAST'] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setTimeScope(scope)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                timeScope === scope
                  ? 'bg-sl-elevated text-sl-heading'
                  : 'text-sl-muted hover:text-sl-heading'
              }`}
            >
              {scope === 'UPCOMING'
                ? isEn
                  ? 'Upcoming'
                  : 'Anstehend'
                : scope === 'PAST'
                  ? isEn
                    ? 'Past'
                    : 'Vergangen'
                  : isEn
                    ? 'All'
                    : 'Alle'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EventCategory | 'ALL')}
            className="px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-surface text-sl-heading"
          >
            <option value="ALL">{isEn ? 'All Categories' : 'Alle Kategorien'}</option>
            <option value="TRAINING">{isEn ? 'Practice' : 'Training'}</option>
            <option value="MEETING">Meeting</option>
            <option value="GAME">{isEn ? 'Game' : 'Spiel'}</option>
            <option value="OTHER">{isEn ? 'Other' : 'Sonstiges'}</option>
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sl-border bg-sl-surface text-xs text-sl-primary cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={onlyInvited}
              onChange={(e) => setOnlyInvited(e.target.checked)}
            />
            <span>{isEn ? 'Invited only' : 'Nur eigene Einladungen'}</span>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center space-y-3">
          <CalendarDays className="w-8 h-8 text-sl-subtle mx-auto" />
          <p className="text-sm font-medium text-sl-heading">
            {isEn ? 'No events match your filters.' : 'Keine Termine für diesen Filter gefunden.'}
          </p>
          {isStaff && (
            <button
              type="button"
              onClick={onCreateEvent}
              className="px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-medium text-sl-accent-contrast"
            >
              {isEn ? 'Create First Event' : 'Ersten Termin anlegen'}
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-sl-border rounded-xl border border-sl-border bg-sl-surface overflow-hidden">
          {filtered.map((ev) => {
            const myStatus = ev.myResponse?.status ?? null;
            const statusMeta = myStatus ? STATUS_META[myStatus] : null;
            const muted = !ev.isInvited;

            return (
              <li
                key={ev.id}
                className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                  muted ? 'bg-sl-canvas/60 opacity-70' : 'hover:bg-sl-elevated/40'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sl-muted">
                    <span>{formatCategoryLabel(ev.category, locale)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-sl-primary">
                      {formatEventDateRange(ev.startsAt, ev.endsAt, locale)}
                    </span>
                    {ev.location && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{ev.location}</span>
                      </>
                    )}
                    {ev.attachmentCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sl-primary">
                          <Paperclip className="w-3 h-3" />
                          {ev.attachmentCount}
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectEvent(ev.id)}
                    className="text-left text-base font-semibold text-sl-heading hover:text-sl-accent transition-colors block truncate max-w-full"
                  >
                    {ev.title}
                  </button>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sl-muted">
                    <span>{formatTargetSummary(ev, locale)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {ev.counts.present}/{ev.counts.invited}{' '}
                      {isEn ? 'Present' : 'Anwesend'}
                    </span>
                    {muted && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-sl-muted">
                          <Lock className="w-3 h-3" />
                          {isEn ? 'Not invited / Positional' : 'Nicht eingeladen / Nur Ansicht'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ev.isInvited && (
                    <div className="flex items-center gap-1">
                      {(['PRESENT', 'INACTIVE', 'UNCERTAIN', 'ABSENT'] as AttendanceStatus[]).map(
                        (st) => {
                          const m = STATUS_META[st];
                          const active = myStatus === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={!ev.canRespond}
                              onClick={() => onQuickRsvp(ev.id, st)}
                              title={isEn ? m.labelEn : m.labelDe}
                              className={`px-2.5 py-1.5 rounded-md border text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-40 ${
                                active
                                  ? m.activeClass
                                  : 'border-sl-border bg-sl-canvas text-sl-primary hover:border-sl-border-strong'
                              }`}
                            >
                              <m.Icon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {isEn ? m.labelEn : m.labelDe}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  {!ev.isInvited && statusMeta === null && (
                    <span className="text-xs text-sl-subtle px-2">
                      {isEn ? 'Read only' : 'Keine Antwort'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectEvent(ev.id)}
                    className="px-2.5 py-1.5 rounded-md border border-sl-border hover:border-sl-border-strong text-xs text-sl-primary hover:text-sl-heading inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>{isEn ? 'Open' : 'Details'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
