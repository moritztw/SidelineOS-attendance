import type {
  AttendanceEvent,
  AttendanceResponse,
  ReminderLogEntry,
  TeamAttendanceSettings,
  UserAttendanceSettings,
} from '../types.ts';
import { getCutoffDeadlineIso, getEffectiveCutoffMinutes } from './cutoff.ts';

export interface DueReminderBatch {
  event: AttendanceEvent;
  reminderKind: 'CUTOFF_REMINDER';
  recipientUserUuids: string[];
  deadlineAt: string;
}

/**
 * Ermittelt fällige Erinnerungen für den Core-Cron / Scheduler.
 * Berücksichtigt nur eingeladene Nutzer ohne Rückmeldung innerhalb des Vorlauf-Fensters
 * und verhindert Mehrfach-Zustellungen über `reminderLog`.
 */
export function findDueReminders(params: {
  events: AttendanceEvent[];
  responses: AttendanceResponse[];
  reminderLog: ReminderLogEntry[];
  teamSettings: TeamAttendanceSettings;
  userSettingsMap: Map<string, UserAttendanceSettings>;
  now?: Date;
}): DueReminderBatch[] {
  const nowMs = (params.now ?? new Date()).getTime();
  const leadMs = Math.max(1, params.teamSettings.reminderHoursBefore) * 3_600_000;

  const answeredSet = new Set(params.responses.map((r) => `${r.eventId}::${r.userUuid}`));
  const sentSet = new Set(
    params.reminderLog.map((l) => `${l.eventId}::${l.userUuid}::${l.reminderKind}`)
  );

  const batches: DueReminderBatch[] = [];

  for (const event of params.events) {
    const startMs = Date.parse(event.startsAt);
    if (!Number.isFinite(startMs) || startMs <= nowMs) {
      continue;
    }

    const cutoffMinutes = getEffectiveCutoffMinutes(
      event.cutoffMinutesOverride,
      params.teamSettings.defaultCutoffMinutes
    );
    const deadlineAt = getCutoffDeadlineIso(event.startsAt, cutoffMinutes);
    const deadlineMs = Date.parse(deadlineAt);
    const anchorMs = Number.isFinite(deadlineMs) && deadlineMs > nowMs ? deadlineMs : startMs;

    if (nowMs < anchorMs - leadMs || nowMs >= anchorMs) {
      continue;
    }

    const recipients: string[] = [];
    for (const userUuid of event.invitedUserUuids) {
      if (answeredSet.has(`${event.id}::${userUuid}`)) continue;
      if (sentSet.has(`${event.id}::${userUuid}::CUTOFF_REMINDER`)) continue;

      const userPref = params.userSettingsMap.get(userUuid);
      if (userPref && !userPref.notifyBeforeCutoff) continue;

      recipients.push(userUuid);
    }

    if (recipients.length > 0) {
      batches.push({
        event,
        reminderKind: 'CUTOFF_REMINDER',
        recipientUserUuids: recipients,
        deadlineAt,
      });
    }
  }

  return batches;
}
