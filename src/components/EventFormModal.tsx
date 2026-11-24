import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';
import { collectAvailablePositions, resolveInvitedUserUuids } from '../services/targeting.ts';
import type {
  AttendanceEvent,
  EventCategory,
  RecurrenceKind,
  RosterMember,
} from '../types.ts';
import type { SaveEventPayload } from '../api/attendanceApi.ts';

function toLocalDateTimeInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600_000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormModal({
  season,
  defaultCutoffMinutes,
  roster,
  editingEvent,
  locale = 'de',
  onClose,
  onSave,
}: {
  season: string;
  defaultCutoffMinutes: number;
  roster: RosterMember[];
  editingEvent?: AttendanceEvent | null;
  locale?: string;
  onClose: () => void;
  onSave: (payload: SaveEventPayload, eventId?: string) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const availablePositions = useMemo(() => collectAvailablePositions(roster), [roster]);

  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [description, setDescription] = useState(editingEvent?.description ?? '');
  const [category, setCategory] = useState<EventCategory>(editingEvent?.category ?? 'TRAINING');
  const [location, setLocation] = useState(editingEvent?.location ?? '');
  const [startsAtLocal, setStartsAtLocal] = useState(
    editingEvent ? toLocalDateTimeInput(editingEvent.startsAt) : toLocalDateTimeInput()
  );
  const [endsAtLocal, setEndsAtLocal] = useState(
    editingEvent
      ? toLocalDateTimeInput(editingEvent.endsAt)
      : toLocalDateTimeInput(new Date(Date.now() + 26 * 3600_000).toISOString())
  );

  const [useCutoffOverride, setUseCutoffOverride] = useState(
    editingEvent?.cutoffMinutesOverride !== null && editingEvent?.cutoffMinutesOverride !== undefined
  );
  const [cutoffHours, setCutoffHours] = useState(
    editingEvent?.cutoffMinutesOverride !== null && editingEvent?.cutoffMinutesOverride !== undefined
      ? String(Math.round((editingEvent.cutoffMinutesOverride / 60) * 10) / 10)
      : String(Math.round((defaultCutoffMinutes / 60) * 10) / 10)
  );

  const [targetAll, setTargetAll] = useState(editingEvent ? editingEvent.targetAll : true);
  const [targetUnits, setTargetUnits] = useState<SpielerUnit[]>(editingEvent?.targetUnits ?? []);
  const [targetPositions, setTargetPositions] = useState<string[]>(
    editingEvent?.targetPositions ?? []
  );
  const [targetRoles, setTargetRoles] = useState<TeamRolle[]>(editingEvent?.targetRoles ?? []);
  const [targetUserUuids, setTargetUserUuids] = useState<string[]>(
    editingEvent?.targetUserUuids ?? []
  );

  const [recurrenceKind, setRecurrenceKind] = useState<RecurrenceKind>('NONE');
  const [untilDate, setUntilDate] = useState('');

  const [attachments, setAttachments] = useState<Array<{ title: string; url: string }>>([]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewInvitedCount = useMemo(() => {
    return resolveInvitedUserUuids(roster, {
      targetAll,
      targetUnits,
      targetPositions,
      targetRoles,
      targetUserUuids,
    }).length;
  }, [roster, targetAll, targetUnits, targetPositions, targetRoles, targetUserUuids]);

  function toggleItem<T>(list: T[], value: T, setter: (next: T[]) => void) {
    if (list.includes(value)) {
      setter(list.filter((item) => item !== value));
    } else {
      setter([...list, value]);
    }
  }

  function handleAddInitialLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setAttachments([...attachments, { title: linkTitle.trim(), url: linkUrl.trim() }]);
    setLinkTitle('');
    setLinkUrl('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(isEn ? 'Title is required.' : 'Bitte einen Titel eingeben.');
      return;
    }

    const startDate = new Date(startsAtLocal);
    const endDate = new Date(endsAtLocal);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
      setError(
        isEn ? 'End time must be after start time.' : 'Endzeit muss nach der Startzeit liegen.'
      );
      return;
    }

    const parsedHours = Number.parseFloat(cutoffHours.replace(',', '.'));
    const cutoffMinutesOverride = useCutoffOverride
      ? Number.isFinite(parsedHours) && parsedHours >= 0
        ? Math.round(parsedHours * 60)
        : 0
      : null;

    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          location: location.trim(),
          season,
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          cutoffMinutesOverride,
          targetAll,
          targetUnits,
          targetPositions,
          targetRoles,
          targetUserUuids,
          ...(editingEvent ? {} : { recurrenceKind, untilDate: recurrenceKind === 'NONE' ? undefined : untilDate }),
          ...(editingEvent ? {} : { attachments }),
        },
        editingEvent?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#12171d] p-6 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <h2 className="text-base font-semibold text-white">
            {editingEvent
              ? isEn
                ? 'Edit Event'
                : 'Termin bearbeiten'
              : isEn
                ? 'Create Event or Series'
                : 'Neuen Termin oder Serie anlegen'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs text-slate-400">
                {isEn ? 'Title' : 'Titel'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isEn ? 'e.g. Defense Positional Meeting' : 'z. B. Team-Training / Defense Meeting'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">
                {isEn ? 'Category' : 'Kategorie'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              >
                <option value="TRAINING">{isEn ? 'Practice' : 'Training'}</option>
                <option value="MEETING">Meeting</option>
                <option value="GAME">{isEn ? 'Game' : 'Spiel'}</option>
                <option value="OTHER">{isEn ? 'Other' : 'Sonstiges'}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">
                {isEn ? 'Location' : 'Ort / Platz'}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={isEn ? 'Field A / Meeting Room' : 'Hauptplatz / Besprechungsraum'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{isEn ? 'Start' : 'Beginn'}</label>
              <input
                type="datetime-local"
                required
                value={startsAtLocal}
                onChange={(e) => setStartsAtLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">{isEn ? 'End' : 'Ende'}</label>
              <input
                type="datetime-local"
                required
                value={endsAtLocal}
                onChange={(e) => setEndsAtLocal(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs text-slate-400">
                {isEn ? 'Description / Notes' : 'Beschreibung / Hinweise'}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isEn ? 'Full pads, bring playbook...' : 'Ausrüstung, Treffpunkt, Ablauf…'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {!editingEvent && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                {isEn ? 'Series (creates individual events)' : 'Terminserie (erzeugt einzelne Pflicht-Termine)'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={recurrenceKind}
                  onChange={(e) => setRecurrenceKind(e.target.value as RecurrenceKind)}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
                >
                  <option value="NONE">{isEn ? 'Single event' : 'Einzeltermin'}</option>
                  <option value="WEEKLY">{isEn ? 'Weekly' : 'Wöchentlich'}</option>
                  <option value="BIWEEKLY">{isEn ? 'Bi-weekly' : 'Alle 2 Wochen'}</option>
                </select>
                {recurrenceKind !== 'NONE' && (
                  <input
                    type="date"
                    required
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    aria-label={isEn ? 'Series end date' : 'Serien-Enddatum'}
                    className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
                  />
                )}
              </div>
            </div>
          )}

          {/* Zielgruppen-Einladung über Core-Units, spezifische Positionen, Rollen & Einzelnutzer */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">
                {isEn ? 'Target Audience' : 'Zielgruppe & Einladungen'}
              </span>
              <span className="text-xs font-mono tabular-nums text-sky-400">
                {previewInvitedCount} {isEn ? 'members invited' : 'Personen eingeladen'}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                checked={targetAll}
                onChange={(e) => setTargetAll(e.target.checked)}
                className="rounded border-slate-700 bg-[#0b0e11]"
              />
              <span>{isEn ? 'Invite entire active team' : 'Gesamtes aktives Team einladen'}</span>
            </label>

            {!targetAll && (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-[#0b0e11] p-3.5">
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400">Core-Units</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['OFFENSE', 'DEFENSE', 'SPECIAL_TEAMS'] as SpielerUnit[]).map((unit) => {
                      const active = targetUnits.includes(unit);
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => toggleItem(targetUnits, unit, setTargetUnits)}
                          className={`px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap ${
                            active
                              ? 'bg-sky-600 border-sky-500 text-white'
                              : 'border-slate-800 bg-[#12171d] text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {unit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400">
                    {isEn ? 'Specific Positions' : 'Spezifische Positionen'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availablePositions.map((pos) => {
                      const active = targetPositions.includes(pos);
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => toggleItem(targetPositions, pos, setTargetPositions)}
                          className={`px-2 py-1 rounded-md border text-xs font-mono whitespace-nowrap ${
                            active
                              ? 'bg-sky-600 border-sky-500 text-white'
                              : 'border-slate-800 bg-[#12171d] text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {pos}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400">{isEn ? 'Roles' : 'Team-Rollen'}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(['TEAM_ADMIN', 'COACH', 'PLAYER'] as TeamRolle[]).map((r) => {
                      const active = targetRoles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => toggleItem(targetRoles, r, setTargetRoles)}
                          className={`px-2.5 py-1.5 rounded-md border text-xs font-medium whitespace-nowrap ${
                            active
                              ? 'bg-sky-600 border-sky-500 text-white'
                              : 'border-slate-800 bg-[#12171d] text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {roster.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-slate-400">
                      {isEn ? 'Individual Members (optional)' : 'Einzelpersonen (optional, z. B. Captains)'}
                    </span>
                    <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                      {roster
                        .filter((m) => m.status === 'AKTIV')
                        .map((m) => (
                          <label
                            key={m.userUuid}
                            className="flex items-center gap-2 px-2 py-1 rounded border border-slate-800/80 text-xs text-slate-200 cursor-pointer hover:bg-slate-800/40"
                          >
                            <input
                              type="checkbox"
                              checked={targetUserUuids.includes(m.userUuid)}
                              onChange={() =>
                                toggleItem(targetUserUuids, m.userUuid, setTargetUserUuids)
                              }
                            />
                            <span className="truncate">
                              {m.trikotNummer ? `#${m.trikotNummer} ` : ''}
                              {m.vollerName}
                            </span>
                            {m.position && (
                              <span className="ml-auto text-slate-500 font-mono">{m.position}</span>
                            )}
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Frist-Override */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useCutoffOverride}
                onChange={(e) => setUseCutoffOverride(e.target.checked)}
              />
              <span>
                {isEn
                  ? 'Override team response deadline for this event'
                  : 'Team-Standardfrist für diesen Termin überschreiben'}
              </span>
            </label>
            {useCutoffOverride && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={cutoffHours}
                  onChange={(e) => setCutoffHours(e.target.value)}
                  className="w-28 px-3 py-1.5 text-sm font-mono tabular-nums rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
                />
                <span className="text-xs text-slate-400">
                  {isEn ? 'hours before start' : 'Stunden vor Terminbeginn'}
                </span>
              </div>
            )}
          </div>

          {/* Initiale Link-Anhänge */}
          {!editingEvent && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="block text-xs font-medium text-slate-300">
                {isEn ? 'Initial Web Links (optional)' : 'Links anhängen (optional)'}
              </span>
              {attachments.length > 0 && (
                <ul className="space-y-1">
                  {attachments.map((att, idx) => (
                    <li
                      key={`${att.url}-${idx}`}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-[#0b0e11] border border-slate-800 text-xs text-slate-200"
                    >
                      <span className="truncate">
                        {att.title} · <span className="text-slate-400">{att.url}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2">
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder={isEn ? 'Link title' : 'Link-Titel'}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
                />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
                />
                <button
                  type="button"
                  onClick={handleAddInitialLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Add' : 'Hinzufügen'}</span>
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-medium text-slate-300 hover:text-white"
            >
              {isEn ? 'Cancel' : 'Abbrechen'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white disabled:opacity-50"
            >
              {saving
                ? isEn
                  ? 'Saving…'
                  : 'Speichert…'
                : editingEvent
                  ? isEn
                    ? 'Save changes'
                    : 'Änderungen speichern'
                  : isEn
                    ? 'Create Event'
                    : 'Termin anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
