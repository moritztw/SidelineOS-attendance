import { useEffect, useState } from 'react';
import { Calendar, CheckSquare, ChevronRight, Paperclip } from 'lucide-react';
import type { AttendanceStatus, EventSummaryView } from '../types.ts';
import {
  STATUS_META,
  StatusSegmentedPicker,
  formatCategoryLabel,
  formatDeadlineLabel,
  formatEventDateRange,
  formatTargetSummary,
} from './StatusControls.tsx';

/**
 * Eigenständiges Spieler-Dashboard-Widget (sofort im Übersicht-Tab genutzt und
 * für künftige Core-Hub-Widget-Slots vorbereitet).
 */
export function PlayerNextEventWidget({
  event,
  locale = 'de',
  busy,
  onSubmitRsvp,
  onOpenDetail,
}: {
  event: EventSummaryView | null;
  locale?: string;
  busy: boolean;
  onSubmitRsvp: (eventId: string, status: AttendanceStatus, comment: string) => Promise<void>;
  onOpenDetail: (eventId: string) => void;
}) {
  const isEn = locale.startsWith('en');
  const [comment, setComment] = useState(event?.myResponse?.comment ?? '');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setComment(event?.myResponse?.comment ?? '');
    setFeedback(null);
  }, [event?.id, event?.myResponse?.comment]);

  if (!event) {
    return (
      <div className="sl-attendance-scope">
        <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-2">
          <div className="flex items-center gap-2 text-sl-muted text-xs">
            <Calendar className="w-4 h-4" />
            <span>{isEn ? 'Next invited event' : 'Nächster eingeladener Termin'}</span>
          </div>
          <p className="text-sm font-medium text-sl-heading">
            {isEn ? 'No upcoming invitations' : 'Aktuell stehen keine eingeladenen Termine an'}
          </p>
          <p className="text-xs text-sl-muted">
            {isEn
              ? 'New practices and positional meetings will appear here automatically.'
              : 'Sobald Coaches neue Trainings oder Meetings anlegen, kannst du hier direkt zusagen.'}
          </p>
        </section>
      </div>
    );
  }

  async function handleSelect(status: AttendanceStatus) {
    setFeedback(null);
    try {
      await onSubmitRsvp(event!.id, status, comment);
      setFeedback(isEn ? 'Saved' : 'Gespeichert');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Fehler');
    }
  }

  const currentStatus = event.myResponse?.status ?? null;
  const currentMeta = currentStatus ? STATUS_META[currentStatus] : null;

  return (
    <div className="sl-attendance-scope">
      <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sl-muted">
            <span>{isEn ? 'Next Event' : 'Nächster Termin'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatCategoryLabel(event.category, locale)}</span>
            {event.location && (
              <>
                <span aria-hidden="true">·</span>
                <span>{event.location}</span>
              </>
            )}
          </div>
          <h2 className="text-lg font-semibold text-sl-heading truncate">{event.title}</h2>
          <p className="text-xs font-mono tabular-nums text-sl-primary">
            {formatEventDateRange(event.startsAt, event.endsAt, locale)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(event.id)}
          className="px-3 py-1.5 rounded-lg border border-sl-border hover:border-sl-border-strong text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <span>{isEn ? 'Details' : 'Details'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sl-muted">
        <span>{formatTargetSummary(event, locale)}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          {isEn ? 'Deadline' : 'Frist'}: {formatDeadlineLabel(event.cutoffDeadlineAt, locale)}
        </span>
        {event.attachmentCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-sl-primary font-mono tabular-nums">
              <Paperclip className="w-3 h-3" />
              {event.attachmentCount} {isEn ? 'Attachments' : 'Anhänge'}
            </span>
          </>
        )}
      </div>

      <div className="space-y-2.5 pt-2 border-t border-sl-border">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-sl-muted">
            {isEn ? 'Your response' : 'Deine Rückmeldung'}
            {event.myResponse?.source === 'LONG_TERM_ABSENCE' && !event.myResponse.manualOverride
              ? isEn
                ? ' · Auto-set via absence'
                : ' · Automatisch durch Abwesenheit'
              : ''}
          </span>
          {currentMeta && (
            <span className={`font-medium ${currentMeta.textClass}`}>
              {isEn ? currentMeta.labelEn : currentMeta.labelDe}
            </span>
          )}
        </div>

        <StatusSegmentedPicker
          value={currentStatus}
          disabled={!event.canRespond}
          busy={busy}
          locale={locale}
          onSelect={handleSelect}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={comment}
            disabled={!event.canRespond || busy}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isEn
                ? 'Optional note (e.g. 15 min late due to work)'
                : 'Optionaler Kommentar (z. B. Komme 15 Min. später wegen Arbeit)'
            }
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-primary placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent disabled:opacity-50"
          />
          {currentStatus && event.canRespond && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSelect(currentStatus)}
              className="px-3 py-2 rounded-lg border border-sl-border bg-sl-elevated hover:border-sl-border-strong text-xs font-medium text-sl-heading whitespace-nowrap shrink-0"
            >
              {isEn ? 'Save Note' : 'Kommentar sichern'}
            </button>
          )}
        </div>

        {!event.canRespond && event.isCutoffLockedForPlayers && (
          <p className="text-xs text-sl-warning-text">
            {isEn
              ? 'Response deadline has passed. Contact a coach for late changes.'
              : 'Rückmeldefrist abgelaufen. Bitte wende dich für kurzfristige Änderungen an einen Coach.'}
          </p>
        )}
        {feedback && <p className="text-xs text-sl-success-text">{feedback}</p>}
      </div>
      </section>
    </div>
  );
}

