import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckSquare, PauseCircle, X } from 'lucide-react';
import type { SpielerUnit } from '@sidelineos/plugin-sdk';
import { collectAvailablePositions, filterParticipants } from '../services/targeting.ts';
import type {
  CheckInStatus,
  EventDetailView,
  EventSummaryView,
  RosterMember,
} from '../types.ts';
import { STATUS_META, formatEventDateRange } from './StatusControls.tsx';

export function LiveCheckInView({
  events,
  selectedEventId,
  detail,
  loadingDetail,
  liveCheckinEnabled,
  roster,
  locale = 'de',
  onSelectEvent,
  onSaveCheckIn,
  onOpenTeamSettings,
}: {
  events: EventSummaryView[];
  selectedEventId: string | null;
  detail: EventDetailView | null;
  loadingDetail: boolean;
  liveCheckinEnabled: boolean;
  roster: RosterMember[];
  locale?: string;
  onSelectEvent: (eventId: string) => void;
  onSaveCheckIn: (eventId: string, userUuid: string, actualStatus: CheckInStatus) => Promise<void>;
  onOpenTeamSettings: () => void;
}) {
  const isEn = locale.startsWith('en');
  const [unitFilter, setUnitFilter] = useState<SpielerUnit | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [busyUserUuid, setBusyUserUuid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availablePositions = useMemo(() => collectAvailablePositions(roster), [roster]);

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const nowMs = Date.now();
      const nearest =
        events.find((e) => Date.parse(e.endsAt) >= nowMs) ?? events[events.length - 1];
      if (nearest) onSelectEvent(nearest.id);
    }
  }, [selectedEventId, events, onSelectEvent]);

  const filteredParticipants = useMemo(() => {
    if (!detail) return [];
    return filterParticipants(detail.participants, {
      unit: unitFilter,
      position: positionFilter,
      status: 'ALL',
    });
  }, [detail, unitFilter, positionFilter]);

  const checkedCounts = useMemo(() => {
    let present = 0;
    let inactive = 0;
    let absent = 0;
    let unchecked = 0;
    for (const p of detail?.participants ?? []) {
      if (!p.checkin) unchecked += 1;
      else if (p.checkin.actualStatus === 'PRESENT') present += 1;
      else if (p.checkin.actualStatus === 'INACTIVE') inactive += 1;
      else if (p.checkin.actualStatus === 'ABSENT') absent += 1;
    }
    return { present, inactive, absent, unchecked };
  }, [detail]);

  if (!liveCheckinEnabled) {
    return (
      <section className="rounded-xl border border-sl-border bg-sl-surface p-10 text-center space-y-3">
        <CheckSquare className="w-9 h-9 text-sl-subtle mx-auto" />
        <h2 className="text-base font-semibold text-sl-heading">
          {isEn ? 'Live Check-In is disabled' : 'Live-Check-In ist nicht aktiviert'}
        </h2>
        <p className="text-xs text-sl-muted max-w-md mx-auto">
          {isEn
            ? 'Team Admins can enable on-field Soll-vs-Ist check-in in the team attendance settings.'
            : 'Team-Admins können das optionale Live-Check-In-Werkzeug für den Platzbetrieb in den Team-Einstellungen freischalten.'}
        </p>
        <button
          type="button"
          onClick={onOpenTeamSettings}
          className="px-4 py-2 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-semibold text-sl-accent-contrast"
        >
          {isEn ? 'Open Team Settings' : 'Team-Einstellungen öffnen'}
        </button>
      </section>
    );
  }

  async function handleTap(userUuid: string, status: CheckInStatus) {
    if (!detail) return;
    setBusyUserUuid(userUuid);
    setError(null);
    try {
      await onSaveCheckIn(detail.event.id, userUuid, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-In fehlgeschlagen.');
    } finally {
      setBusyUserUuid(null);
    }
  }

  const checkInButtons = [
    {
      status: 'PRESENT' as const,
      label: isEn ? 'Present' : 'Anwesend',
      Icon: Check,
      idleCls: STATUS_META.PRESENT.idleClass,
      activeCls: STATUS_META.PRESENT.activeClass,
    },
    {
      status: 'INACTIVE' as const,
      label: isEn ? 'Inactive' : 'Inaktiv',
      Icon: PauseCircle,
      idleCls: STATUS_META.INACTIVE.idleClass,
      activeCls: STATUS_META.INACTIVE.activeClass,
    },
    {
      status: 'ABSENT' as const,
      label: isEn ? 'Absent' : 'Abwesend',
      Icon: X,
      idleCls: STATUS_META.ABSENT.idleClass,
      activeCls: STATUS_META.ABSENT.activeClass,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Kopf- & Filterkarte + 4er-Ist-Kennzahlen */}
      <section className="rounded-xl border border-sl-border bg-sl-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-sl-heading">
            {isEn ? 'Live Field Check-In' : 'Live-Check-In'}
          </h2>

          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <select
              aria-label={isEn ? 'Select event for check-in' : 'Termin für Check-In wählen'}
              value={selectedEventId ?? ''}
              onChange={(e) => onSelectEvent(e.target.value)}
              className="min-h-[38px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading max-w-xs"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({formatEventDateRange(ev.startsAt, ev.endsAt, locale)})
                </option>
              ))}
            </select>

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
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-sl-border bg-sl-canvas px-3.5 py-2.5">
            <dt className="text-sl-muted">{isEn ? 'Actual Present' : 'Ist · Anwesend'}</dt>
            <dd className="mt-0.5 text-lg font-bold font-mono tabular-nums text-sl-success-text">
              {checkedCounts.present}
            </dd>
          </div>
          <div className="rounded-lg border border-sl-border bg-sl-canvas px-3.5 py-2.5">
            <dt className="text-sl-muted">{isEn ? 'Actual Inactive' : 'Ist · Inaktiv'}</dt>
            <dd className="mt-0.5 text-lg font-bold font-mono tabular-nums text-sl-primary">
              {checkedCounts.inactive}
            </dd>
          </div>
          <div className="rounded-lg border border-sl-border bg-sl-canvas px-3.5 py-2.5">
            <dt className="text-sl-muted">{isEn ? 'Actual Absent' : 'Ist · Abwesend'}</dt>
            <dd className="mt-0.5 text-lg font-bold font-mono tabular-nums text-sl-danger-text">
              {checkedCounts.absent}
            </dd>
          </div>
          <div className="rounded-lg border border-sl-border bg-sl-canvas px-3.5 py-2.5">
            <dt className="text-sl-muted">{isEn ? 'Not Checked Yet' : 'Noch offen'}</dt>
            <dd className="mt-0.5 text-lg font-bold font-mono tabular-nums text-sl-warning-text">
              {checkedCounts.unchecked}
            </dd>
          </div>
        </dl>
      </section>

      {error && <p className="text-xs text-sl-danger-text">{error}</p>}

      {loadingDetail ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center text-xs text-sl-muted">
          {isEn ? 'Loading check-in list…' : 'Check-In-Liste wird geladen…'}
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center text-xs text-sl-muted">
          {isEn ? 'No invited players for this filter.' : 'Keine eingeladenen Spieler für diesen Filter.'}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filteredParticipants.map(({ member, response, checkin }) => {
            const sollMeta = response ? STATUS_META[response.status] : null;
            const actual = checkin?.actualStatus ?? null;
            const hasDeviation =
              actual !== null && response !== null && actual !== response.status;

            return (
              <li
                key={member.userUuid}
                className="rounded-xl border border-sl-border bg-sl-surface px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-sl-heading truncate">
                      {member.trikotNummer && (
                        <span className="font-mono tabular-nums text-sl-muted font-normal mr-1.5">
                          #{member.trikotNummer}
                        </span>
                      )}
                      {member.vollerName}
                    </span>
                    {hasDeviation && (
                      <span className="inline-flex items-center gap-1 text-xs text-sl-warning-text font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {isEn ? 'Soll/Ist diff' : 'Abweichung zu Soll'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-sl-muted">
                    {member.units.join(', ')}
                    {member.position ? ` · ${member.position}` : ''}
                    {' · '}
                    <span>
                      Soll:{' '}
                      {sollMeta ? (
                        <span className={`font-medium ${sollMeta.textClass}`}>
                          {isEn ? sollMeta.labelEn : sollMeta.labelDe}
                        </span>
                      ) : (
                        <span className="text-sl-warning-text">
                          {isEn ? 'Open' : 'Offen'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 shrink-0 sm:w-[300px]">
                  {checkInButtons.map((btn) => {
                    const active = actual === btn.status;
                    return (
                      <button
                        key={btn.status}
                        type="button"
                        disabled={busyUserUuid === member.userUuid}
                        onClick={() => handleTap(member.userUuid, btn.status)}
                        className={`min-h-[52px] px-2.5 py-2 rounded-lg border text-[11px] font-medium flex flex-col items-center justify-center gap-1 whitespace-nowrap transition-colors duration-150 disabled:opacity-45 ${
                          active ? btn.activeCls : btn.idleCls
                        }`}
                      >
                        <btn.Icon className="w-4 h-4 shrink-0" />
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
