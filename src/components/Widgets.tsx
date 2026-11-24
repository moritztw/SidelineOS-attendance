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
        <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Calendar className="w-4 h-4" />
            <span>{isEn ? 'Next invited event' : 'Nächster eingeladener Termin'}</span>
          </div>
          <p className="text-sm font-medium text-white">
            {isEn ? 'No upcoming invitations' : 'Aktuell stehen keine eingeladenen Termine an'}
          </p>
          <p className="text-xs text-slate-400">
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
      <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
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
          <h2 className="text-lg font-semibold text-white truncate">{event.title}</h2>
          <p className="text-xs font-mono tabular-nums text-slate-300">
            {formatEventDateRange(event.startsAt, event.endsAt, locale)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(event.id)}
          className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <span>{isEn ? 'Details' : 'Details'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>{formatTargetSummary(event, locale)}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">
          {isEn ? 'Deadline' : 'Frist'}: {formatDeadlineLabel(event.cutoffDeadlineAt, locale)}
        </span>
        {event.attachmentCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-slate-300 font-mono tabular-nums">
              <Paperclip className="w-3 h-3" />
              {event.attachmentCount} {isEn ? 'Attachments' : 'Anhänge'}
            </span>
          </>
        )}
      </div>

      <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
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
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 disabled:opacity-50"
          />
          {currentStatus && event.canRespond && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSelect(currentStatus)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white whitespace-nowrap shrink-0"
            >
              {isEn ? 'Save Note' : 'Kommentar sichern'}
            </button>
          )}
        </div>

        {!event.canRespond && event.isCutoffLockedForPlayers && (
          <p className="text-xs text-amber-400">
            {isEn
              ? 'Response deadline has passed. Contact a coach for late changes.'
              : 'Rückmeldefrist abgelaufen. Bitte wende dich für kurzfristige Änderungen an einen Coach.'}
          </p>
        )}
        {feedback && <p className="text-xs text-emerald-400">{feedback}</p>}
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
        <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-2">
          <p className="text-xs text-slate-400">{isEn ? 'Staff Overview' : 'Staff-Rückmeldequote'}</p>
          <p className="text-sm font-medium text-white">
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
      <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{isEn ? 'Staff Response Monitor' : 'Rückmeldequote · Nächster Termin'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatTargetSummary(event, locale)}</span>
          </div>
          <h2 className="text-base font-semibold text-white">{event.title}</h2>
          <p className="text-xs font-mono tabular-nums text-slate-400">
            {formatEventDateRange(event.startsAt, event.endsAt, locale)}
          </p>
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold font-mono tabular-nums text-white">
            {responseRate}%
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            {answered} / {event.counts.invited} {isEn ? 'responded' : 'rückgemeldet'}
          </div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
        {event.counts.invited > 0 && (
          <>
            <div
              className="bg-emerald-500 h-full"
              style={{ width: `${(event.counts.present / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${(event.counts.inactive / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-slate-500 h-full"
              style={{ width: `${(event.counts.uncertain / event.counts.invited) * 100}%` }}
            />
            <div
              className="bg-red-500 h-full"
              style={{ width: `${(event.counts.absent / event.counts.invited) * 100}%` }}
            />
          </>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="rounded-lg border border-slate-800 bg-[#0b0e11] px-3 py-2">
          <dt className="text-slate-400">{isEn ? 'Present' : 'Anwesend'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-emerald-400">
            {event.counts.present}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0b0e11] px-3 py-2">
          <dt className="text-slate-400">{isEn ? 'Inactive' : 'Inaktiv'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-amber-400">
            {event.counts.inactive}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0b0e11] px-3 py-2">
          <dt className="text-slate-400">{isEn ? 'Uncertain' : 'Unsicher'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-slate-300">
            {event.counts.uncertain}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0b0e11] px-3 py-2">
          <dt className="text-slate-400">{isEn ? 'Absent' : 'Abwesend'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-red-400">
            {event.counts.absent}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-[#0b0e11] px-3 py-2">
          <dt className="text-slate-400">{isEn ? 'Open' : 'Offen'}</dt>
          <dd className="text-sm font-semibold font-mono tabular-nums text-slate-200">
            {event.counts.unanswered}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {liveCheckinEnabled && (
          <button
            type="button"
            onClick={() => onOpenCheckIn(event.id)}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isEn ? 'Live Check-In' : 'Live-Check-In öffnen'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenDetail(event.id)}
          className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>{isEn ? 'Open Roster Status' : 'Teilnehmerliste prüfen'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      </section>
    </div>
  );
}
