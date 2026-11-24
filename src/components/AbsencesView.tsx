import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import type { AbsenceReasonType, LongTermAbsence, RosterMember } from '../types.ts';

const REASON_LABELS: Record<AbsenceReasonType, { de: string; en: string }> = {
  VACATION: { de: 'Urlaub', en: 'Vacation' },
  INJURY: { de: 'Verletzung', en: 'Injury' },
  PERSONAL: { de: 'Privat / Beruf', en: 'Personal / Work' },
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
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800 bg-[#12171d] p-5 space-y-4">
        <header className="space-y-1">
          <h2 className="text-base font-semibold text-white">
            {isEn ? 'Register Long-Term Absence' : 'Langzeitabwesenheit hinterlegen'}
          </h2>
          <p className="text-xs text-slate-400">
            {isEn
              ? 'Upcoming invited events in this period are automatically set to Absent unless manually overridden.'
              : 'Anstehende eingeladene Termine in diesem Zeitraum werden automatisch auf „Abwesend“ gesetzt, sofern kein manueller Override erfolgt.'}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {isStaff && (
            <select
              value={targetUserUuid}
              onChange={(e) => setTargetUserUuid(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
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
          )}

          <select
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value as AbsenceReasonType)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
          >
            {(['VACATION', 'INJURY', 'PERSONAL'] as AbsenceReasonType[]).map((type) => (
              <option key={type} value={type}>
                {isEn ? REASON_LABELS[type].en : REASON_LABELS[type].de}
              </option>
            ))}
          </select>

          <input
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            aria-label={isEn ? 'Start date' : 'Startdatum'}
            className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
          />

          <input
            type="date"
            required
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            aria-label={isEn ? 'End date' : 'Enddatum'}
            className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
          />

          <input
            type="text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={isEn ? 'Reason / Note' : 'Begründung (z. B. Sommerurlaub)'}
            className={`px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white ${
              isStaff ? 'lg:col-span-4' : 'sm:col-span-2 lg:col-span-1'
            }`}
          />

          <button
            type="submit"
            disabled={busy || !startsOn || !endsOn}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-45"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? 'Save Absence' : 'Zeitraum eintragen'}</span>
          </button>
        </form>

        {notice && <p className="text-xs text-emerald-400">{notice}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#12171d] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            {isEn ? 'Registered Absences' : 'Hinterlegte Abwesenheitszeiträume'}
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-400">{absences.length}</span>
        </div>

        {absences.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CalendarOff className="w-7 h-7 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">
              {isEn ? 'No absences recorded yet.' : 'Aktuell sind keine Abwesenheiten eingetragen.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {absences.map((abs) => {
              const ownerName = memberNameMap.get(abs.userUuid) ?? abs.userUuid;
              const label = isEn
                ? REASON_LABELS[abs.reasonType].en
                : REASON_LABELS[abs.reasonType].de;
              const canDelete = isStaff || abs.userUuid === currentUserUuid;

              return (
                <li key={abs.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                      <span className="font-medium text-slate-200">{ownerName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {abs.startsOn} → {abs.endsOn}
                      </span>
                    </div>
                    {abs.reasonText && (
                      <p className="text-xs text-slate-400 truncate">{abs.reasonText}</p>
                    )}
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteAbsence(abs.id)}
                      aria-label={isEn ? 'Delete absence' : 'Abwesenheit löschen'}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/60 shrink-0"
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
