import { AlertCircle, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import type { EventSummaryView } from '../types.ts';
import {
  CategoryIconBadge,
  STATUS_META,
  formatEventDateOnly,
} from './StatusControls.tsx';

export function PendingResponsesCard({
  events,
  locale = 'de',
  onSelectEvent,
  maxItems = 25,
}: {
  events: EventSummaryView[];
  locale?: string;
  onSelectEvent: (eventId: string) => void;
  maxItems?: number;
}) {
  const isEn = locale.startsWith('en');
  const visible = events.slice(0, maxItems);

  return (
    <section className="rounded-xl border border-sl-border bg-sl-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <h3 className="text-sm font-semibold text-sl-heading truncate">
            {isEn ? 'Pending Responses' : 'Offene Rückmeldungen'}
          </h3>
          <p className="text-xs text-sl-muted font-mono tabular-nums">
            {events.length === 0
              ? isEn
                ? 'All caught up'
                : 'Alles beantwortet'
              : isEn
                ? `${events.length} open event${events.length === 1 ? '' : 's'}`
                : `${events.length} offene${events.length === 1 ? 'r Termin' : ' Termine'}`}
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-sl-elevated border border-sl-border text-xs font-mono tabular-nums font-semibold text-sl-heading shrink-0">
          {events.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-sl-border bg-sl-canvas/60 px-3 py-5 text-center space-y-1.5">
          <CheckCircle2 className="w-5 h-5 text-sl-success-text mx-auto" />
          <p className="text-xs text-sl-muted">
            {isEn
              ? 'No open invitations waiting for your reply.'
              : 'Keine unbeantworteten Einladungen offen.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-sl-border max-h-[520px] overflow-y-auto -mx-1 px-1">
          {visible.map((ev) => (
            <li key={ev.id} className="py-2 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => onSelectEvent(ev.id)}
                className="w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-lg hover:bg-sl-elevated/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sl-accent"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIconBadge category={ev.category} size="sm" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-sl-heading truncate">
                      {ev.title}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-sl-muted truncate">
                      {formatEventDateOnly(ev.startsAt, locale)}
                    </div>
                  </div>
                </div>
                <AlertCircle
                  aria-label={isEn ? 'Response open' : 'Rückmeldung offen'}
                  className="w-4 h-4 text-sl-warning-text shrink-0"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function UpcomingEventsCard({
  events,
  locale = 'de',
  onSelectEvent,
  maxItems = 5,
}: {
  events: EventSummaryView[];
  locale?: string;
  onSelectEvent: (eventId: string) => void;
  maxItems?: number;
}) {
  const isEn = locale.startsWith('en');
  const visible = events.slice(0, maxItems);

  return (
    <section className="rounded-xl border border-sl-border bg-sl-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-sl-heading truncate">
          {isEn ? 'Upcoming Events' : 'Anstehende Termine'}
        </h3>
        <span className="text-xs font-mono tabular-nums text-sl-muted">
          {events.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-sl-border bg-sl-canvas/60 px-3 py-5 text-center space-y-1.5">
          <Clock className="w-5 h-5 text-sl-subtle mx-auto" />
          <p className="text-xs text-sl-muted">
            {isEn ? 'No upcoming events scheduled.' : 'Keine anstehenden Termine geplant.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-sl-border -mx-1 px-1">
          {visible.map((ev) => {
            const status = ev.myResponse?.status ?? null;
            const statusMeta = status ? STATUS_META[status] : null;
            const isOpen = ev.isInvited && status === null;

            return (
              <li key={ev.id} className="py-2 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => onSelectEvent(ev.id)}
                  className="w-full text-left flex items-center justify-between gap-2.5 px-2 py-2 rounded-lg hover:bg-sl-elevated/70 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sl-accent"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIconBadge category={ev.category} size="sm" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold text-sl-heading truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-sl-muted truncate">
                        {formatEventDateOnly(ev.startsAt, locale)}
                      </div>
                      {statusMeta ? (
                        <div className={`text-[11px] font-medium ${statusMeta.textClass}`}>
                          {isEn ? statusMeta.labelEn : statusMeta.labelDe}
                        </div>
                      ) : isOpen ? (
                        <div className="text-[11px] font-medium text-sl-warning-text">
                          {isEn ? 'Open' : 'Offen'}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isOpen ? (
                    <AlertCircle className="w-4 h-4 text-sl-warning-text shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-sl-subtle shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
