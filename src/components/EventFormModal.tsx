import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2, PanelTop, Plus, Trash2, X } from 'lucide-react';
import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';
import type { SaveEventPayload } from '../api/attendanceApi.ts';
import { collectAvailablePositions, resolveInvitedUserUuids } from '../services/targeting.ts';
import type {
  AttendanceEvent,
  EventCategory,
  RecurrenceKind,
  RosterMember,
} from '../types.ts';

function toLocalDateTimeInput(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600_000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface EventFormDraft {
  editingEventId: string | null;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startsAtLocal: string;
  endsAtLocal: string;
  useCutoffOverride: boolean;
  cutoffHours: string;
  targetAll: boolean;
  targetUnits: SpielerUnit[];
  targetPositions: string[];
  targetRoles: TeamRolle[];
  targetUserUuids: string[];
  recurrenceKind: RecurrenceKind;
  untilDate: string;
  attachments: Array<{ title: string; url: string }>;
}

export function createEventFormDraft(
  defaultCutoffMinutes: number,
  editingEvent?: AttendanceEvent | null
): EventFormDraft {
  const hasOverride =
    editingEvent?.cutoffMinutesOverride !== null &&
    editingEvent?.cutoffMinutesOverride !== undefined;

  return {
    editingEventId: editingEvent?.id ?? null,
    title: editingEvent?.title ?? '',
    description: editingEvent?.description ?? '',
    category: editingEvent?.category ?? 'TRAINING',
    location: editingEvent?.location ?? '',
    startsAtLocal: editingEvent
      ? toLocalDateTimeInput(editingEvent.startsAt)
      : toLocalDateTimeInput(),
    endsAtLocal: editingEvent
      ? toLocalDateTimeInput(editingEvent.endsAt)
      : toLocalDateTimeInput(new Date(Date.now() + 26 * 3600_000).toISOString()),
    useCutoffOverride: hasOverride,
    cutoffHours: hasOverride
      ? String(Math.round(((editingEvent?.cutoffMinutesOverride ?? 0) / 60) * 10) / 10)
      : String(Math.round((defaultCutoffMinutes / 60) * 10) / 10),
    targetAll: editingEvent ? editingEvent.targetAll : true,
    targetUnits: editingEvent?.targetUnits ?? [],
    targetPositions: editingEvent?.targetPositions ?? [],
    targetRoles: editingEvent?.targetRoles ?? [],
    targetUserUuids: editingEvent?.targetUserUuids ?? [],
    recurrenceKind: 'NONE',
    untilDate: '',
    attachments: [],
  };
}

function EventFormFields({
  draft,
  onDraftChange,
  roster,
  locale = 'de',
}: {
  draft: EventFormDraft;
  onDraftChange: (next: EventFormDraft) => void;
  roster: RosterMember[];
  locale?: string;
}) {
  const isEn = locale.startsWith('en');
  const availablePositions = useMemo(() => collectAvailablePositions(roster), [roster]);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const isEditing = draft.editingEventId !== null;

  const previewInvitedCount = useMemo(() => {
    return resolveInvitedUserUuids(roster, {
      targetAll: draft.targetAll,
      targetUnits: draft.targetUnits,
      targetPositions: draft.targetPositions,
      targetRoles: draft.targetRoles,
      targetUserUuids: draft.targetUserUuids,
    }).length;
  }, [
    roster,
    draft.targetAll,
    draft.targetUnits,
    draft.targetPositions,
    draft.targetRoles,
    draft.targetUserUuids,
  ]);

  function toggleArrayField<K extends 'targetUnits' | 'targetPositions' | 'targetRoles' | 'targetUserUuids'>(
    key: K,
    value: EventFormDraft[K][number]
  ) {
    const current = draft[key] as Array<EventFormDraft[K][number]>;
    const updated = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onDraftChange({ ...draft, [key]: updated });
  }

  function handleAddInitialLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    onDraftChange({
      ...draft,
      attachments: [...draft.attachments, { title: linkTitle.trim(), url: linkUrl.trim() }],
    });
    setLinkTitle('');
    setLinkUrl('');
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs text-slate-400">{isEn ? 'Title' : 'Titel'}</label>
          <input
            type="text"
            required
            value={draft.title}
            onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
            placeholder={
              isEn
                ? 'e.g. Defense Positional Meeting'
                : 'z. B. Team-Training / Defense Meeting'
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-slate-400">
            {isEn ? 'Category' : 'Kategorie'}
          </label>
          <select
            value={draft.category}
            onChange={(e) =>
              onDraftChange({ ...draft, category: e.target.value as EventCategory })
            }
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
            value={draft.location}
            onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
            placeholder={isEn ? 'Field A / Meeting Room' : 'Hauptplatz / Besprechungsraum'}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-slate-400">{isEn ? 'Start' : 'Beginn'}</label>
          <input
            type="datetime-local"
            required
            value={draft.startsAtLocal}
            onChange={(e) => onDraftChange({ ...draft, startsAtLocal: e.target.value })}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs text-slate-400">{isEn ? 'End' : 'Ende'}</label>
          <input
            type="datetime-local"
            required
            value={draft.endsAtLocal}
            onChange={(e) => onDraftChange({ ...draft, endsAtLocal: e.target.value })}
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs text-slate-400">
            {isEn ? 'Description / Notes' : 'Beschreibung / Hinweise'}
          </label>
          <textarea
            rows={2}
            value={draft.description}
            onChange={(e) => onDraftChange({ ...draft, description: e.target.value })}
            placeholder={isEn ? 'Full pads, bring playbook...' : 'Ausrüstung, Treffpunkt, Ablauf…'}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {!isEditing && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            {isEn
              ? 'Series (creates individual events)'
              : 'Terminserie (erzeugt einzelne Pflicht-Termine)'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={draft.recurrenceKind}
              onChange={(e) =>
                onDraftChange({ ...draft, recurrenceKind: e.target.value as RecurrenceKind })
              }
              className="px-3 py-2 text-sm rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            >
              <option value="NONE">{isEn ? 'Single event' : 'Einzeltermin'}</option>
              <option value="WEEKLY">{isEn ? 'Weekly' : 'Wöchentlich'}</option>
              <option value="BIWEEKLY">{isEn ? 'Bi-weekly' : 'Alle 2 Wochen'}</option>
            </select>
            {draft.recurrenceKind !== 'NONE' && (
              <input
                type="date"
                required
                value={draft.untilDate}
                onChange={(e) => onDraftChange({ ...draft, untilDate: e.target.value })}
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
            checked={draft.targetAll}
            onChange={(e) => onDraftChange({ ...draft, targetAll: e.target.checked })}
            className="rounded border-slate-700 bg-[#0b0e11]"
          />
          <span>
            {isEn ? 'Invite entire active team' : 'Gesamtes aktives Team einladen'}
          </span>
        </label>

        {!draft.targetAll && (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-[#0b0e11] p-3.5">
            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">Core-Units</span>
              <div className="flex flex-wrap gap-1.5">
                {(['OFFENSE', 'DEFENSE', 'SPECIAL_TEAMS'] as SpielerUnit[]).map((unit) => {
                  const active = draft.targetUnits.includes(unit);
                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => toggleArrayField('targetUnits', unit)}
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
                  const active = draft.targetPositions.includes(pos);
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => toggleArrayField('targetPositions', pos)}
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
                  const active = draft.targetRoles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleArrayField('targetRoles', r)}
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
                  {isEn
                    ? 'Individual Members (optional)'
                    : 'Einzelpersonen (optional, z. B. Captains)'}
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
                          checked={draft.targetUserUuids.includes(m.userUuid)}
                          onChange={() => toggleArrayField('targetUserUuids', m.userUuid)}
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
            checked={draft.useCutoffOverride}
            onChange={(e) =>
              onDraftChange({ ...draft, useCutoffOverride: e.target.checked })
            }
          />
          <span>
            {isEn
              ? 'Override team response deadline for this event'
              : 'Team-Standardfrist für diesen Termin überschreiben'}
          </span>
        </label>
        {draft.useCutoffOverride && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.5"
              value={draft.cutoffHours}
              onChange={(e) => onDraftChange({ ...draft, cutoffHours: e.target.value })}
              className="w-28 px-3 py-1.5 text-sm font-mono tabular-nums rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            />
            <span className="text-xs text-slate-400">
              {isEn ? 'hours before start' : 'Stunden vor Terminbeginn'}
            </span>
          </div>
        )}
      </div>

      {/* Initiale Link-Anhänge */}
      {!isEditing && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <span className="block text-xs font-medium text-slate-300">
            {isEn ? 'Initial Web Links (optional)' : 'Links anhängen (optional)'}
          </span>
          {draft.attachments.length > 0 && (
            <ul className="space-y-1">
              {draft.attachments.map((att, idx) => (
                <li
                  key={`${att.url}-${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded bg-[#0b0e11] border border-slate-800 text-xs text-slate-200"
                >
                  <span className="truncate">
                    {att.title} · <span className="text-slate-400">{att.url}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onDraftChange({
                        ...draft,
                        attachments: draft.attachments.filter((_, i) => i !== idx),
                      })
                    }
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
    </div>
  );
}

function buildSavePayload(
  draft: EventFormDraft,
  season: string,
  isEn: boolean
): { payload?: SaveEventPayload; error?: string } {
  if (!draft.title.trim()) {
    return { error: isEn ? 'Title is required.' : 'Bitte einen Titel eingeben.' };
  }

  const startDate = new Date(draft.startsAtLocal);
  const endDate = new Date(draft.endsAtLocal);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return {
      error: isEn
        ? 'End time must be after start time.'
        : 'Endzeit muss nach der Startzeit liegen.',
    };
  }

  const parsedHours = Number.parseFloat(draft.cutoffHours.replace(',', '.'));
  const cutoffMinutesOverride = draft.useCutoffOverride
    ? Number.isFinite(parsedHours) && parsedHours >= 0
      ? Math.round(parsedHours * 60)
      : 0
    : null;

  const isEditing = draft.editingEventId !== null;
  return {
    payload: {
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      location: draft.location.trim(),
      season,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      cutoffMinutesOverride,
      targetAll: draft.targetAll,
      targetUnits: draft.targetUnits,
      targetPositions: draft.targetPositions,
      targetRoles: draft.targetRoles,
      targetUserUuids: draft.targetUserUuids,
      ...(isEditing
        ? {}
        : {
            recurrenceKind: draft.recurrenceKind,
            untilDate: draft.recurrenceKind === 'NONE' ? undefined : draft.untilDate,
          }),
      ...(isEditing ? {} : { attachments: draft.attachments }),
    },
  };
}

export function EventFormModal({
  season,
  draft,
  onDraftChange,
  roster,
  locale = 'de',
  onClose,
  onPopOutToTab,
  onSave,
}: {
  season: string;
  draft: EventFormDraft;
  onDraftChange: (next: EventFormDraft) => void;
  roster: RosterMember[];
  locale?: string;
  onClose: () => void;
  onPopOutToTab: () => void;
  onSave: (payload: SaveEventPayload, eventId?: string) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = draft.editingEventId !== null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const built = buildSavePayload(draft, season, isEn);
    if (built.error || !built.payload) {
      setError(built.error ?? 'Ungültige Eingaben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(built.payload, draft.editingEventId ?? undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div className="sl-attendance-scope">
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6"
      >
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col rounded-xl border border-slate-800 bg-[#12171d] overflow-hidden shadow-2xl"
        >
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-[#12171d]">
            <h2 className="text-base font-semibold text-white truncate">
              {isEditing
                ? isEn
                  ? 'Edit Event'
                  : 'Termin bearbeiten'
                : isEn
                  ? 'Create Event or Series'
                  : 'Neuen Termin oder Serie anlegen'}
            </h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onPopOutToTab}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <PanelTop className="w-3.5 h-3.5" />
                <span>{isEn ? 'Open in Tab' : 'In Tab öffnen'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={isEn ? 'Close' : 'Schließen'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
            <EventFormFields
              draft={draft}
              onDraftChange={onDraftChange}
              roster={roster}
              locale={locale}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-[#0b0e11]">
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
                : isEditing
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

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}

export function EventFormTabView({
  season,
  draft,
  onDraftChange,
  roster,
  locale = 'de',
  onCancel,
  onPopInOverlay,
  onSave,
}: {
  season: string;
  draft: EventFormDraft;
  onDraftChange: (next: EventFormDraft) => void;
  roster: RosterMember[];
  locale?: string;
  onCancel: () => void;
  onPopInOverlay: () => void;
  onSave: (payload: SaveEventPayload, eventId?: string) => Promise<void>;
}) {
  const isEn = locale.startsWith('en');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = draft.editingEventId !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const built = buildSavePayload(draft, season, isEn);
    if (built.error || !built.payload) {
      setError(built.error ?? 'Ungültige Eingaben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(built.payload, draft.editingEventId ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-[#12171d] p-6 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h2 className="text-base font-semibold text-white">
          {isEditing
            ? isEn
              ? 'Edit Event'
              : 'Termin bearbeiten'
            : isEn
              ? 'Create Event or Series'
              : 'Neuen Termin oder Serie anlegen'}
        </h2>
        <button
          type="button"
          onClick={onPopInOverlay}
          className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>{isEn ? 'Switch to Overlay' : 'Als Overlay öffnen'}</span>
        </button>
      </div>

      <EventFormFields
        draft={draft}
        onDraftChange={onDraftChange}
        roster={roster}
        locale={locale}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
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
            : isEditing
              ? isEn
                ? 'Save changes'
                : 'Änderungen speichern'
              : isEn
                ? 'Create Event'
                : 'Termin anlegen'}
        </button>
      </div>
    </form>
  );
}