/**
 * Eigenständiges Staff-Dashboard-Widget zur Rückmeldequote bezogen auf
 * tatsächlich eingeladene Personen (vorbereitet für künftige Core-Hub-Widgets).
 */
export function StaffResponseRateWidget({
  event,
  liveCheckinEnabled,
  locale = 'de',
  onOpenDetail,
  onOpenCheckIn,
}: {
  event: EventSummaryView | null;
  liveCheckinEnabled: boolean;
  locale?: string;
  onOpenDetail: (eventId: string) => void;
  onOpenCheckIn: (eventId: string) => void;
}) {
  const isEn = locale.startsWith('en');

  if (!event) {
    return (
      <div className="sl-attendance-scope">
        <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-2">
          <p className="text-xs text-sl-muted">{isEn ? 'Staff Overview' : 'Staff-Rückmeldequote'}</p>
          <p className="text-sm font-medium text-sl-heading">
            {isEn ? 'No upcoming event scheduled' : 'Kein anstehender Termin geplant'}
          </p>
        </section>
      </div>
    );
  }

  const answered = event.counts.invited - event.counts.unanswered;
  const responseRate =
    event.counts.invited > 0 ? Math.round((answered / event.counts.invited) * 100) : 0;

  return (
    <div className="sl-attendance-scope">
      <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-sl-muted">
            <span>{isEn ? 'Staff Response Monitor' : 'Rückmeldequote · Nächster Termin'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatTargetSummary(event, locale)}</span>
          </div>
          <h2 className="text-base font-semibold text-sl-heading">{event.title}</h2>
          <p className="text-xs font-mono tabular-nums text-sl-muted">
            {formatEventDateRange(event.startsAt, event.endsAt, locale)}
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold font-mono tabular-nums text-sl-heading">
            {responseRate}%
          </div>
          <div className="text-xs font-mono tabular-nums text-sl-muted">
            {answered} / {event.counts.invited} {isEn ? 'responded' : 'rückgemeldet'}
          </div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-sl-elevated overflow-hidden flex">
        {event.counts.invited > 0 && (
          <>
            <div
              className="bg-sl-success h-full"
              style={{ width: `${(event.counts.present / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-sl-warning-text h-full"
              style={{ width: `${(event.counts.inactive / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-sl-subtle h-full"
              style={{ width: `${(event.counts.uncertain / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-sl-danger h-full"
              style={{ width: `${(event.counts.absent / event.counts.invited) * 100}%` }}
            />
          </>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-2">
          <dt className="text-sl-muted">{isEn ? 'Present' : 'Anwesend'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-sl-success-text">
            {event.counts.present}
          </dd>
        </div>
        <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-2">
          <dt className="text-sl-muted">{isEn ? 'Inactive' : 'Inaktiv'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-sl-warning-text">
            {event.counts.inactive}
          </dd>
        </div>
        <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-2">
          <dt className="text-sl-muted">{isEn ? 'Uncertain' : 'Unsicher'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-sl-primary">
            {event.counts.uncertain}
          </dd>
        </div>
        <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-2">
          <dt className="text-sl-muted">{isEn ? 'Absent' : 'Abwesend'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-sl-danger-text">
            {event.counts.absent}
          </dd>
        </div>
        <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-2">
          <dt className="text-sl-muted">{isEn ? 'Open' : 'Offen'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-sl-primary">
            {event.counts.unanswered}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {liveCheckinEnabled && (
          <button
            type="button"
            onClick={() => onOpenCheckIn(event.id)}
            className="px-3 py-2 rounded-lg border border-sl-border-strong hover:bg-sl-elevated text-xs font-medium text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isEn ? 'Live Check-In' : 'Live-Check-In öffnen'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenDetail(event.id)}
          className="px-3 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-medium text-sl-accent-contrast inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>{isEn ? 'Open Roster Status' : 'Teilnehmerliste prüfen'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      </section>
    </div>
  );
}
