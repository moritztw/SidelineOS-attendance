import { useEffect, useState } from 'react';
import type { PluginSettingsKontext } from '@sidelineos/plugin-sdk';
import { Bell, Save } from 'lucide-react';
import {
  fetchAttendanceSettings,
  triggerDueReminders,
  updateTeamSettings,
  updateUserSettings,
} from '../api/attendanceApi.ts';
import type { NonInvitedVisibility, ResponseVisibility } from '../types.ts';

export function TeamSettingsPanel({ ctx }: { ctx: PluginSettingsKontext }) {
  const isEn = ctx.locale.startsWith('en');
  const [nonInvitedVisibility, setNonInvitedVisibility] =
    useState<NonInvitedVisibility>('TRANSPARENT');
  const [responseVisibility, setResponseVisibility] = useState<ResponseVisibility>('TEAM');
  const [cutoffHours, setCutoffHours] = useState('4');
  const [liveCheckinEnabled, setLiveCheckinEnabled] = useState(false);
  const [reminderHoursBefore, setReminderHoursBefore] = useState('24');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAttendanceSettings(ctx.team.id)
      .then((res) => {
        if (!active) return;
        setNonInvitedVisibility(res.settings.nonInvitedVisibility);
        setResponseVisibility(res.settings.responseVisibility);
        setCutoffHours(String(Math.round((res.settings.defaultCutoffMinutes / 60) * 10) / 10));
        setLiveCheckinEnabled(res.settings.liveCheckinEnabled);
        setReminderHoursBefore(String(res.settings.reminderHoursBefore));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ctx.team.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const parsedCutoff = Number.parseFloat(cutoffHours.replace(',', '.'));
      const parsedReminder = Number.parseInt(reminderHoursBefore, 10);
      await updateTeamSettings(ctx.team.id, {
        nonInvitedVisibility,
        responseVisibility,
        defaultCutoffMinutes: Number.isFinite(parsedCutoff) && parsedCutoff >= 0 ? Math.round(parsedCutoff * 60) : 240,
        liveCheckinEnabled,
        reminderHoursBefore: Number.isFinite(parsedReminder) && parsedReminder >= 1 ? parsedReminder : 24,
      });
      setMessage(isEn ? 'Team settings saved.' : 'Team-Einstellungen gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestReminders() {
    setMessage(null);
    setError(null);
    try {
      const res = await triggerDueReminders(ctx.team.id);
      setMessage(
        isEn
          ? `Reminder check complete: ${res.recipientsNotified} recipient(s) notified across ${res.batchesSent} event(s).`
          : `Erinnerungsprüfung abgeschlossen: ${res.recipientsNotified} Empfänger für ${res.batchesSent} Termin(e) benachrichtigt.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erinnerungsversand fehlgeschlagen.');
    }
  }

  return (
    <div className="sl-attendance-scope">
      <section
        id="modul-attendance-team-config"
        className="rounded-xl border border-slate-800 bg-[#12171d] p-6 space-y-5"
      >
      <header className="space-y-1 border-b border-slate-800 pb-3">
        <h3 className="text-base font-semibold text-white">
          {isEn ? 'Attendance, Deadlines & Check-In' : 'Anwesenheit, Fristen & Check-In'}
        </h3>
        <p className="text-xs text-slate-400">
          {isEn
            ? 'Configure team-wide visibility, response deadlines, and live check-in.'
            : 'Steuert Sichtbarkeit, Rückmeldefristen, Datenschutz und Live-Check-In für dieses Team.'}
        </p>
      </header>

      {loading ? (
        <p className="text-xs text-slate-400">{isEn ? 'Loading…' : 'Wird geladen…'}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              {isEn
                ? 'Visibility of events for non-invited players'
                : 'Sichtbarkeit von Terminen für nicht-eingeladene Spieler'}
            </label>
            <select
              value={nonInvitedVisibility}
              onChange={(e) => setNonInvitedVisibility(e.target.value as NonInvitedVisibility)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            >
              <option value="TRANSPARENT">
                {isEn
                  ? 'Option A: Transparent (greyed out, read-only)'
                  : 'Option A: Voll transparent (ausgegraut mit Hinweis, ohne Antwort)'}
              </option>
              <option value="HIDDEN">
                {isEn
                  ? 'Option B: Exclusive (completely hidden)'
                  : 'Option B: Exklusiv (nicht-eingeladene Termine ausblenden)'}
              </option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              {isEn
                ? 'Visibility of responses & cancellation reasons'
                : 'Sichtbarkeit von Rückmeldungen & Abmeldegründen'}
            </label>
            <select
              value={responseVisibility}
              onChange={(e) => setResponseVisibility(e.target.value as ResponseVisibility)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
            >
              <option value="TEAM">
                {isEn ? 'Visible to entire team' : 'Für das gesamte Team einsehbar'}
              </option>
              <option value="STAFF_ONLY">
                {isEn ? 'Coaches & Staff only' : 'Nur für Coaches & Staff einsehbar'}
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                {isEn
                  ? 'Default response deadline (hours before start)'
                  : 'Standard-Rückmeldefrist (Stunden vor Start)'}
              </label>
              <input
                type="number"
                min={0}
                step="0.5"
                value={cutoffHours}
                onChange={(e) => setCutoffHours(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-200">
                {isEn
                  ? 'Automatic reminder window (hours before deadline)'
                  : 'Erinnerungs-Vorlauf für Core-Cron (Stunden vor Frist)'}
              </label>
              <input
                type="number"
                min={1}
                step="1"
                value={reminderHoursBefore}
                onChange={(e) => setReminderHoursBefore(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-800 bg-[#0b0e11] text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={liveCheckinEnabled}
              onChange={(e) => setLiveCheckinEnabled(e.target.checked)}
            />
            <span>
              {isEn
                ? 'Enable Live Check-In tool for Coaches on the field (Opt-In)'
                : 'Live-Check-In-Werkzeug für Coaches auf dem Platz aktivieren (Opt-In)'}
            </span>
          </label>

          {message && <p className="text-xs text-emerald-400">{message}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestReminders}
              className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200 inline-flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>
                {isEn ? 'Dispatch Due Reminders Now' : 'Fällige Erinnerungen jetzt prüfen'}
              </span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? (isEn ? 'Saving…' : 'Speichert…') : isEn ? 'Save' : 'Speichern'}</span>
            </button>
          </div>
        </form>
      )}
      </section>
    </div>
  );
}

export function UserSettingsPanel({ ctx }: { ctx: PluginSettingsKontext }) {
  const isEn = ctx.locale.startsWith('en');
  const [notifyOnInvite, setNotifyOnInvite] = useState(true);
  const [notifyBeforeCutoff, setNotifyBeforeCutoff] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAttendanceSettings(ctx.team.id)
      .then((res) => {
        if (!active) return;
        setNotifyOnInvite(res.userSettings.notifyOnInvite);
        setNotifyBeforeCutoff(res.userSettings.notifyBeforeCutoff);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Fehler beim Laden');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ctx.team.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateUserSettings(ctx.team.id, { notifyOnInvite, notifyBeforeCutoff });
      setMessage(isEn ? 'Preferences saved.' : 'Einstellungen gespeichert.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sl-attendance-scope">
      <section
        id="modul-attendance-user-prefs"
        className="rounded-xl border border-slate-800 bg-[#12171d] p-6 space-y-4"
      >
      <header className="space-y-1 border-b border-slate-800 pb-3">
        <h3 className="text-base font-semibold text-white">
          {isEn ? 'Attendance & Reminders' : 'Anwesenheit & Erinnerungen'}
        </h3>
        <p className="text-xs text-slate-400">
          {isEn
            ? 'Control which event notifications you receive via SidelineOS-Core.'
            : 'Lege fest, bei welchen Terminereignissen du über SidelineOS benachrichtigt wirst.'}
        </p>
      </header>

      {loading ? (
        <p className="text-xs text-slate-400">{isEn ? 'Loading…' : 'Wird geladen…'}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnInvite}
              onChange={(e) => setNotifyOnInvite(e.target.checked)}
            />
            <span>
              {isEn
                ? 'Notify me when I am invited to a new event'
                : 'Bei neuen Termin-Einladungen benachrichtigen'}
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyBeforeCutoff}
              onChange={(e) => setNotifyBeforeCutoff(e.target.checked)}
            />
            <span>
              {isEn
                ? 'Remind me before response deadline if my response is open'
                : 'Vor Fristablauf erinnern, wenn meine Rückmeldung noch offen ist'}
            </span>
          </label>

          {message && <p className="text-xs text-emerald-400">{message}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? (isEn ? 'Saving…' : 'Speichert…') : isEn ? 'Save' : 'Speichern'}</span>
            </button>
          </div>
        </form>
      )}
      </section>
    </div>
  );
}
