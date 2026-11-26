import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Edit3,
  Link2,
  Lock,
  MapPin,
  Search,
  Trash2,
} from 'lucide-react';
import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';
import { buildTabBaseUrl, isModifiedLinkClick } from '../services/routing.ts';
import { collectAvailablePositions, filterParticipants } from '../services/targeting.ts';
import type {
  AttendanceStatus,
  CoreAttachmentBridgeAdapter,
  EventDetailView,
  RosterMember,
} from '../types.ts';
import { AttachmentAdapterPanel } from './AttachmentAdapterPanel.tsx';
import {
  CategoryIconBadge,
  STATUS_META,
  StatusSegmentedPicker,
  formatCategoryLabel,
  formatDeadlineLabel,
  formatEventDateRange,
  formatTargetSummary,
} from './StatusControls.tsx';

export function EventDetailDrawer({
  detail,
  loading,
  loadError,
  teamRolle,
  roster,
  attachmentAdapter,
  backHref,
  locale = 'de',
  onBack,
  onSubmitRsvp,
  onEditEvent,
  onDeleteEvent,
  onReloadDetail,
}: {
  detail: EventDetailView | null;
  loading: boolean;
  loadError?: string | null;
  teamRolle: TeamRolle;
  roster: RosterMember[];
  attachmentAdapter: CoreAttachmentBridgeAdapter;
  backHref?: string;
  locale?: string;
  onBack: () => void;
  onSubmitRsvp: (
    eventId: string,
    status: AttendanceStatus,
    comment: string,
    targetUserUuid?: string
  ) => Promise<void>;
  onEditEvent: (detail: EventDetailView) => void;
  onDeleteEvent: (eventId: string, scope: 'single' | 'series') => Promise<void>;
  onReloadDetail: () => void;
}) {
  const isEn = locale.startsWith('en');
  const isStaff = teamRolle === 'TEAM_ADMIN' || teamRolle === 'COACH';
  const [comment, setComment] = useState(detail?.event.myResponse?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [unitFilter, setUnitFilter] = useState<SpielerUnit | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'UNANSWERED' | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setComment(detail?.event.myResponse?.comment ?? '');
    setError(null);
  }, [detail?.event.id, detail?.event.myResponse?.comment]);

  const availablePositions = useMemo(() => collectAvailablePositions(roster), [roster]);

  const filteredParticipants = useMemo(() => {
    if (!detail) return [];
    return filterParticipants(detail.participants, {
      unit: unitFilter,
      position: positionFilter,
      status: statusFilter,
      query: searchQuery,
    });
  }, [detail, unitFilter, positionFilter, statusFilter, searchQuery]);

  const resolvedBackHref = backHref ?? buildTabBaseUrl();

  function handleBackClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isModifiedLinkClick(e)) return;
    e.preventDefault();
    onBack();
  }

  async function handleCopyEventLink() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard API ggf. in Sandbox nicht verfügbar
    }
  }

  if (loading || !detail) {
    return (
      <section className="rounded-xl border border-sl-border bg-sl-surface p-6 space-y-4">
        <a
          href={resolvedBackHref}
          onClick={handleBackClick}
          className="text-xs font-medium text-sl-muted hover:text-sl-heading inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isEn ? 'Back' : 'Zurück'}</span>
        </a>
        <p className={`text-sm ${loadError ? 'text-sl-danger-text' : 'text-sl-muted'}`}>
          {loading
            ? isEn
              ? 'Loading event…'
              : 'Termin wird geladen…'
            : loadError || (isEn ? 'Event not available.' : 'Termin nicht verfügbar.')}
        </p>
      </section>
    );
  }

  const ev = detail.event;
  // Strikt nur Coaches und Team-Admins dürfen Links und Anhänge hinzufügen/entfernen
  const canManageAttachments = isStaff;

  async function handleRsvp(status: AttendanceStatus, targetUserUuid?: string) {
    setBusy(true);
    setError(null);
    try {
      await onSubmitRsvp(ev.id, status, targetUserUuid ? '' : comment, targetUserUuid);
      onReloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Linke Spalte (~42%): Termin-Kopf + Deine Rückmeldung */}
      <div className="lg:col-span-5 space-y-5">
        {/* Karte 1: Termin-Informationen */}
        <section className="rounded-xl border border-sl-border bg-sl-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={resolvedBackHref}
              onClick={handleBackClick}
              className="text-xs font-medium text-sl-muted hover:text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back' : 'Zurück'}</span>
            </a>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyEventLink}
                className="px-2.5 py-1.5 rounded-lg border border-sl-border hover:border-sl-border-strong hover:bg-sl-elevated text-xs font-medium text-sl-muted hover:text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-sl-success-text" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {copiedLink
                    ? isEn
                      ? 'Copied'
                      : 'Kopiert'
                    : isEn
                      ? 'Copy link'
                      : 'Link kopieren'}
                </span>
              </button>

              {isStaff && (
                <>
                  <button
                    type="button"
                    onClick={() => onEditEvent(detail)}
                    className="px-2.5 py-1.5 rounded-lg border border-sl-border-strong hover:bg-sl-elevated text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Edit' : 'Bearbeiten'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(ev.id, 'single')}
                    className="px-2.5 py-1.5 rounded-lg border border-sl-danger/50 hover:bg-sl-danger/15 text-xs font-medium text-sl-danger-text inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Delete' : 'Löschen'}</span>
                  </button>
                  {ev.seriesId && (
                    <button
                      type="button"
                      onClick={() => onDeleteEvent(ev.id, 'series')}
                      className="px-2.5 py-1.5 rounded-lg border border-sl-danger/50 hover:bg-sl-danger/15 text-xs font-medium text-sl-danger-text whitespace-nowrap"
                    >
                      {isEn ? 'Delete series' : 'Serie löschen'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <header className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-sl-muted">
                  <span>{formatCategoryLabel(ev.category, locale)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatTargetSummary(ev, locale)}</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-sl-heading break-words">
                  {ev.title}
                </h2>
              </div>
              <CategoryIconBadge category={ev.category} size="lg" />
            </div>

            <div className="space-y-2 pt-1 text-sm">
              <div className="flex items-center gap-2 text-sl-primary font-mono tabular-nums">
                <Calendar className="w-4 h-4 text-sl-muted shrink-0" />
                <span>{formatEventDateRange(ev.startsAt, ev.endsAt, locale)}</span>
              </div>

              <div className="flex items-center gap-2 text-sl-warning-text font-mono tabular-nums">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isEn ? 'Response deadline' : 'Antwortfrist'}:{' '}
                  {formatDeadlineLabel(ev.cutoffDeadlineAt, locale)}
                </span>
              </div>

              {ev.location && (
                <div className="flex items-center gap-2 text-xs text-sl-muted">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{ev.location}</span>
                </div>
              )}
            </div>

            {ev.description && (
              <p className="text-sm text-sl-primary leading-relaxed pt-2 border-t border-sl-border">
                {ev.description}
              </p>
            )}
          </header>
        </section>

        {/* Karte 2: Deine Rückmeldung */}
        <section className="rounded-xl border border-sl-border bg-sl-surface p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-sl-heading">
              {isEn ? 'Your response' : 'Deine Rückmeldung'}
            </h3>
            {ev.myResponse?.source === 'LONG_TERM_ABSENCE' && !ev.myResponse.manualOverride && (
              <span className="text-xs text-sl-warning-text">
                {isEn ? 'Auto-set via long-term absence' : 'Automatisch durch Langzeitabwesenheit'}
              </span>
            )}
          </div>

          {!ev.isInvited ? (
            <div className="rounded-lg border border-sl-border bg-sl-canvas p-4 flex items-start gap-2.5 text-xs text-sl-muted">
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {isEn
                  ? 'You are not part of the invited target group for this event (read-only view).'
                  : 'Du bist für diesen Termin nicht über die Zielgruppe eingeladen (reine Leseansicht).'}
              </span>
            </div>
          ) : (
            <div className="space-y-3.5">
              <StatusSegmentedPicker
                value={ev.myResponse?.status ?? null}
                disabled={!ev.canRespond}
                busy={busy}
                size="lg"
                locale={locale}
                onSelect={(status) => handleRsvp(status)}
              />

              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={comment}
                  disabled={!ev.canRespond || busy}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isEn ? 'Optional comment…' : 'Optionale Begründung / Anmerkung…'}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent resize-y"
                />
                {ev.myResponse && ev.canRespond && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRsvp(ev.myResponse!.status)}
                      className="px-3.5 py-2 rounded-lg border border-sl-border bg-sl-elevated hover:border-sl-border-strong text-xs font-medium text-sl-heading whitespace-nowrap transition-colors disabled:opacity-45"
                    >
                      {isEn ? 'Save Note' : 'Anmerkung speichern'}
                    </button>
                  </div>
                )}
              </div>

              {!ev.canRespond && ev.isCutoffLockedForPlayers && (
                <p className="text-xs text-sl-warning-text">
                  {isEn
                    ? 'The response deadline has passed.'
                    : 'Die Rückmeldefrist ist abgelaufen. Änderungen sind für Spieler gesperrt.'}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-sl-danger-text">{error}</p>}
        </section>
      </div>

      {/* Rechte Spalte (~58%): Eingeladene Teilnehmer + Anhänge & Links */}
      <div className="lg:col-span-7 space-y-5 min-w-0">
        {/* Karte 1: Eingeladene Teilnehmer */}
        <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-sl-heading">
              {isEn ? 'Invited Roster' : 'Eingeladene Teilnehmer'} ({detail.participants.length})
            </h3>
            <div className="text-xs font-mono tabular-nums text-sl-muted">
              {ev.counts.present} {isEn ? 'Present' : 'Anwesend'} · {ev.counts.inactive}{' '}
              {isEn ? 'Inactive' : 'Inaktiv'} · {ev.counts.absent}{' '}
              {isEn ? 'Absent' : 'Abwesend'} · {ev.counts.unanswered} {isEn ? 'Open' : 'Offen'}
            </div>
          </div>

          {detail.responsesHiddenForRole ? (
            <p className="text-xs text-sl-muted py-2">
              {isEn
                ? 'Individual player responses and comments are visible to coaching staff only.'
                : 'Einzelne Rückmeldungen und Abmeldegründe anderer Spieler sind gemäß Team-Einstellung nur für Coaches & Staff einsehbar.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr] gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-sl-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isEn ? 'Search player…' : 'Spieler suchen…'}
                    className="w-full min-h-[38px] pl-8 pr-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
                  />
                </div>

                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value as SpielerUnit | 'ALL')}
                  className="min-h-[38px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
                >
                  <option value="ALL">{isEn ? 'All Units' : 'Alle Units'}</option>
                  <option value="OFFENSE">OFFENSE</option>
                  <option value="DEFENSE">DEFENSE</option>
                  <option value="SPECIAL_TEAMS">SPECIAL_TEAMS</option>
                </select>

                <select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                  className="min-h-[38px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
                >
                  <option value="ALL">{isEn ? 'All Positions' : 'Alle Positionen'}</option>
                  {availablePositions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as AttendanceStatus | 'UNANSWERED' | 'ALL')
                  }
                  className="min-h-[38px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
                >
                  <option value="ALL">{isEn ? 'All Statuses' : 'Alle Status'}</option>
                  <option value="PRESENT">{isEn ? 'Present' : 'Anwesend'}</option>
                  <option value="INACTIVE">{isEn ? 'Inactive' : 'Inaktiv'}</option>
                  <option value="UNCERTAIN">{isEn ? 'Uncertain' : 'Unsicher'}</option>
                  <option value="ABSENT">{isEn ? 'Absent' : 'Abwesend'}</option>
                  <option value="UNANSWERED">{isEn ? 'Open' : 'Offen'}</option>
                </select>
              </div>

              {filteredParticipants.length === 0 ? (
                <p className="text-xs text-sl-muted py-8 text-center">
                  {isEn ? 'No matching participants.' : 'Keine passenden Teilnehmer gefunden.'}
                </p>
              ) : (
                <div className="overflow-x-auto border border-sl-border rounded-lg bg-sl-canvas">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-sl-border text-sl-muted bg-sl-elevated/30">
                      <tr>
                        <th className="py-2.5 px-3.5 font-medium">{isEn ? 'Player' : 'Spieler'}</th>
                        <th className="py-2.5 px-3 font-medium">Unit · Pos</th>
                        <th className="py-2.5 px-3 font-medium">{isEn ? 'Status' : 'Status'}</th>
                        <th className="py-2.5 px-3 font-medium">{isEn ? 'Comment' : 'Kommentar'}</th>
                        {isStaff && (
                          <th className="py-2.5 px-3.5 font-medium text-right">
                            {isEn ? 'Staff Override' : 'Coach-Override'}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sl-border">
                      {filteredParticipants.map(({ member, response }) => {
                        const meta = response ? STATUS_META[response.status] : null;
                        return (
                          <tr key={member.userUuid} className="hover:bg-sl-elevated/40">
                            <td className="py-3 px-3.5 font-semibold text-sl-heading whitespace-nowrap">
                              {member.trikotNummer && (
                                <span className="font-mono tabular-nums text-sl-muted font-normal mr-1.5">
                                  #{member.trikotNummer}
                                </span>
                              )}
                              {member.vollerName}
                            </td>
                            <td className="py-3 px-3 text-sl-muted whitespace-nowrap">
                              {member.units.join(', ')}
                              {member.position ? ` · ${member.position}` : ''}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {meta ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${meta.badgeClass}`}
                                >
                                  <meta.Icon className="w-3 h-3" />
                                  {isEn ? meta.labelEn : meta.labelDe}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium bg-sl-warning-text/15 text-sl-warning-text border border-sl-warning-text/30">
                                  {isEn ? 'Open' : 'Offen'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-sl-primary max-w-xs truncate">
                              {response?.comment || '—'}
                            </td>
                            {isStaff && (
                              <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                <select
                                  aria-label={`Status für ${member.vollerName}`}
                                  value={response?.status ?? ''}
                                  disabled={busy}
                                  onChange={(e) => {
                                    const next = e.target.value as AttendanceStatus;
                                    if (next) handleRsvp(next, member.userUuid);
                                  }}
                                  className="px-2 py-1 text-xs rounded-md border border-sl-border bg-sl-surface text-sl-primary"
                                >
                                  <option value="">{isEn ? 'Set…' : 'Setzen…'}</option>
                                  <option value="PRESENT">{isEn ? 'Present' : 'Anwesend'}</option>
                                  <option value="INACTIVE">{isEn ? 'Inactive' : 'Inaktiv'}</option>
                                  <option value="UNCERTAIN">{isEn ? 'Uncertain' : 'Unsicher'}</option>
                                  <option value="ABSENT">{isEn ? 'Absent' : 'Abwesend'}</option>
                                </select>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* Karte 2: Anhänge & Links */}
        <AttachmentAdapterPanel
          eventId={ev.id}
          attachments={detail.attachments}
          canManage={canManageAttachments}
          adapter={attachmentAdapter}
          locale={locale}
          onChanged={onReloadDetail}
        />
      </div>
    </div>
  );
}
