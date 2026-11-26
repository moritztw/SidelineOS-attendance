import { useState } from 'react';
import { Briefcase, CalendarOff, HeartPulse, Plane, Plus, Trash2 } from 'lucide-react';
import type { AbsenceReasonType, LongTermAbsence, RosterMember } from '../types.ts';

const REASON_META: Record<
  AbsenceReasonType,
  {
    de: string;
    en: string;
    Icon: typeof Plane;
    tileClass: string;
  }
> = {
  VACATION: {
    de: 'Urlaub',
    en: 'Vacation',
    Icon: Plane,
    tileClass: 'bg-sl-accent/15 text-sl-accent border-sl-accent/30',
  },
  INJURY: {
    de: 'Verletzung',
    en: 'Injury',
    Icon: HeartPulse,
    tileClass: 'bg-sl-danger/12 text-sl-danger-text border-sl-danger/30',
  },
  PERSONAL: {
    de: 'Privat / Beruf',
    en: 'Personal / Work',
    Icon: Briefcase,
    tileClass: 'bg-sl-elevated text-sl-primary border-sl-border-strong',
  },
};

export function AbsencesView({
  absences,
  roster,
  currentUserUuid,
  isStaff,
  locale = 'de',
  onCreateAbsence,
  onDeleteAbsence,
}: {
  absences: LongTermAbsence[];
  roster: RosterMember[];
  currentUserUuid: string;
  isStaff: boolean;
  locale?: string;
  onCreateAbsence: (payload: {
    reasonType: AbsenceReasonType;
    reasonText: string;
    startsOn: string;
    endsOn: string;
    targetUserUuid?: string;
  }) => Promise<{ autoUpdatedEvents: number }>;
  onDeleteAbsence: (absenceId: string) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const [reasonType, setReasonType] = useState<AbsenceReasonType>('VACATION');
  const [reasonText, setReasonText] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [targetUserUuid, setTargetUserUuid] = useState(currentUserUuid);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberNameMap = new Map(roster.map((m) => [m.userUuid, m.vollerName]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsOn || !endsOn) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await onCreateAbsence({
        reasonType,
        reasonText: reasonText.trim(),
        startsOn,
        endsOn,
        ...(isStaff && targetUserUuid !== currentUserUuid ? { targetUserUuid } : {}),
      });
      setReasonText('');
      setStartsOn('');
      setEndsOn('');
      setNotice(
        isEn
          ? `Absence saved. ${res.autoUpdatedEvents} upcoming event(s) automatically marked as Absent.`
          : `Abwesenheit gespeichert. ${res.autoUpdatedEvents} anstehende(r) Termin(e) automatisch auf Abwesend gesetzt.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Linke Spalte: Langzeitabwesenheit erfassen */}
      <section className="lg:col-span-5 rounded-xl border border-sl-border bg-sl-surface p-6 space-y-5">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-sl-heading">
            {isEn ? 'Register Long-Term Absence' : 'Langzeitabwesenheit hinterlegen'}
          </h2>
          <p className="text-xs text-sl-muted leading-relaxed">
            {isEn
              ? 'Upcoming invited events in this period are automatically set to Absent unless manually overridden.'
              : 'Anstehende eingeladene Termine in diesem Zeitraum werden automatisch auf „Abwesend“ gesetzt, sofern kein manueller Override erfolgt.'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isStaff && (
            <label className="block space-y-1.5 text-xs text-sl-muted">
              <span className="font-medium text-sl-primary">
                {isEn ? 'Team Member' : 'Mitglied'}
              </span>
              <select
                value={targetUserUuid}
                onChange={(e) => setTargetUserUuid(e.target.value)}
                className="w-full min-h-[38px] px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
              >
                <option value={currentUserUuid}>{isEn ? 'Myself' : 'Für mich selbst'}</option>
                {roster
                  .filter((m) => m.status === 'AKTIV' && m.userUuid !== currentUserUuid)
                  .map((m) => (
                    <option key={m.userUuid} value={m.userUuid}>
                      {m.vollerName}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-sl-primary">
              {isEn ? 'Reason' : 'Grund'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['VACATION', 'INJURY', 'PERSONAL'] as AbsenceReasonType[]).map((type) => {
                const meta = REASON_META[type];
                const Icon = meta.Icon;
                const active = reasonType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setReasonType(type)}
                    className={`min-h-[60px] px-2.5 py-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1.5 transition-colors ${
                      active
                        ? 'border-sl-accent bg-sl-accent/15 text-sl-accent ring-1 ring-sl-accent/40'
                        : 'border-sl-border bg-sl-canvas text-sl-primary hover:border-sl-border-strong hover:text-sl-heading'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-full">{isEn ? meta.en : meta.de}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-xs text-sl-muted">
              <span className="font-medium text-sl-primary">
                {isEn ? 'From' : 'Von'}
              </span>
              <input
                type="date"
                required
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                aria-label={isEn ? 'Start date' : 'Startdatum'}
                className="w-full min-h-[38px] px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
              />
            </label>

            <label className="block space-y-1.5 text-xs text-sl-muted">
              <span className="font-medium text-sl-primary">
                {isEn ? 'To' : 'Bis'}
              </span>
              <input
                type="date"
                required
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
                aria-label={isEn ? 'End date' : 'Enddatum'}
                className="w-full min-h-[38px] px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-sl-border bg-sl-canvas text-sl-heading"
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-xs text-sl-muted">
            <span className="font-medium text-sl-primary">
              {isEn ? 'Note (optional)' : 'Begründung (optional)'}
            </span>
            <textarea
              rows={2}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={isEn ? 'e.g. Summer vacation, knee rehab…' : 'z. B. Sommerurlaub, Reha…'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-sl-border bg-sl-canvas text-sl-heading placeholder:text-sl-subtle focus:outline-none focus:border-sl-accent resize-y"
            />
          </label>

          <button
            type="submit"
            disabled={busy || !startsOn || !endsOn}
            className="w-full min-h-[42px] px-4 py-2.5 rounded-lg bg-sl-accent hover:bg-sl-accent-hover text-xs font-semibold text-sl-accent-contrast inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:opacity-45"
          >
            <Plus className="w-4 h-4" />
            <span>{isEn ? 'Save Absence' : 'Zeitraum eintragen'}</span>
          </button>
        </form>

        {notice && <p className="text-xs text-sl-success-text">{notice}</p>}
        {error && <p className="text-xs text-sl-danger-text">{error}</p>}
      </section>

      {/* Rechte Spalte: Hinterlegte Abwesenheitszeiträume */}
      <section className="lg:col-span-7 rounded-xl border border-sl-border bg-sl-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-sl-border flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-sl-heading">
              {isEn ? 'Registered Absences' : 'Hinterlegte Abwesenheitszeiträume'}
            </h3>
            <p className="text-xs text-sl-muted">
              {isEn
                ? 'Active and planned absences across your scope'
                : 'Aktive und geplante Zeiträume im Überblick'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-sl-elevated border border-sl-border text-xs font-mono tabular-nums font-semibold text-sl-heading">
            {absences.length}
          </span>
        </div>

        {absences.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <CalendarOff className="w-8 h-8 text-sl-subtle mx-auto" />
            <p className="text-sm font-medium text-sl-heading">
              {isEn ? 'No absences recorded yet.' : 'Aktuell sind keine Abwesenheiten eingetragen.'}
            </p>
            <p className="text-xs text-sl-muted">
              {isEn
                ? 'Add vacation, injury, or personal timeframes on the left.'
                : 'Trage links Urlaubs-, Verletzungs- oder Privatzeiträume ein.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-sl-border">
            {absences.map((abs) => {
              const ownerName = memberNameMap.get(abs.userUuid) ?? abs.userUuid;
              const meta = REASON_META[abs.reasonType] ?? REASON_META.PERSONAL;
              const Icon = meta.Icon;
              const canDelete = isStaff || abs.userUuid === currentUserUuid;

              return (
                <li
                  key={abs.id}
                  className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-sl-elevated/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span
                      aria-hidden="true"
                      className={`w-10 h-10 rounded-xl border inline-flex items-center justify-center shrink-0 ${meta.tileClass}`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-semibold text-sl-heading">{ownerName}</span>
                        <span aria-hidden="true" className="text-sl-subtle">·</span>
                        <span className="text-xs text-sl-muted">
                          {isEn ? meta.en : meta.de}
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-sl-primary">
                        {abs.startsOn} → {abs.endsOn}
                      </div>
                      {abs.reasonText && (
                        <p className="text-xs text-sl-muted truncate">{abs.reasonText}</p>
                      )}
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteAbsence(abs.id)}
                      aria-label={isEn ? 'Delete absence' : 'Abwesenheit löschen'}
                      className="p-2 rounded-lg border border-transparent text-sl-muted hover:text-sl-danger-text hover:bg-sl-danger/10 hover:border-sl-danger/30 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
