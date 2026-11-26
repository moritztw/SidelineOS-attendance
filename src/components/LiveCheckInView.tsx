import { useEffect, useMemo, useState } from 'react';
import { Check, CheckSquare, PauseCircle, X } from 'lucide-react';
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

  if (!liveCheckinEnabled) {
    return (
      <section className="rounded-xl border border-sl-border bg-sl-surface p-8 text-center space-y-3">
        <CheckSquare className="w-8 h-8 text-sl-subtle mx-auto" />
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
          className="px-4 py-2 rounded-lg border border-sl-border bg-sl-elevated hover:border-sl-border-strong text-xs font-medium text-sl-heading"
        >
          {isEn ? 'Open Team Settings' : 'Team-Einstellungen öffnen'}
        </button>
      </section>
    );
  }

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sl-border bg-sl-surface p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <select
            aria-label={isEn ? 'Select event for check-in' : 'Termin für Check-In wählen'}
            value={selectedEventId ?? ''}
            onChange={(e) => onSelectEvent(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading max-w-xs"
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
        </div>

        <div className="text-xs font-mono tabular-nums text-sl-primary">
          Ist: <span className="text-sl-success-text">{checkedCounts.present} Anwesend</span> ·{' '}
          <span className="text-sl-warning-text">{checkedCounts.inactive} Inaktiv</span> ·{' '}
          <span className="text-sl-danger-text">{checkedCounts.absent} Abwesend</span> ·{' '}
          <span className="text-sl-muted">{checkedCounts.unchecked} Offen</span>
        </div>
      </div>

      {error && <p className="text-xs text-sl-danger-text">{error}</p>}

      {loadingDetail ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-6 text-xs text-sl-muted">
          {isEn ? 'Loading check-in list…' : 'Check-In-Liste wird geladen…'}
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="rounded-xl border border-sl-border bg-sl-surface p-6 text-xs text-sl-muted">
          {isEn ? 'No invited players for this filter.' : 'Keine eingeladenen Spieler für diesen Filter.'}
        </div>
      ) : (
        <ul className="divide-y divide-sl-border rounded-xl border border-sl-border bg-sl-surface overflow-hidden">
          {filteredParticipants.map(({ member, response, checkin }) => {
            const sollMeta = response ? STATUS_META[response.status] : null;
            const actual = checkin?.actualStatus ?? null;
            const hasDeviation =
              actual !== null && response !== null && actual !== response.status;

            return (
              <li
                key={member.userUuid}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-sl-heading truncate">
                      {member.trikotNummer && (
                        <span className="font-mono tabular-nums text-sl-muted mr-1.5">
                          #{member.trikotNummer}
                        </span>
                      )}
                      {member.vollerName}
                    </span>
                    {hasDeviation && (
                      <span className="text-xs text-sl-warning-text font-medium">
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
                        <span className={sollMeta.textClass}>
                          {isEn ? sollMeta.labelEn : sollMeta.labelDe}
                        </span>
                      ) : (
                        'Offen'
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 shrink-0">
                  {(
                    [
                      { status: 'PRESENT', label: isEn ? 'Present' : 'Anwesend', Icon: Check, cls: 'bg-sl-success border-sl-success text-white' },
                      { status: 'INACTIVE', label: isEn ? 'Inactive' : 'Inaktiv', Icon: PauseCircle, cls: 'bg-sl-warning-text/15 border-sl-warning-text text-sl-warning-text' },
                      { status: 'ABSENT', label: isEn ? 'Absent' : 'Abwesend', Icon: X, cls: 'bg-sl-danger border-sl-danger text-white' },
                    ] as const
                  ).map((btn) => {
                    const active = actual === btn.status;
                    return (
                      <button
                        key={btn.status}
                        type="button"
                        disabled={busyUserUuid === member.userUuid}
                        onClick={() => handleTap(member.userUuid, btn.status)}
                        className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          active
                            ? btn.cls
                            : 'border-sl-border bg-sl-canvas text-sl-primary hover:border-sl-border-strong'
                        }`}
                      >
                        <btn.Icon className="w-3.5 h-3.5" />
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
