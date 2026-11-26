import { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { AttendanceStatus, EventCategory, EventSummaryView } from '../types.ts';
import { PendingResponsesCard } from './SidebarCards.tsx';
import {
  CategoryIconBadge,
  STATUS_META,
  StatusSegmentedPicker,
  formatCategoryLabel,
  formatDeadlineLabel,
  formatEventDateOnly,
  formatEventTimeRange,
  formatTargetSummary,
} from './StatusControls.tsx';

export function OverviewListView({
  events,
  openInvitedEvents,
  nextTeamEvent,
  liveCheckinEnabled,
  isStaff,
  busyRsvp,
  locale = 'de',
  onSelectEvent,
  onQuickRsvp,
  onCreateEvent,
  onOpenCheckIn,
}: {
  events: EventSummaryView[];
  openInvitedEvents: EventSummaryView[];
  nextTeamEvent: EventSummaryView | null;
  liveCheckinEnabled: boolean;
  isStaff: boolean;
  busyRsvp: boolean;
  locale?: string;
  onSelectEvent: (eventId: string) => void;
  onQuickRsvp: (eventId: string, status: AttendanceStatus) => Promise<void>;
  onCreateEvent: () => void;
  onOpenCheckIn: (eventId: string) => void;
}) {
  const isEn = locale.startsWith('en');
  const [timeScope, setTimeScope] = useState<'UPCOMING' | 'ALL' | 'PAST'>('UPCOMING');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'ALL'>('ALL');
  const [onlyInvited, setOnlyInvited] = useState(false);

  const hasExtraFilters = categoryFilter !== 'ALL' || onlyInvited;

  const filtered = useMemo(() => {
    const nowMs = Date.now();
    const q = searchQuery.trim().toLowerCase();

    return events.filter((ev) => {
      const startMs = Date.parse(ev.startsAt);
      const endMs = Date.parse(ev.endsAt);
      const compareMs = Number.isFinite(endMs) ? endMs : startMs;

      if (timeScope === 'UPCOMING' && Number.isFinite(compareMs) && compareMs < nowMs - 1800_000) {
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
      if (q) {
        const haystack = [
          ev.title,
          ev.location ?? '',
          ev.description ?? '',
          formatCategoryLabel(ev.category, locale),
          formatTargetSummary(ev, locale),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, timeScope, categoryFilter, onlyInvited, searchQuery, locale]);

  const featuredEvent = filtered.length > 0 ? filtered[0] : null;
  const remainingEvents = filtered.length > 1 ? filtered.slice(1) : [];

  const staffRate = useMemo(() => {
    if (!nextTeamEvent || nextTeamEvent.counts.invited === 0) return null;
    const answered = nextTeamEvent.counts.invited - nextTeamEvent.counts.unanswered;
    return {
      answered,
      invited: nextTeamEvent.counts.invited,
      percent: Math.round((answered / nextTeamEvent.counts.invited) * 100),
    };
  }, [nextTeamEvent]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
      {/* Linke Hauptspalte: Kommende Termine */}
      <div className="min-w-0 space-y-4">
        {/* Kopfzeile mit Zeitraum-Umschalter, Suche & Filter-Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-sl-heading whitespace-nowrap">
            {timeScope === 'PAST'
              ? isEn
                ? 'Past Events'
                : 'Vergangene Termine'
              : timeScope === 'ALL'
                ? isEn
                  ? 'All Events'
                  : 'Alle Termine'
                : isEn
                  ? 'Upcoming Events'
                  : 'Kommende Termine'}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label={isEn ? 'Time range' : 'Zeitraum'}
              className="flex items-center gap-1 p-1 rounded-lg bg-sl-surface border border-sl-border"
            >
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

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-sl-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search…' : 'Suchen…'}
                aria-label={isEn ? 'Search events' : 'Termine durchsuchen'}
                className="w-40 sm:w-48 pl-8 pr-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-surface text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-expanded={showFilters}
              aria-label={isEn ? 'Toggle filters' : 'Filter umschalten'}
              className={`min-h-[34px] px-2.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showFilters || hasExtraFilters
                  ? 'border-sl-accent bg-sl-accent/15 text-sl-accent'
                  : 'border-sl-border bg-sl-surface text-sl-muted hover:text-sl-heading hover:border-sl-border-strong'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isEn ? 'Filter' : 'Filter'}</span>
            </button>
          </div>
        </div>

        {/* Ausklappbare Zusatzfilter */}
        {showFilters && (
          <div className="rounded-xl border border-sl-border bg-sl-surface p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as EventCategory | 'ALL')}
                aria-label={isEn ? 'Category filter' : 'Kategorie-Filter'}
                className="px-3 py-1.5 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
              >
                <option value="ALL">{isEn ? 'All Categories' : 'Alle Kategorien'}</option>
                <option value="TRAINING">{isEn ? 'Practice' : 'Training'}</option>
                <option value="GAME">{isEn ? 'Game' : 'Spiel'}</option>
                <option value="MEETING">Meeting</option>
                <option value="OTHER">{isEn ? 'Other' : 'Sonstiges'}</option>
              </select>

              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sl-border bg-sl-canvas text-xs text-sl-primary cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyInvited}
                  onChange={(e) => setOnlyInvited(e.target.checked)}
                />
                <span>{isEn ? 'Invited only' : 'Nur eigene Einladungen'}</span>
              </label>
            </div>

            {hasExtraFilters && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setOnlyInvited(false);
                }}
                className="text-xs text-sl-accent hover:underline whitespace-nowrap"
              >
                {isEn ? 'Reset filters' : 'Filter zurücksetzen'}
              </button>
            )}
          </div>
        )}

        {/* Kompakter Staff-Schnellüberblick für Coaches/Admins */}
        {isStaff && nextTeamEvent && staffRate && (
          <div className="rounded-xl border border-sl-border bg-sl-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-w-0">
              <span className="font-semibold text-sl-heading">
                {isEn ? 'Next Event Response Rate' : 'Rückmeldequote · Nächster Termin'}:
              </span>
              <span className="font-mono tabular-nums font-semibold text-sl-accent">
                {staffRate.percent}%
              </span>
              <span className="text-sl-muted font-mono tabular-nums">
                ({staffRate.answered}/{staffRate.invited} · {nextTeamEvent.counts.present}{' '}
                {isEn ? 'Present' : 'Anwesend'})
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {liveCheckinEnabled && (
                <button
                  type="button"
                  onClick={() => onOpenCheckIn(nextTeamEvent.id)}
                  className="px-2.5 py-1.5 rounded-lg border border-sl-border-strong bg-sl-elevated hover:text-sl-heading text-xs font-medium text-sl-primary inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Live Check-In' : 'Live-Check-In'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectEvent(nextTeamEvent.id)}
                className="px-2.5 py-1.5 rounded-lg border border-sl-border hover:border-sl-border-strong text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>{isEn ? 'Roster' : 'Kader prüfen'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Leerzustand */}
        {!featuredEvent ? (
          <section className="rounded-xl border border-sl-border bg-sl-surface p-10 text-center space-y-3">
            <CalendarDays className="w-9 h-9 text-sl-subtle mx-auto" />
            <p className="text-sm font-semibold text-sl-heading">
              {events.length === 0
                ? isEn
                  ? 'No events scheduled for this season'
                  : 'Noch keine Termine in dieser Saison'
                : isEn
                  ? 'No events match your filters.'
                  : 'Keine Termine für diesen Filter gefunden.'}
            </p>
            <p className="text-xs text-sl-muted">
              {events.length === 0
                ? isEn
                  ? 'Create the first practice or meeting event for your team.'
                  : 'Erstelle den ersten Trainings- oder Meeting-Termin für dein Team.'
                : isEn
                  ? 'Try switching the time range or clearing your search.'
                  : 'Passe den Zeitraum oder die Suchfilter an, um weitere Termine zu sehen.'}
            </p>
            {isStaff && events.length === 0 && (
              <button
                type="button"
                onClick={onCreateEvent}
                className="px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-semibold text-sl-accent-contrast inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isEn ? 'New Event' : 'Neuer Termin'}</span>
              </button>
            )}
          </section>
        ) : (
          <div className="space-y-3">
            {/* Hervorgehobene Hauptkarte (1. Termin) */}
            <FeaturedEventCard
              event={featuredEvent}
              busy={busyRsvp}
              locale={locale}
              onSelectEvent={onSelectEvent}
              onQuickRsvp={onQuickRsvp}
            />

            {/* Weitere kompakte Terminkarten */}
            {remainingEvents.map((ev) => (
              <CompactEventCard
                key={ev.id}
                event={ev}
                busy={busyRsvp}
                locale={locale}
                onSelectEvent={onSelectEvent}
                onQuickRsvp={onQuickRsvp}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rechte Sidebar: Offene Rückmeldungen */}
      <aside className="xl:sticky xl:top-4">
        <PendingResponsesCard
          events={openInvitedEvents}
          locale={locale}
          onSelectEvent={onSelectEvent}
        />
      </aside>
    </div>
  );
}

function FeaturedEventCard({
  event,
  busy,
  locale,
  onSelectEvent,
  onQuickRsvp,
}: {
  event: EventSummaryView;
  busy: boolean;
  locale: string;
  onSelectEvent: (eventId: string) => void;
  onQuickRsvp: (eventId: string, status: AttendanceStatus) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const myStatus = event.myResponse?.status ?? null;
  const isOpen = event.isInvited && myStatus === null;

  const borderHighlight =
    myStatus === 'PRESENT'
      ? 'border-sl-success/50'
      : isOpen
        ? 'border-sl-accent/55'
        : 'border-sl-border-strong';

  return (
    <article
      className={`rounded-xl border ${borderHighlight} bg-sl-surface p-5 transition-colors`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 items-center">
        {/* Linker & mittlerer Info-Bereich */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-center min-w-0">
          <div className="flex items-start gap-4 min-w-0">
            <CategoryIconBadge category={event.category} size="lg" />
            <div className="min-w-0 space-y-1">
              <div className="text-xs text-sl-muted">
                {formatCategoryLabel(event.category, locale)}
              </div>
              <button
                type="button"
                onClick={() => onSelectEvent(event.id)}
                className="text-left text-2xl font-bold tracking-tight text-sl-heading hover:text-sl-accent transition-colors block truncate max-w-full"
              >
                {event.title}
              </button>
              <div className="flex items-center gap-1.5 text-xs text-sl-primary font-mono tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-sl-muted shrink-0" />
                <span className="truncate">{formatEventDateOnly(event.startsAt, locale)}</span>
              </div>
              <div className="text-xs text-sl-muted font-mono tabular-nums pl-5">
                {formatEventTimeRange(event.startsAt, event.endsAt, locale)}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs sm:border-l sm:border-sl-border sm:pl-4">
            <div className="flex items-center gap-1.5 text-sl-primary">
              <Users className="w-3.5 h-3.5 text-sl-muted shrink-0" />
              <span className="truncate">{formatTargetSummary(event, locale)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sl-warning-text font-mono tabular-nums">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isEn ? 'Deadline' : 'Frist'}: {formatDeadlineLabel(event.cutoffDeadlineAt, locale)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sl-muted font-mono tabular-nums">
              <span>
                {event.counts.present}/{event.counts.invited}{' '}
                {isEn ? 'Present' : 'Anwesend'}
              </span>
              {event.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-sans truncate max-w-[160px]">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                </>
              )}
              {event.attachmentCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {event.attachmentCount}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rechter Rückmelde-Block */}
        <div className="space-y-2.5 lg:border-l lg:border-sl-border lg:pl-5 lg:min-w-[330px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-sl-heading">
              {isEn ? 'Your response' : 'Deine Rückmeldung'}
            </span>
            <button
              type="button"
              onClick={() => onSelectEvent(event.id)}
              className="px-2.5 py-1 rounded-md border border-sl-border bg-sl-canvas hover:border-sl-border-strong text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <span>{isEn ? 'Details' : 'Details'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {event.isInvited ? (
            <StatusSegmentedPicker
              value={myStatus}
              disabled={!event.canRespond}
              busy={busy}
              size="sm"
              locale={locale}
              onSelect={(st) => void onQuickRsvp(event.id, st)}
            />
          ) : (
            <div className="rounded-lg border border-sl-border bg-sl-canvas px-3 py-3 text-xs text-sl-muted flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Not invited · Read only' : 'Nicht eingeladen · Nur Ansicht'}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactEventCard({
  event,
  busy,
  locale,
  onSelectEvent,
  onQuickRsvp,
}: {
  event: EventSummaryView;
  busy: boolean;
  locale: string;
  onSelectEvent: (eventId: string) => void;
  onQuickRsvp: (eventId: string, status: AttendanceStatus) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const myStatus = event.myResponse?.status ?? null;
  const statusMeta = myStatus ? STATUS_META[myStatus] : null;
  const muted = !event.isInvited;

  return (
    <article
      className={`rounded-xl border border-sl-border bg-sl-surface px-4 py-3.5 transition-colors ${
        muted ? 'opacity-75' : 'hover:border-sl-border-strong'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Links: Icon + Titel + Datum */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <CategoryIconBadge category={event.category} size="md" />
          <div className="min-w-0 space-y-0.5">
            <button
              type="button"
              onClick={() => onSelectEvent(event.id)}
              className="text-left text-base font-semibold text-sl-heading hover:text-sl-accent transition-colors block truncate max-w-full"
            >
              {event.title}
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sl-muted font-mono tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                {formatEventDateOnly(event.startsAt, locale)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatEventTimeRange(event.startsAt, event.endsAt, locale)}</span>
              {event.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans truncate max-w-[140px]">{event.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mitte: aktueller Status & Zusagen-Zähler */}
        <div className="flex items-center lg:flex-col lg:items-start gap-2 lg:gap-1 text-xs shrink-0 lg:min-w-[120px]">
          {statusMeta ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${statusMeta.badgeClass}`}
            >
              <statusMeta.Icon className="w-3 h-3" />
              {isEn ? statusMeta.labelEn : statusMeta.labelDe}
            </span>
          ) : muted ? (
            <span className="inline-flex items-center gap-1 text-sl-muted">
              <Lock className="w-3 h-3" />
              {isEn ? 'Read only' : 'Nur Ansicht'}
            </span>
          ) : (
            <span className="text-sl-warning-text font-medium">
              {isEn ? 'Response open' : 'Antwort offen'}
            </span>
          )}
          <span className="text-sl-muted font-mono tabular-nums">
            {event.counts.present}/{event.counts.invited} {isEn ? 'Present' : 'Anwesend'}
          </span>
        </div>

        {/* Rechts: 4 kompakte Status-Kacheln + Details */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          {event.isInvited && (
            <div className="sm:w-[300px]">
              <StatusSegmentedPicker
                value={myStatus}
                disabled={!event.canRespond}
                busy={busy}
                size="sm"
                locale={locale}
                onSelect={(st) => void onQuickRsvp(event.id, st)}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelectEvent(event.id)}
            className="min-h-[40px] px-3 py-2 rounded-lg border border-sl-border bg-sl-canvas hover:border-sl-border-strong text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>{isEn ? 'Details' : 'Details'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
