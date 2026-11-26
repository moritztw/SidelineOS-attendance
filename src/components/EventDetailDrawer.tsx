import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Lock, Search, Trash2 } from 'lucide-react';
import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';
import { collectAvailablePositions, filterParticipants } from '../services/targeting.ts';
import type {
  AttendanceStatus,
  CoreAttachmentBridgeAdapter,
  EventDetailView,
  RosterMember,
} from '../types.ts';
import { AttachmentAdapterPanel } from './AttachmentAdapterPanel.tsx';
import {
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
  teamRolle,
  currentUserUuid,
  roster,
  attachmentAdapter,
  locale = 'de',
  onBack,
  onSubmitRsvp,
  onEditEvent,
  onDeleteEvent,
  onReloadDetail,
}: {
  detail: EventDetailView | null;
  loading: boolean;
  teamRolle: TeamRolle;
  currentUserUuid: string;
  roster: RosterMember[];
  attachmentAdapter: CoreAttachmentBridgeAdapter;
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

  if (loading || !detail) {
    return (
      <section className="rounded-xl border border-sl-border bg-sl-surface p-6 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-sl-muted hover:text-sl-heading inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isEn ? 'Back to calendar' : 'Zurück zur Übersicht'}</span>
        </button>
        <p className="text-sm text-sl-muted">
          {loading ? (isEn ? 'Loading event…' : 'Termin wird geladen…') : 'Termin nicht verfügbar.'}
        </p>
      </section>
    );
  }

  const ev = detail.event;
  const canManageAttachments = isStaff || ev.createdBy === currentUserUuid;

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
    <section className="rounded-xl border border-sl-border bg-sl-surface p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-sl-muted hover:text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isEn ? 'Back' : 'Zurück'}</span>
        </button>

        {isStaff && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEditEvent(detail)}
              className="px-3 py-1.5 rounded-lg border border-sl-border-strong hover:bg-sl-elevated text-xs font-medium text-sl-primary hover:text-sl-heading inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Edit' : 'Bearbeiten'}</span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteEvent(ev.id, 'single')}
              className="px-3 py-1.5 rounded-lg border border-sl-danger/50 hover:bg-sl-danger/15 text-xs font-medium text-sl-danger-text inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Delete event' : 'Termin löschen'}</span>
            </button>
            {ev.seriesId && (
              <button
                type="button"
                onClick={() => onDeleteEvent(ev.id, 'series')}
                className="px-3 py-1.5 rounded-lg border border-sl-danger/50 hover:bg-sl-danger/15 text-xs font-medium text-sl-danger-text whitespace-nowrap"
              >
                {isEn ? 'Delete series' : 'Ganze Serie löschen'}
              </button>
            )}
          </div>
        )}
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sl-muted">
          <span>{formatCategoryLabel(ev.category, locale)}</span>
          {ev.location && (
            <>
              <span aria-hidden="true">·</span>
              <span>{ev.location}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{formatTargetSummary(ev, locale)}</span>
        </div>
        <h2 className="text-xl font-semibold text-sl-heading">{ev.title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-sl-primary">
          <span>{formatEventDateRange(ev.startsAt, ev.endsAt, locale)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {isEn ? 'Deadline' : 'Frist'}: {formatDeadlineLabel(ev.cutoffDeadlineAt, locale)}
          </span>
        </div>
        {ev.description && <p className="text-sm text-sl-primary pt-1">{ev.description}</p>}
      </header>

      {/* Eigene Rückmeldung */}
      <div className="pt-4 border-t border-sl-border space-y-3">
        {!ev.isInvited ? (
          <div className="flex items-center gap-2 text-xs text-sl-muted">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {isEn
                ? 'You are not part of the invited target group for this event (read-only view).'
                : 'Du bist für diesen Termin nicht über die Zielgruppe eingeladen (reine Leseansicht).'}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-sl-muted">
              <span>{isEn ? 'Your response' : 'Deine Rückmeldung'}</span>
              {ev.myResponse?.source === 'LONG_TERM_ABSENCE' && !ev.myResponse.manualOverride && (
                <span className="text-sl-warning-text">
                  {isEn ? 'Auto-set via long-term absence' : 'Automatisch durch Langzeitabwesenheit'}
                </span>
              )}
            </div>
            <StatusSegmentedPicker
              value={ev.myResponse?.status ?? null}
              disabled={!ev.canRespond}
              busy={busy}
              locale={locale}
              onSelect={(status) => handleRsvp(status)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={comment}
                disabled={!ev.canRespond || busy}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isEn ? 'Optional comment…' : 'Optionale Begründung / Anmerkung…'}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
              />
              {ev.myResponse && ev.canRespond && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRsvp(ev.myResponse!.status)}
                  className="px-3 py-2 rounded-lg border border-sl-border bg-sl-elevated hover:border-sl-border-strong text-xs font-medium text-sl-heading whitespace-nowrap"
                >
                  {isEn ? 'Update Note' : 'Anmerkung speichern'}
                </button>
              )}
            </div>
            {!ev.canRespond && ev.isCutoffLockedForPlayers && (
              <p className="text-xs text-sl-warning-text">
                {isEn
                  ? 'The response deadline has passed.'
                  : 'Die Rückmeldefrist ist abgelaufen. Änderungen sind für Spieler gesperrt.'}
              </p>
            )}
          </>
        )}
        {error && <p className="text-xs text-sl-danger-text">{error}</p>}
      </div>

      {/* Anhänge & Links */}
      <AttachmentAdapterPanel
        eventId={ev.id}
        attachments={detail.attachments}
        canManage={canManageAttachments}
        adapter={attachmentAdapter}
        locale={locale}
        onChanged={onReloadDetail}
      />

      {/* Filterbare Teilnehmerliste */}
      <section className="pt-4 border-t border-sl-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-sl-heading">
            {isEn ? 'Invited Roster' : 'Eingeladene Teilnehmer'} ({detail.participants.length})
          </h3>
          <div className="text-xs font-mono tabular-nums text-sl-muted">
            {ev.counts.present} {isEn ? 'Present' : 'Anwesend'} · {ev.counts.inactive}{' '}
            {isEn ? 'Inactive' : 'Inaktiv'} · {ev.counts.absent}{' '}
            {isEn ? 'Absent' : 'Abwesend'} · {ev.counts.unanswered} {isEn ? 'Open' : 'Offen'}
          </div>
        </div>

        {detail.responsesHiddenForRole ? (
          <p className="text-xs text-sl-muted">
            {isEn
              ? 'Individual player responses and comments are visible to coaching staff only.'
              : 'Einzelne Rückmeldungen und Abmeldegründe anderer Spieler sind gemäß Team-Einstellung nur für Coaches & Staff einsehbar.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-sl-subtle absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isEn ? 'Search player…' : 'Spieler suchen…'}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent"
                />
              </div>

              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value as SpielerUnit | 'ALL')}
                className="px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
              >
                <option value="ALL">{isEn ? 'All Units' : 'Alle Units'}</option>
                <option value="OFFENSE">OFFENSE</option>
                <option value="DEFENSE">DEFENSE</option>
                <option value="SPECIAL_TEAMS">SPECIAL_TEAMS</option>
              </select>

              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
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
                className="px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
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
              <p className="text-xs text-sl-muted py-4 text-center">
                {isEn ? 'No matching participants.' : 'Keine passenden Teilnehmer gefunden.'}
              </p>
            ) : (
              <div className="overflow-x-auto border border-sl-border rounded-lg bg-sl-canvas">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-sl-border text-sl-muted">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">{isEn ? 'Player' : 'Spieler'}</th>
                      <th className="py-2.5 px-3 font-medium">Unit · Pos</th>
                      <th className="py-2.5 px-3 font-medium">{isEn ? 'Status' : 'Status'}</th>
                      <th className="py-2.5 px-3 font-medium">{isEn ? 'Comment' : 'Kommentar'}</th>
                      {isStaff && (
                        <th className="py-2.5 px-3 font-medium text-right">
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
                          <td className="py-2.5 px-3 font-medium text-sl-heading whitespace-nowrap">
                            {member.trikotNummer && (
                              <span className="font-mono tabular-nums text-sl-muted mr-1.5">
                                #{member.trikotNummer}
                              </span>
                            )}
                            {member.vollerName}
                          </td>
                          <td className="py-2.5 px-3 text-sl-muted whitespace-nowrap">
                            {member.units.join(', ')}
                            {member.position ? ` · ${member.position}` : ''}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {meta ? (
                              <span className={`inline-flex items-center gap-1 font-medium ${meta.textClass}`}>
                                <meta.Icon className="w-3.5 h-3.5" />
                                {isEn ? meta.labelEn : meta.labelDe}
                              </span>
                            ) : (
                              <span className="text-sl-subtle">{isEn ? 'Open' : 'Offen'}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-sl-primary max-w-xs truncate">
                            {response?.comment || '—'}
                          </td>
                          {isStaff && (
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <select
                                aria-label={`Status für ${member.vollerName}`}
                                value={response?.status ?? ''}
                                disabled={busy}
                                onChange={(e) => {
                                  const next = e.target.value as AttendanceStatus;
                                  if (next) handleRsvp(next, member.userUuid);
                                }}
                                className="px-2 py-1 text-xs rounded border border-sl-border bg-sl-surface text-sl-primary"
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
    </section>
  );
}
