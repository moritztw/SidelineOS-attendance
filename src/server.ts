import crypto from 'node:crypto';
import fs from 'node:fs';
import type {
  NotificationPayload,
  PluginBackendKontext,
  PluginDbScope,
  SidelineBackendPlugin,
  SpielerUnit,
  TeamRolle,
} from '@sidelineos/plugin-sdk';
import manifest from '../plugin.manifest.json';

const initSql = fs.readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8');
import { findMatchingAbsenceForEvent, isValidIsoDateOnly } from './services/absences.ts';
import { canEditRsvp, getCutoffDeadlineIso, getEffectiveCutoffMinutes } from './services/cutoff.ts';
import { generateSeriesOccurrences } from './services/recurrence.ts';
import { findDueReminders } from './services/reminders.ts';
import { buildStatsCsv, calculateStatsReport } from './services/stats.ts';
import { resolveInvitedUserUuids } from './services/targeting.ts';
import type {
  AbsenceReasonType,
  AttachmentKind,
  AttendanceCheckIn,
  AttendanceEvent,
  AttendanceResponse,
  AttendanceStatus,
  CheckInStatus,
  EventAttachment,
  EventCategory,
  EventDetailView,
  EventParticipantView,
  EventSummaryView,
  LongTermAbsence,
  NonInvitedVisibility,
  RecurrenceKind,
  ReminderLogEntry,
  ResponseVisibility,
  RosterMember,
  TeamAttendanceSettings,
  UserAttendanceSettings,
} from './types.ts';

const VALID_STATUSES = new Set<AttendanceStatus>(['PRESENT', 'INACTIVE', 'UNCERTAIN', 'ABSENT']);
const VALID_CHECKIN_STATUSES = new Set<CheckInStatus>(['PRESENT', 'INACTIVE', 'ABSENT']);
const VALID_CATEGORIES = new Set<EventCategory>(['TRAINING', 'MEETING', 'GAME', 'OTHER']);
const VALID_UNITS = new Set<SpielerUnit>(['OFFENSE', 'DEFENSE', 'SPECIAL_TEAMS']);
const VALID_ROLES = new Set<TeamRolle>(['TEAM_ADMIN', 'COACH', 'PLAYER']);
const VALID_ABSENCE_TYPES = new Set<AbsenceReasonType>(['VACATION', 'INJURY', 'PERSONAL']);

function isStaff(role: TeamRolle): boolean {
  return role === 'TEAM_ADMIN' || role === 'COACH';
}

function parseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toIsoString(raw: unknown): string {
  if (raw instanceof Date) return raw.toISOString();
  return String(raw ?? '');
}

function mapTeamSettings(teamId: string, row?: Record<string, unknown>): TeamAttendanceSettings {
  return {
    teamId,
    nonInvitedVisibility:
      row?.non_invited_visibility === 'HIDDEN' ? 'HIDDEN' : ('TRANSPARENT' as NonInvitedVisibility),
    responseVisibility:
      row?.response_visibility === 'STAFF_ONLY' ? 'STAFF_ONLY' : ('TEAM' as ResponseVisibility),
    defaultCutoffMinutes:
      typeof row?.default_cutoff_minutes === 'number' && row.default_cutoff_minutes >= 0
        ? row.default_cutoff_minutes
        : 240,
    liveCheckinEnabled: Boolean(row?.live_checkin_enabled ?? false),
    reminderHoursBefore:
      typeof row?.reminder_hours_before === 'number' && row.reminder_hours_before >= 1
        ? row.reminder_hours_before
        : 24,
    updatedAt: row?.updated_at ? toIsoString(row.updated_at) : undefined,
  };
}

function mapUserSettings(
  teamId: string,
  userUuid: string,
  row?: Record<string, unknown>
): UserAttendanceSettings {
  return {
    teamId,
    userUuid,
    notifyOnInvite: row?.notify_on_invite === undefined ? true : Boolean(row.notify_on_invite),
    notifyBeforeCutoff:
      row?.notify_before_cutoff === undefined ? true : Boolean(row.notify_before_cutoff),
    updatedAt: row?.updated_at ? toIsoString(row.updated_at) : undefined,
  };
}

function mapRosterRow(row: Record<string, unknown>): RosterMember {
  const units = parseJsonArray<SpielerUnit>(row.units_json).filter((u) => VALID_UNITS.has(u));
  const rolle = VALID_ROLES.has(row.rolle as TeamRolle) ? (row.rolle as TeamRolle) : 'PLAYER';
  return {
    userUuid: String(row.user_uuid),
    vollerName: String(row.voller_name ?? ''),
    benutzername: String(row.benutzername ?? ''),
    rolle,
    units: units.length > 0 ? units : ['OFFENSE'],
    position: String(row.position ?? ''),
    trikotNummer: String(row.trikot_nummer ?? ''),
    status: row.status === 'WARTET_AUF_FREIGABE' ? 'WARTET_AUF_FREIGABE' : 'AKTIV',
  };
}

function mapEventRow(row: Record<string, unknown>): AttendanceEvent {
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    season: String(row.season),
    seriesId: row.series_id ? String(row.series_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    category: VALID_CATEGORIES.has(row.category as EventCategory)
      ? (row.category as EventCategory)
      : 'TRAINING',
    location: String(row.location ?? ''),
    startsAt: toIsoString(row.starts_at),
    endsAt: toIsoString(row.ends_at),
    cutoffMinutesOverride:
      typeof row.cutoff_minutes_override === 'number' ? row.cutoff_minutes_override : null,
    targetAll: Boolean(row.target_all),
    targetUnits: parseJsonArray<SpielerUnit>(row.target_units_json).filter((u) => VALID_UNITS.has(u)),
    targetPositions: parseJsonArray<string>(row.target_positions_json).map((p) => String(p)),
    targetRoles: parseJsonArray<TeamRolle>(row.target_roles_json).filter((r) => VALID_ROLES.has(r)),
    targetUserUuids: parseJsonArray<string>(row.target_user_uuids_json).map((u) => String(u)),
    invitedUserUuids: parseJsonArray<string>(row.invited_user_uuids_json).map((u) => String(u)),
    createdBy: String(row.created_by),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapResponseRow(row: Record<string, unknown>): AttendanceResponse {
  return {
    eventId: String(row.event_id),
    teamId: String(row.team_id),
    userUuid: String(row.user_uuid),
    status: VALID_STATUSES.has(row.status as AttendanceStatus)
      ? (row.status as AttendanceStatus)
      : 'UNCERTAIN',
    comment: String(row.comment ?? ''),
    source: row.source === 'LONG_TERM_ABSENCE' ? 'LONG_TERM_ABSENCE' : 'MANUAL',
    absenceId: row.absence_id ? String(row.absence_id) : null,
    manualOverride: Boolean(row.manual_override),
    updatedBy: String(row.updated_by),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapCheckInRow(row: Record<string, unknown>): AttendanceCheckIn {
  return {
    eventId: String(row.event_id),
    teamId: String(row.team_id),
    userUuid: String(row.user_uuid),
    actualStatus: VALID_CHECKIN_STATUSES.has(row.actual_status as CheckInStatus)
      ? (row.actual_status as CheckInStatus)
      : 'ABSENT',
    note: String(row.note ?? ''),
    checkedBy: String(row.checked_by),
    checkedAt: toIsoString(row.checked_at),
  };
}

function mapAbsenceRow(row: Record<string, unknown>): LongTermAbsence {
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    userUuid: String(row.user_uuid),
    reasonType: VALID_ABSENCE_TYPES.has(row.reason_type as AbsenceReasonType)
      ? (row.reason_type as AbsenceReasonType)
      : 'VACATION',
    reasonText: String(row.reason_text ?? ''),
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    createdAt: toIsoString(row.created_at),
  };
}

function mapAttachmentRow(row: Record<string, unknown>): EventAttachment {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    teamId: String(row.team_id),
    kind: row.kind === 'CORE_ATTACHMENT' ? 'CORE_ATTACHMENT' : ('LINK' as AttachmentKind),
    title: String(row.title),
    url: String(row.url ?? ''),
    coreAttachmentId: row.core_attachment_id ? String(row.core_attachment_id) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    createdBy: String(row.created_by),
    createdAt: toIsoString(row.created_at),
  };
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function getTeamSettings(db: PluginDbScope, teamId: string): Promise<TeamAttendanceSettings> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM mod_attendance_team_settings WHERE team_id = $1`,
    [teamId]
  );
  return mapTeamSettings(teamId, res.rows[0]);
}

async function getRoster(db: PluginDbScope, teamId: string): Promise<RosterMember[]> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM mod_attendance_roster_cache WHERE team_id = $1 ORDER BY voller_name ASC`,
    [teamId]
  );
  return res.rows.map(mapRosterRow);
}

async function applyAbsencesForEvent(
  db: PluginDbScope,
  teamId: string,
  event: AttendanceEvent
): Promise<void> {
  if (event.invitedUserUuids.length === 0) return;

  const absRes = await db.query<Record<string, unknown>>(
    `SELECT * FROM mod_attendance_absences WHERE team_id = $1`,
    [teamId]
  );
  const absences = absRes.rows.map(mapAbsenceRow);
  if (absences.length === 0) return;

  const byUser = new Map<string, LongTermAbsence[]>();
  for (const abs of absences) {
    const list = byUser.get(abs.userUuid) ?? [];
    list.push(abs);
    byUser.set(abs.userUuid, list);
  }

  for (const userUuid of event.invitedUserUuids) {
    const userAbsences = byUser.get(userUuid);
    if (!userAbsences) continue;
    const match = findMatchingAbsenceForEvent(event.startsAt, userAbsences);
    if (!match) continue;

    await db.query(
      `INSERT INTO mod_attendance_responses (
         event_id, team_id, user_uuid, status, comment, source, absence_id, manual_override, updated_by, updated_at
       ) VALUES ($1, $2, $3, 'ABSENT', $4, 'LONG_TERM_ABSENCE', $5, FALSE, $3, NOW())
       ON CONFLICT (event_id, user_uuid) DO NOTHING`,
      [event.id, teamId, userUuid, match.reasonText || match.reasonType, match.id]
    );
  }
}

async function syncSingleAbsenceToUpcomingEvents(
  db: PluginDbScope,
  teamId: string,
  absence: LongTermAbsence,
  now: Date = new Date()
): Promise<number> {
  const eventsRes = await db.query<Record<string, unknown>>(
    `SELECT * FROM mod_attendance_events WHERE team_id = $1 AND starts_at >= $2`,
    [teamId, now.toISOString()]
  );
  const events = eventsRes.rows.map(mapEventRow);
  let appliedCount = 0;

  for (const ev of events) {
    if (!ev.invitedUserUuids.includes(absence.userUuid)) continue;
    if (!findMatchingAbsenceForEvent(ev.startsAt, [absence])) continue;

    const existing = await db.query<Record<string, unknown>>(
      `SELECT manual_override FROM mod_attendance_responses WHERE event_id = $1 AND user_uuid = $2`,
      [ev.id, absence.userUuid]
    );
    if (existing.rows[0]?.manual_override) {
      continue;
    }

    await db.query(
      `INSERT INTO mod_attendance_responses (
         event_id, team_id, user_uuid, status, comment, source, absence_id, manual_override, updated_by, updated_at
       ) VALUES ($1, $2, $3, 'ABSENT', $4, 'LONG_TERM_ABSENCE', $5, FALSE, $3, NOW())
       ON CONFLICT (event_id, user_uuid) DO UPDATE SET
         status = 'ABSENT',
         comment = EXCLUDED.comment,
         source = 'LONG_TERM_ABSENCE',
         absence_id = EXCLUDED.absence_id,
         updated_at = NOW()
       WHERE mod_attendance_responses.manual_override = FALSE`,
      [ev.id, teamId, absence.userUuid, absence.reasonText || absence.reasonType, absence.id]
    );
    appliedCount += 1;
  }

  return appliedCount;
}

function buildEventSummary(params: {
  event: AttendanceEvent;
  userUuid: string;
  teamRolle: TeamRolle;
  settings: TeamAttendanceSettings;
  responses: AttendanceResponse[];
  attachmentCount: number;
  now?: Date;
}): EventSummaryView {
  const isInvited = params.event.invitedUserUuids.includes(params.userUuid);
  const effectiveCutoffMinutes = getEffectiveCutoffMinutes(
    params.event.cutoffMinutesOverride,
    params.settings.defaultCutoffMinutes
  );
  const cutoffEval = canEditRsvp({
    startsAtIso: params.event.startsAt,
    cutoffMinutes: effectiveCutoffMinutes,
    teamRolle: params.teamRolle,
    isInvited,
    now: params.now,
  });

  const invitedSet = new Set(params.event.invitedUserUuids);
  let present = 0;
  let inactive = 0;
  let uncertain = 0;
  let absent = 0;
  let myResponse: AttendanceResponse | null = null;

  for (const r of params.responses) {
    if (r.userUuid === params.userUuid) {
      myResponse = r;
    }
    if (!invitedSet.has(r.userUuid)) continue;
    if (r.status === 'PRESENT') present += 1;
    else if (r.status === 'INACTIVE') inactive += 1;
    else if (r.status === 'UNCERTAIN') uncertain += 1;
    else if (r.status === 'ABSENT') absent += 1;
  }

  const invited = params.event.invitedUserUuids.length;
  const answered = present + inactive + uncertain + absent;
  const unanswered = Math.max(0, invited - answered);

  return {
    ...params.event,
    isInvited,
    canRespond: isInvited && cutoffEval.allowed,
    effectiveCutoffMinutes,
    cutoffDeadlineAt: getCutoffDeadlineIso(params.event.startsAt, effectiveCutoffMinutes),
    isCutoffLockedForPlayers: cutoffEval.lockedForPlayers,
    myResponse,
    counts: {
      invited,
      present,
      inactive,
      uncertain,
      absent,
      unanswered,
    },
    attachmentCount: params.attachmentCount,
  };
}

async function safeSendNotification(
  ctx: PluginBackendKontext,
  payload: NotificationPayload
): Promise<void> {
  if (!ctx.notifications || !ctx.hasPermission('notifications:send')) {
    return;
  }
  try {
    await ctx.notifications.send(payload);
  } catch {
    // Benachrichtigungsfehler blockieren keine fachlichen Kern-Operationen
  }
}

/**
 * Vorbereiteter Hook für den kommenden Core-Cron / Scheduler.
 * Kann sowohl über `POST /reminders/dispatch` als auch direkt vom Core aufgerufen werden.
 */
export async function dispatchDueReminders(
  ctx: PluginBackendKontext,
  now: Date = new Date()
): Promise<{ batchesSent: number; recipientsNotified: number }> {
  const teamId = ctx.team.id;
  const settings = await getTeamSettings(ctx.db, teamId);

  const [eventsRes, responsesRes, logRes, userSettingsRes] = await Promise.all([
    ctx.db.query<Record<string, unknown>>(
      `SELECT * FROM mod_attendance_events WHERE team_id = $1 AND starts_at > $2`,
      [teamId, now.toISOString()]
    ),
    ctx.db.query<Record<string, unknown>>(
      `SELECT * FROM mod_attendance_responses WHERE team_id = $1`,
      [teamId]
    ),
    ctx.db.query<Record<string, unknown>>(
      `SELECT l.* FROM mod_attendance_reminder_log l
       JOIN mod_attendance_events e ON e.id = l.event_id
       WHERE e.team_id = $1`,
      [teamId]
    ),
    ctx.db.query<Record<string, unknown>>(
      `SELECT * FROM mod_attendance_user_settings WHERE team_id = $1`,
      [teamId]
    ),
  ]);

  const events = eventsRes.rows.map(mapEventRow);
  const responses = responsesRes.rows.map(mapResponseRow);
  const reminderLog: ReminderLogEntry[] = logRes.rows.map((r) => ({
    eventId: String(r.event_id),
    userUuid: String(r.user_uuid),
    reminderKind: String(r.reminder_kind),
    sentAt: toIsoString(r.sent_at),
  }));

  const userSettingsMap = new Map<string, UserAttendanceSettings>();
  for (const row of userSettingsRes.rows) {
    const mapped = mapUserSettings(teamId, String(row.user_uuid), row);
    userSettingsMap.set(mapped.userUuid, mapped);
  }

  const dueBatches = findDueReminders({
    events,
    responses,
    reminderLog,
    teamSettings: settings,
    userSettingsMap,
    now,
  });

  let batchesSent = 0;
  let recipientsNotified = 0;

  for (const batch of dueBatches) {
    await safeSendNotification(ctx, {
      eventType: 'attendance.reminder_due',
      title: `Rückmeldung offen: ${batch.event.title}`,
      message: `Bitte trage deine Anwesenheit vor Ablauf der Frist ein.`,
      linkPath: `/modules/attendance/overview?event=${encodeURIComponent(batch.event.id)}`,
      priority: 'warning',
      recipientUserUuids: batch.recipientUserUuids,
      metadata: {
        eventId: batch.event.id,
        startsAt: batch.event.startsAt,
        deadlineAt: batch.deadlineAt,
      },
    });

    for (const userUuid of batch.recipientUserUuids) {
      await ctx.db.query(
        `INSERT INTO mod_attendance_reminder_log (event_id, user_uuid, reminder_kind, sent_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (event_id, user_uuid, reminder_kind) DO NOTHING`,
        [batch.event.id, userUuid, batch.reminderKind]
      );
    }

    batchesSent += 1;
    recipientsNotified += batch.recipientUserUuids.length;
  }

  return { batchesSent, recipientsNotified };
}

export const backendPlugin: SidelineBackendPlugin = {
  manifest: manifest as SidelineBackendPlugin['manifest'],
  migrations: [
    {
      name: '001_init.sql',
      sql: initSql,
    },
  ],

  async handleRequest(req, ctx) {
    const teamId = ctx.team.id;
    const role = ctx.teamRolle;
    const userUuid = ctx.user.uuid;
    const method = req.method.toUpperCase();
    const path = req.path || '/';
    const body = (req.body ?? {}) as Record<string, unknown>;

    // 1. Roster-Synchronisation aus Core (/api/v1/teams/:teamId/members)
    if (method === 'POST' && path === '/roster-sync') {
      const incoming = Array.isArray(body.members) ? body.members : [];
      const syncedMembers: RosterMember[] = [];

      for (const item of incoming) {
        if (!item || typeof item !== 'object') continue;
        const m = item as Record<string, unknown>;
        const uuid = String(m.userUuid ?? '').trim();
        if (!uuid) continue;

        const member: RosterMember = {
          userUuid: uuid,
          vollerName: String(m.vollerName ?? '').trim() || uuid,
          benutzername: String(m.benutzername ?? '').trim(),
          rolle: VALID_ROLES.has(m.rolle as TeamRolle) ? (m.rolle as TeamRolle) : 'PLAYER',
          units: Array.isArray(m.units)
            ? m.units.filter((u): u is SpielerUnit => VALID_UNITS.has(u as SpielerUnit))
            : ['OFFENSE'],
          position: String(m.position ?? '').trim(),
          trikotNummer: String(m.trikotNummer ?? '').trim(),
          status: m.status === 'WARTET_AUF_FREIGABE' ? 'WARTET_AUF_FREIGABE' : 'AKTIV',
        };
        if (member.units.length === 0) member.units = ['OFFENSE'];
        syncedMembers.push(member);

        await ctx.db.query(
          `INSERT INTO mod_attendance_roster_cache (
             team_id, user_uuid, voller_name, benutzername, rolle, units_json, position, trikot_nummer, status, synced_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW())
           ON CONFLICT (team_id, user_uuid) DO UPDATE SET
             voller_name = EXCLUDED.voller_name,
             benutzername = EXCLUDED.benutzername,
             rolle = EXCLUDED.rolle,
             units_json = EXCLUDED.units_json,
             position = EXCLUDED.position,
             trikot_nummer = EXCLUDED.trikot_nummer,
             status = EXCLUDED.status,
             synced_at = NOW()`,
          [
            teamId,
            member.userUuid,
            member.vollerName,
            member.benutzername,
            member.rolle,
            JSON.stringify(member.units),
            member.position,
            member.trikotNummer,
            member.status,
          ]
        );
      }

      // Zukünftige Termine dynamisch mit aktualisiertem Roster abgleichen
      if (syncedMembers.length > 0) {
        const upcomingRes = await ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_events WHERE team_id = $1 AND starts_at >= $2`,
          [teamId, new Date().toISOString()]
        );
        for (const row of upcomingRes.rows) {
          const ev = mapEventRow(row);
          const refreshedInvited = resolveInvitedUserUuids(syncedMembers, ev);
          if (JSON.stringify(refreshedInvited) !== JSON.stringify(ev.invitedUserUuids)) {
            await ctx.db.query(
              `UPDATE mod_attendance_events SET invited_user_uuids_json = $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(refreshedInvited), ev.id]
            );
            await applyAbsencesForEvent(ctx.db, teamId, { ...ev, invitedUserUuids: refreshedInvited });
          }
        }
      }

      return { status: 200, body: { synced: syncedMembers.length } };
    }

    // 2. Bootstrap für Initialansicht
    if (method === 'GET' && path === '/bootstrap') {
      const season = typeof req.query.season === 'string' && req.query.season ? req.query.season : ctx.team.aktiveSaison;
      const [settings, userPrefRes, eventsRes, responsesRes, attachmentsRes, absencesRes, roster] =
        await Promise.all([
          getTeamSettings(ctx.db, teamId),
          ctx.db.query<Record<string, unknown>>(
            `SELECT * FROM mod_attendance_user_settings WHERE team_id = $1 AND user_uuid = $2`,
            [teamId, userUuid]
          ),
          ctx.db.query<Record<string, unknown>>(
            `SELECT * FROM mod_attendance_events
             WHERE team_id = $1 AND ($2 = 'ALL' OR season = $2)
             ORDER BY starts_at ASC`,
            [teamId, season]
          ),
          ctx.db.query<Record<string, unknown>>(
            `SELECT * FROM mod_attendance_responses WHERE team_id = $1`,
            [teamId]
          ),
          ctx.db.query<Record<string, unknown>>(
            `SELECT event_id, COUNT(*)::int AS cnt FROM mod_attendance_event_attachments WHERE team_id = $1 GROUP BY event_id`,
            [teamId]
          ),
          isStaff(role)
            ? ctx.db.query<Record<string, unknown>>(
                `SELECT * FROM mod_attendance_absences WHERE team_id = $1 ORDER BY starts_on DESC`,
                [teamId]
              )
            : ctx.db.query<Record<string, unknown>>(
                `SELECT * FROM mod_attendance_absences WHERE team_id = $1 AND user_uuid = $2 ORDER BY starts_on DESC`,
                [teamId, userUuid]
              ),
          getRoster(ctx.db, teamId),
        ]);

      const userSettings = mapUserSettings(teamId, userUuid, userPrefRes.rows[0]);
      const allResponses = responsesRes.rows.map(mapResponseRow);
      const responsesByEvent = new Map<string, AttendanceResponse[]>();
      for (const r of allResponses) {
        const list = responsesByEvent.get(r.eventId) ?? [];
        list.push(r);
        responsesByEvent.set(r.eventId, list);
      }

      const attachmentCounts = new Map<string, number>();
      for (const row of attachmentsRes.rows) {
        attachmentCounts.set(String(row.event_id), Number(row.cnt ?? 0));
      }

      const now = new Date();
      const summaries: EventSummaryView[] = [];
      for (const row of eventsRes.rows) {
        const ev = mapEventRow(row);
        const isInvited = ev.invitedUserUuids.includes(userUuid);
        if (!isStaff(role) && !isInvited && settings.nonInvitedVisibility === 'HIDDEN') {
          continue;
        }
        summaries.push(
          buildEventSummary({
            event: ev,
            userUuid,
            teamRolle: role,
            settings,
            responses: responsesByEvent.get(ev.id) ?? [],
            attachmentCount: attachmentCounts.get(ev.id) ?? 0,
            now,
          })
        );
      }

      return {
        status: 200,
        body: {
          settings,
          userSettings,
          events: summaries,
          absences: absencesRes.rows.map(mapAbsenceRow),
          roster,
        },
      };
    }

    // 3. Termine auflisten
    if (method === 'GET' && path === '/events') {
      const season = typeof req.query.season === 'string' && req.query.season ? req.query.season : ctx.team.aktiveSaison;
      const [settings, eventsRes, responsesRes, attachmentsRes] = await Promise.all([
        getTeamSettings(ctx.db, teamId),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_events WHERE team_id = $1 AND ($2 = 'ALL' OR season = $2) ORDER BY starts_at ASC`,
          [teamId, season]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_responses WHERE team_id = $1`,
          [teamId]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT event_id, COUNT(*)::int AS cnt FROM mod_attendance_event_attachments WHERE team_id = $1 GROUP BY event_id`,
          [teamId]
        ),
      ]);

      const responsesByEvent = new Map<string, AttendanceResponse[]>();
      for (const row of responsesRes.rows) {
        const r = mapResponseRow(row);
        const list = responsesByEvent.get(r.eventId) ?? [];
        list.push(r);
        responsesByEvent.set(r.eventId, list);
      }
      const attachmentCounts = new Map<string, number>();
      for (const row of attachmentsRes.rows) {
        attachmentCounts.set(String(row.event_id), Number(row.cnt ?? 0));
      }

      const events: EventSummaryView[] = [];
      for (const row of eventsRes.rows) {
        const ev = mapEventRow(row);
        const isInvited = ev.invitedUserUuids.includes(userUuid);
        if (!isStaff(role) && !isInvited && settings.nonInvitedVisibility === 'HIDDEN') {
          continue;
        }
        events.push(
          buildEventSummary({
            event: ev,
            userUuid,
            teamRolle: role,
            settings,
            responses: responsesByEvent.get(ev.id) ?? [],
            attachmentCount: attachmentCounts.get(ev.id) ?? 0,
          })
        );
      }

      return { status: 200, body: { events } };
    }

    // 4. Termin erstellen (Einzeltermin oder Serie -> einzelne Instanzen)
    if (method === 'POST' && path === '/events') {
      if (!isStaff(role)) {
        return { status: 403, body: { fehler: 'Nur Coaches oder Team Admins dürfen Termine anlegen.' } };
      }

      const title = String(body.title ?? '').trim();
      const startsAt = String(body.startsAt ?? '').trim();
      const endsAt = String(body.endsAt ?? '').trim();
      if (!title || !startsAt || !endsAt) {
        return { status: 400, body: { fehler: 'Titel, Startzeit und Endzeit sind erforderlich.' } };
      }

      const category = VALID_CATEGORIES.has(body.category as EventCategory)
        ? (body.category as EventCategory)
        : 'TRAINING';
      const season = typeof body.season === 'string' && body.season ? body.season : ctx.team.aktiveSaison;
      const description = String(body.description ?? '').trim();
      const location = String(body.location ?? '').trim();
      const cutoffMinutesOverride =
        typeof body.cutoffMinutesOverride === 'number' && Number.isFinite(body.cutoffMinutesOverride) && body.cutoffMinutesOverride >= 0
          ? Math.floor(body.cutoffMinutesOverride)
          : null;

      const targetAll = body.targetAll !== false;
      const targetUnits = Array.isArray(body.targetUnits)
        ? body.targetUnits.filter((u): u is SpielerUnit => VALID_UNITS.has(u as SpielerUnit))
        : [];
      const targetPositions = Array.isArray(body.targetPositions)
        ? body.targetPositions.map((p) => String(p).trim().toUpperCase()).filter(Boolean)
        : [];
      const targetRoles = Array.isArray(body.targetRoles)
        ? body.targetRoles.filter((r): r is TeamRolle => VALID_ROLES.has(r as TeamRolle))
        : [];
      const targetUserUuids = Array.isArray(body.targetUserUuids)
        ? body.targetUserUuids.map((u) => String(u).trim()).filter(Boolean)
        : [];

      const recurrenceKind: RecurrenceKind =
        body.recurrenceKind === 'WEEKLY' || body.recurrenceKind === 'BIWEEKLY'
          ? body.recurrenceKind
          : 'NONE';
      const untilDate = typeof body.untilDate === 'string' ? body.untilDate.trim() : undefined;

      let slots;
      try {
        slots = generateSeriesOccurrences({
          startsAtIso: startsAt,
          endsAtIso: endsAt,
          recurrenceKind,
          untilDate,
        });
      } catch (err) {
        return {
          status: 400,
          body: { fehler: err instanceof Error ? err.message : 'Ungültige Terminserie.' },
        };
      }

      const roster = await getRoster(ctx.db, teamId);
      const invitedUserUuids = resolveInvitedUserUuids(roster, {
        targetAll,
        targetUnits,
        targetPositions,
        targetRoles,
        targetUserUuids,
      });

      let seriesId: string | null = null;
      if (recurrenceKind !== 'NONE' && slots.length > 1) {
        seriesId = `ser-${crypto.randomUUID()}`;
        await ctx.db.query(
          `INSERT INTO mod_attendance_series (id, team_id, season, title, recurrence_kind, interval_count, until_date, created_by)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7)`,
          [seriesId, teamId, season, title, recurrenceKind, untilDate ?? '', userUuid]
        );
      }

      const initialAttachments = Array.isArray(body.attachments) ? body.attachments : [];
      const createdIds: string[] = [];

      for (const slot of slots) {
        const eventId = `evt-${crypto.randomUUID()}`;
        await ctx.db.query(
          `INSERT INTO mod_attendance_events (
             id, team_id, season, series_id, title, description, category, location,
             starts_at, ends_at, cutoff_minutes_override,
             target_all, target_units_json, target_positions_json, target_roles_json,
             target_user_uuids_json, invited_user_uuids_json, created_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11,
             $12, $13::jsonb, $14::jsonb, $15::jsonb,
             $16::jsonb, $17::jsonb, $18
           )`,
          [
            eventId,
            teamId,
            season,
            seriesId,
            title,
            description,
            category,
            location,
            slot.startsAt,
            slot.endsAt,
            cutoffMinutesOverride,
            targetAll,
            JSON.stringify(targetUnits),
            JSON.stringify(targetPositions),
            JSON.stringify(targetRoles),
            JSON.stringify(targetUserUuids),
            JSON.stringify(invitedUserUuids),
            userUuid,
          ]
        );

        for (const rawAtt of initialAttachments) {
          if (!rawAtt || typeof rawAtt !== 'object') continue;
          const att = rawAtt as Record<string, unknown>;
          const attTitle = String(att.title ?? '').trim();
          const attUrl = String(att.url ?? '').trim();
          if (!attTitle || !attUrl || !isSafeHttpUrl(attUrl)) continue;
          await ctx.db.query(
            `INSERT INTO mod_attendance_event_attachments (id, event_id, team_id, kind, title, url, created_by)
             VALUES ($1, $2, $3, 'LINK', $4, $5, $6)`,
            [`att-${crypto.randomUUID()}`, eventId, teamId, attTitle, attUrl, userUuid]
          );
        }

        await applyAbsencesForEvent(ctx.db, teamId, {
          id: eventId,
          teamId,
          season,
          seriesId,
          title,
          description,
          category,
          location,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          cutoffMinutesOverride,
          targetAll,
          targetUnits,
          targetPositions,
          targetRoles,
          targetUserUuids,
          invitedUserUuids,
          createdBy: userUuid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        createdIds.push(eventId);
      }

      if (invitedUserUuids.length > 0) {
        await safeSendNotification(ctx, {
          eventType: 'attendance.event_created',
          title: createdIds.length > 1 ? `Neue Terminserie: ${title}` : `Neuer Termin: ${title}`,
          message:
            createdIds.length > 1
              ? `${createdIds.length} Termine wurden angelegt. Bitte trage deine Verfügbarkeit pro Termin ein.`
              : `Du bist zu "${title}" eingeladen. Bitte gib deine Rückmeldung ab.`,
          linkPath:
            createdIds.length === 1
              ? `/modules/attendance/overview?event=${encodeURIComponent(createdIds[0])}`
              : '/modules/attendance/overview',
          priority: 'info',
          recipientUserUuids: invitedUserUuids,
          metadata: { eventIds: createdIds, seriesId },
        });
      }

      return { status: 201, body: { eventIds: createdIds, seriesId, count: createdIds.length } };
    }

    // 5. Einzeltermin-Detail abrufen
    const eventDetailMatch = /^\/events\/([^/]+)$/.exec(path);
    if (method === 'GET' && eventDetailMatch) {
      const eventId = decodeURIComponent(eventDetailMatch[1]);
      const [settings, evRes, respRes, ciRes, attRes, roster] = await Promise.all([
        getTeamSettings(ctx.db, teamId),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
          [eventId, teamId]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_responses WHERE event_id = $1 AND team_id = $2`,
          [eventId, teamId]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_checkins WHERE event_id = $1 AND team_id = $2`,
          [eventId, teamId]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_event_attachments WHERE event_id = $1 AND team_id = $2 ORDER BY created_at ASC`,
          [eventId, teamId]
        ),
        getRoster(ctx.db, teamId),
      ]);

      if (evRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }

      const ev = mapEventRow(evRes.rows[0]);
      const isInvited = ev.invitedUserUuids.includes(userUuid);

      if (!isStaff(role) && !isInvited && settings.nonInvitedVisibility === 'HIDDEN') {
        return { status: 403, body: { fehler: 'Kein Zugriff auf diesen Termin.' } };
      }

      const responses = respRes.rows.map(mapResponseRow);
      const attachments = attRes.rows.map(mapAttachmentRow);
      const checkins = ciRes.rows.map(mapCheckInRow);

      const summary = buildEventSummary({
        event: ev,
        userUuid,
        teamRolle: role,
        settings,
        responses,
        attachmentCount: attachments.length,
      });

      const rosterById = new Map(roster.map((m) => [m.userUuid, m]));
      const responseById = new Map(responses.map((r) => [r.userUuid, r]));
      const checkinById = new Map(checkins.map((c) => [c.userUuid, c]));

      const hideOtherResponses = !isStaff(role) && settings.responseVisibility === 'STAFF_ONLY';

      const participants: EventParticipantView[] = ev.invitedUserUuids.map((uid) => {
        const member: RosterMember = rosterById.get(uid) ?? {
          userUuid: uid,
          vollerName: uid,
          benutzername: uid,
          rolle: 'PLAYER',
          units: ['OFFENSE'],
          position: '',
          trikotNummer: '',
          status: 'AKTIV',
        };
        const resp = responseById.get(uid) ?? null;
        const visibleResp = hideOtherResponses && uid !== userUuid ? null : resp;
        const visibleCheckin = isStaff(role) ? (checkinById.get(uid) ?? null) : null;
        return {
          member,
          response: visibleResp,
          checkin: visibleCheckin,
        };
      });

      const detail: EventDetailView = {
        event: summary,
        attachments,
        participants,
        responsesHiddenForRole: hideOtherResponses,
      };

      return { status: 200, body: detail };
    }

    // 6. Termin bearbeiten
    if (method === 'PATCH' && eventDetailMatch) {
      if (!isStaff(role)) {
        return { status: 403, body: { fehler: 'Nur Coaches oder Team Admins dürfen Termine bearbeiten.' } };
      }
      const eventId = decodeURIComponent(eventDetailMatch[1]);
      const existingRes = await ctx.db.query<Record<string, unknown>>(
        `SELECT * FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
        [eventId, teamId]
      );
      if (existingRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }
      const current = mapEventRow(existingRes.rows[0]);

      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.title;
      const description =
        typeof body.description === 'string' ? body.description.trim() : current.description;
      const location = typeof body.location === 'string' ? body.location.trim() : current.location;
      const category = VALID_CATEGORIES.has(body.category as EventCategory)
        ? (body.category as EventCategory)
        : current.category;
      const startsAt = typeof body.startsAt === 'string' && body.startsAt ? body.startsAt : current.startsAt;
      const endsAt = typeof body.endsAt === 'string' && body.endsAt ? body.endsAt : current.endsAt;

      if (Date.parse(endsAt) <= Date.parse(startsAt)) {
        return { status: 400, body: { fehler: 'Endzeit muss nach Startzeit liegen.' } };
      }

      const cutoffMinutesOverride =
        body.cutoffMinutesOverride === null
          ? null
          : typeof body.cutoffMinutesOverride === 'number' && body.cutoffMinutesOverride >= 0
            ? Math.floor(body.cutoffMinutesOverride)
            : current.cutoffMinutesOverride;

      const targetAll = typeof body.targetAll === 'boolean' ? body.targetAll : current.targetAll;
      const targetUnits = Array.isArray(body.targetUnits)
        ? body.targetUnits.filter((u): u is SpielerUnit => VALID_UNITS.has(u as SpielerUnit))
        : current.targetUnits;
      const targetPositions = Array.isArray(body.targetPositions)
        ? body.targetPositions.map((p) => String(p).trim().toUpperCase()).filter(Boolean)
        : current.targetPositions;
      const targetRoles = Array.isArray(body.targetRoles)
        ? body.targetRoles.filter((r): r is TeamRolle => VALID_ROLES.has(r as TeamRolle))
        : current.targetRoles;
      const targetUserUuids = Array.isArray(body.targetUserUuids)
        ? body.targetUserUuids.map((u) => String(u).trim()).filter(Boolean)
        : current.targetUserUuids;

      const roster = await getRoster(ctx.db, teamId);
      const invitedUserUuids = resolveInvitedUserUuids(roster, {
        targetAll,
        targetUnits,
        targetPositions,
        targetRoles,
        targetUserUuids,
      });

      await ctx.db.query(
        `UPDATE mod_attendance_events SET
           title = $1, description = $2, location = $3, category = $4,
           starts_at = $5, ends_at = $6, cutoff_minutes_override = $7,
           target_all = $8, target_units_json = $9::jsonb, target_positions_json = $10::jsonb,
           target_roles_json = $11::jsonb, target_user_uuids_json = $12::jsonb,
           invited_user_uuids_json = $13::jsonb, updated_at = NOW()
         WHERE id = $14 AND team_id = $15`,
        [
          title,
          description,
          location,
          category,
          startsAt,
          endsAt,
          cutoffMinutesOverride,
          targetAll,
          JSON.stringify(targetUnits),
          JSON.stringify(targetPositions),
          JSON.stringify(targetRoles),
          JSON.stringify(targetUserUuids),
          JSON.stringify(invitedUserUuids),
          eventId,
          teamId,
        ]
      );

      await applyAbsencesForEvent(ctx.db, teamId, {
        ...current,
        title,
        description,
        location,
        category,
        startsAt,
        endsAt,
        cutoffMinutesOverride,
        targetAll,
        targetUnits,
        targetPositions,
        targetRoles,
        targetUserUuids,
        invitedUserUuids,
      });

      await safeSendNotification(ctx, {
        eventType: 'attendance.event_updated',
        title: `Termin aktualisiert: ${title}`,
        message: 'Details oder Zielgruppe des Termins wurden angepasst.',
        linkPath: `/modules/attendance/overview?event=${encodeURIComponent(eventId)}`,
        priority: 'info',
        recipientUserUuids: invitedUserUuids,
        metadata: { eventId },
      });

      return { status: 200, body: { ok: true, eventId, invitedUserUuids } };
    }

    // 7. Termin löschen
    if (method === 'DELETE' && eventDetailMatch) {
      if (!isStaff(role)) {
        return { status: 403, body: { fehler: 'Nur Coaches oder Team Admins dürfen Termine löschen.' } };
      }
      const eventId = decodeURIComponent(eventDetailMatch[1]);
      const scope = req.query.scope === 'series' ? 'series' : 'single';
      const evRes = await ctx.db.query<Record<string, unknown>>(
        `SELECT series_id FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
        [eventId, teamId]
      );
      if (evRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }
      const seriesId = evRes.rows[0].series_id ? String(evRes.rows[0].series_id) : null;

      if (scope === 'series' && seriesId) {
        const idsRes = await ctx.db.query<{ id: string }>(
          `SELECT id FROM mod_attendance_events WHERE team_id = $1 AND series_id = $2`,
          [teamId, seriesId]
        );
        const ids = idsRes.rows.map((r) => r.id);
        for (const id of ids) {
          await ctx.db.query(`DELETE FROM mod_attendance_responses WHERE event_id = $1`, [id]);
          await ctx.db.query(`DELETE FROM mod_attendance_checkins WHERE event_id = $1`, [id]);
          await ctx.db.query(`DELETE FROM mod_attendance_event_attachments WHERE event_id = $1`, [id]);
          await ctx.db.query(`DELETE FROM mod_attendance_reminder_log WHERE event_id = $1`, [id]);
        }
        await ctx.db.query(`DELETE FROM mod_attendance_events WHERE team_id = $1 AND series_id = $2`, [
          teamId,
          seriesId,
        ]);
        await ctx.db.query(`DELETE FROM mod_attendance_series WHERE id = $1 AND team_id = $2`, [
          seriesId,
          teamId,
        ]);
      } else {
        await ctx.db.query(`DELETE FROM mod_attendance_responses WHERE event_id = $1`, [eventId]);
        await ctx.db.query(`DELETE FROM mod_attendance_checkins WHERE event_id = $1`, [eventId]);
        await ctx.db.query(`DELETE FROM mod_attendance_event_attachments WHERE event_id = $1`, [eventId]);
        await ctx.db.query(`DELETE FROM mod_attendance_reminder_log WHERE event_id = $1`, [eventId]);
        await ctx.db.query(`DELETE FROM mod_attendance_events WHERE id = $1 AND team_id = $2`, [
          eventId,
          teamId,
        ]);
      }

      return { status: 200, body: { ok: true } };
    }

    // 8. Rückmeldung (4-Stufen-Statusmodell + Kommentar + Fristenprüfung)
    const rsvpMatch = /^\/events\/([^/]+)\/rsvp$/.exec(path);
    if (method === 'PUT' && rsvpMatch) {
      const eventId = decodeURIComponent(rsvpMatch[1]);
      const status = body.status as AttendanceStatus;
      if (!VALID_STATUSES.has(status)) {
        return { status: 400, body: { fehler: 'Ungültiger Anwesenheits-Status.' } };
      }

      const targetUserUuid =
        isStaff(role) && typeof body.targetUserUuid === 'string' && body.targetUserUuid.trim()
          ? body.targetUserUuid.trim()
          : userUuid;

      if (targetUserUuid !== userUuid && !isStaff(role)) {
        return { status: 403, body: { fehler: 'Nur Coaches/Admins dürfen fremde Rückmeldungen ändern.' } };
      }

      const [settings, evRes] = await Promise.all([
        getTeamSettings(ctx.db, teamId),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
          [eventId, teamId]
        ),
      ]);
      if (evRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }
      const ev = mapEventRow(evRes.rows[0]);
      const isTargetInvited = ev.invitedUserUuids.includes(targetUserUuid);
      if (!isTargetInvited) {
        return {
          status: 403,
          body: { fehler: 'Nur über die Zielgruppe eingeladene Nutzer können sich eintragen.' },
        };
      }

      const cutoffMinutes = getEffectiveCutoffMinutes(
        ev.cutoffMinutesOverride,
        settings.defaultCutoffMinutes
      );
      const evaluation = canEditRsvp({
        startsAtIso: ev.startsAt,
        cutoffMinutes,
        teamRolle: role,
        isInvited: isTargetInvited,
      });

      if (!evaluation.allowed) {
        return {
          status: 403,
          body: { fehler: 'Die Rückmeldefrist für diesen Termin ist abgelaufen.' },
        };
      }

      const comment = String(body.comment ?? '').trim().slice(0, 500);
      await ctx.db.query(
        `INSERT INTO mod_attendance_responses (
           event_id, team_id, user_uuid, status, comment, source, absence_id, manual_override, updated_by, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'MANUAL', NULL, TRUE, $6, NOW())
         ON CONFLICT (event_id, user_uuid) DO UPDATE SET
           status = EXCLUDED.status,
           comment = EXCLUDED.comment,
           source = 'MANUAL',
           manual_override = TRUE,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [eventId, teamId, targetUserUuid, status, comment, userUuid]
      );

      return {
        status: 200,
        body: {
          ok: true,
          response: {
            eventId,
            teamId,
            userUuid: targetUserUuid,
            status,
            comment,
            source: 'MANUAL',
            absenceId: null,
            manualOverride: true,
            updatedBy: userUuid,
            updatedAt: new Date().toISOString(),
          } satisfies AttendanceResponse,
        },
      };
    }

    // 9. Termingebundene Anhänge (Link & vorbereiteter Core-Attachment-Adapter)
    const attachmentsMatch = /^\/events\/([^/]+)\/attachments$/.exec(path);
    if (method === 'POST' && attachmentsMatch) {
      const eventId = decodeURIComponent(attachmentsMatch[1]);
      const evRes = await ctx.db.query<Record<string, unknown>>(
        `SELECT * FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
        [eventId, teamId]
      );
      if (evRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }
      const ev = mapEventRow(evRes.rows[0]);
      if (!isStaff(role)) {
        return {
          status: 403,
          body: { fehler: 'Nur Coaches oder Team Admins dürfen Links und Anhänge hinzufügen.' },
        };
      }

      const kind: AttachmentKind = body.kind === 'CORE_ATTACHMENT' ? 'CORE_ATTACHMENT' : 'LINK';
      const title = String(body.title ?? '').trim();
      const url = String(body.url ?? '').trim();
      const coreAttachmentId =
        typeof body.coreAttachmentId === 'string' && body.coreAttachmentId.trim()
          ? body.coreAttachmentId.trim()
          : null;
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : null;

      if (!title) {
        return { status: 400, body: { fehler: 'Titel des Anhangs ist erforderlich.' } };
      }
      if (kind === 'LINK' && (!url || !isSafeHttpUrl(url))) {
        return { status: 400, body: { fehler: 'Bitte eine gültige http(s)-URL angeben.' } };
      }
      if (kind === 'CORE_ATTACHMENT' && !coreAttachmentId) {
        return { status: 400, body: { fehler: 'coreAttachmentId erforderlich.' } };
      }

      const attId = `att-${crypto.randomUUID()}`;
      await ctx.db.query(
        `INSERT INTO mod_attendance_event_attachments (
           id, event_id, team_id, kind, title, url, core_attachment_id, mime_type, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [attId, eventId, teamId, kind, title, url, coreAttachmentId, mimeType, userUuid]
      );

      await safeSendNotification(ctx, {
        eventType: 'event.attachment_added',
        title: `Neuer Anhang zu "${ev.title}"`,
        message: `${title} wurde am Termin hinterlegt.`,
        linkPath: `/modules/attendance/overview?event=${encodeURIComponent(eventId)}`,
        priority: 'info',
        recipientUserUuids: ev.invitedUserUuids,
        metadata: { eventId, attachmentId: attId, kind },
      });

      return {
        status: 201,
        body: {
          attachment: {
            id: attId,
            eventId,
            teamId,
            kind,
            title,
            url,
            coreAttachmentId,
            mimeType,
            createdBy: userUuid,
            createdAt: new Date().toISOString(),
          } satisfies EventAttachment,
        },
      };
    }

    const attachmentDeleteMatch = /^\/events\/([^/]+)\/attachments\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && attachmentDeleteMatch) {
      const eventId = decodeURIComponent(attachmentDeleteMatch[1]);
      const attId = decodeURIComponent(attachmentDeleteMatch[2]);
      const evRes = await ctx.db.query<Record<string, unknown>>(
        `SELECT created_by FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
        [eventId, teamId]
      );
      if (evRes.rows.length === 0) {
        return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
      }
      if (!isStaff(role)) {
        return {
          status: 403,
          body: { fehler: 'Nur Coaches oder Team Admins dürfen Links und Anhänge entfernen.' },
        };
      }
      await ctx.db.query(
        `DELETE FROM mod_attendance_event_attachments WHERE id = $1 AND event_id = $2 AND team_id = $3`,
        [attId, eventId, teamId]
      );
      return { status: 200, body: { ok: true } };
    }

    // 10. Live-Check-In (Coach-Tool Opt-In)
    const checkinsMatch = /^\/events\/([^/]+)\/checkins$/.exec(path);
    if (checkinsMatch) {
      if (!isStaff(role)) {
        return { status: 403, body: { fehler: 'Live-Check-In ist Coaches und Admins vorbehalten.' } };
      }
      const settings = await getTeamSettings(ctx.db, teamId);
      if (!settings.liveCheckinEnabled) {
        return {
          status: 403,
          body: { fehler: 'Live-Check-In ist in den Team-Einstellungen deaktiviert.' },
        };
      }

      const eventId = decodeURIComponent(checkinsMatch[1]);
      if (method === 'GET') {
        const res = await ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_checkins WHERE event_id = $1 AND team_id = $2`,
          [eventId, teamId]
        );
        return { status: 200, body: { checkins: res.rows.map(mapCheckInRow) } };
      }

      if (method === 'PUT') {
        const targetUuid = String(body.userUuid ?? '').trim();
        const actualStatus = body.actualStatus as CheckInStatus;
        const note = String(body.note ?? '').trim().slice(0, 300);

        if (!targetUuid || !VALID_CHECKIN_STATUSES.has(actualStatus)) {
          return { status: 400, body: { fehler: 'Ungültige Check-In-Daten.' } };
        }

        const evRes = await ctx.db.query<Record<string, unknown>>(
          `SELECT invited_user_uuids_json FROM mod_attendance_events WHERE id = $1 AND team_id = $2`,
          [eventId, teamId]
        );
        if (evRes.rows.length === 0) {
          return { status: 404, body: { fehler: 'Termin nicht gefunden.' } };
        }
        const invited = parseJsonArray<string>(evRes.rows[0].invited_user_uuids_json);
        if (!invited.includes(targetUuid)) {
          return { status: 403, body: { fehler: 'Spieler ist zu diesem Termin nicht eingeladen.' } };
        }

        await ctx.db.query(
          `INSERT INTO mod_attendance_checkins (event_id, team_id, user_uuid, actual_status, note, checked_by, checked_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (event_id, user_uuid) DO UPDATE SET
             actual_status = EXCLUDED.actual_status,
             note = EXCLUDED.note,
             checked_by = EXCLUDED.checked_by,
             checked_at = NOW()`,
          [eventId, teamId, targetUuid, actualStatus, note, userUuid]
        );

        return {
          status: 200,
          body: {
            checkin: {
              eventId,
              teamId,
              userUuid: targetUuid,
              actualStatus,
              note,
              checkedBy: userUuid,
              checkedAt: new Date().toISOString(),
            } satisfies AttendanceCheckIn,
          },
        };
      }
    }

    // 11. Langzeitabwesenheiten
    if (method === 'GET' && path === '/absences') {
      const res = isStaff(role)
        ? await ctx.db.query<Record<string, unknown>>(
            `SELECT * FROM mod_attendance_absences WHERE team_id = $1 ORDER BY starts_on DESC`,
            [teamId]
          )
        : await ctx.db.query<Record<string, unknown>>(
            `SELECT * FROM mod_attendance_absences WHERE team_id = $1 AND user_uuid = $2 ORDER BY starts_on DESC`,
            [teamId, userUuid]
          );
      return { status: 200, body: { absences: res.rows.map(mapAbsenceRow) } };
    }

    if (method === 'POST' && path === '/absences') {
      const targetUserUuid =
        isStaff(role) && typeof body.targetUserUuid === 'string' && body.targetUserUuid.trim()
          ? body.targetUserUuid.trim()
          : userUuid;
      if (targetUserUuid !== userUuid && !isStaff(role)) {
        return { status: 403, body: { fehler: 'Keine Berechtigung für fremde Abwesenheiten.' } };
      }

      const startsOn = String(body.startsOn ?? '').trim();
      const endsOn = String(body.endsOn ?? '').trim();
      const reasonType: AbsenceReasonType = VALID_ABSENCE_TYPES.has(body.reasonType as AbsenceReasonType)
        ? (body.reasonType as AbsenceReasonType)
        : 'VACATION';
      const reasonText = String(body.reasonText ?? '').trim().slice(0, 300);

      if (!isValidIsoDateOnly(startsOn) || !isValidIsoDateOnly(endsOn) || endsOn < startsOn) {
        return { status: 400, body: { fehler: 'Bitte gültigen Datumsbereich (JJJJ-MM-TT) angeben.' } };
      }

      const absence: LongTermAbsence = {
        id: `abs-${crypto.randomUUID()}`,
        teamId,
        userUuid: targetUserUuid,
        reasonType,
        reasonText,
        startsOn,
        endsOn,
        createdAt: new Date().toISOString(),
      };

      await ctx.db.query(
        `INSERT INTO mod_attendance_absences (id, team_id, user_uuid, reason_type, reason_text, starts_on, ends_on)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          absence.id,
          teamId,
          absence.userUuid,
          absence.reasonType,
          absence.reasonText,
          absence.startsOn,
          absence.endsOn,
        ]
      );

      const autoUpdatedEvents = await syncSingleAbsenceToUpcomingEvents(ctx.db, teamId, absence);
      return { status: 201, body: { absence, autoUpdatedEvents } };
    }

    const absenceDeleteMatch = /^\/absences\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && absenceDeleteMatch) {
      const absenceId = decodeURIComponent(absenceDeleteMatch[1]);
      const existing = await ctx.db.query<Record<string, unknown>>(
        `SELECT * FROM mod_attendance_absences WHERE id = $1 AND team_id = $2`,
        [absenceId, teamId]
      );
      if (existing.rows.length === 0) {
        return { status: 404, body: { fehler: 'Abwesenheit nicht gefunden.' } };
      }
      const ownerUuid = String(existing.rows[0].user_uuid);
      if (ownerUuid !== userUuid && !isStaff(role)) {
        return { status: 403, body: { fehler: 'Keine Berechtigung zum Löschen dieser Abwesenheit.' } };
      }

      await ctx.db.query(
        `DELETE FROM mod_attendance_responses
         WHERE team_id = $1 AND absence_id = $2 AND source = 'LONG_TERM_ABSENCE' AND manual_override = FALSE`,
        [teamId, absenceId]
      );
      await ctx.db.query(`DELETE FROM mod_attendance_absences WHERE id = $1 AND team_id = $2`, [
        absenceId,
        teamId,
      ]);
      return { status: 200, body: { ok: true } };
    }

    // 12. Statistiken & CSV-Export
    if (method === 'GET' && (path === '/stats' || path === '/stats/export')) {
      const season = typeof req.query.season === 'string' && req.query.season ? req.query.season : ctx.team.aktiveSaison;
      const fromIso = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
      const toIso = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;

      const [eventsRes, responsesRes, checkinsRes, roster] = await Promise.all([
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_events WHERE team_id = $1 AND ($2 = 'ALL' OR season = $2)`,
          [teamId, season]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_responses WHERE team_id = $1`,
          [teamId]
        ),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_checkins WHERE team_id = $1`,
          [teamId]
        ),
        getRoster(ctx.db, teamId),
      ]);

      const report = calculateStatsReport({
        events: eventsRes.rows.map(mapEventRow),
        responses: responsesRes.rows.map(mapResponseRow),
        checkins: checkinsRes.rows.map(mapCheckInRow),
        roster,
        fromIso,
        toIso,
      });

      const scopedPlayers = isStaff(role)
        ? report.players
        : report.players.filter((p) => p.userUuid === userUuid);

      if (path === '/stats/export') {
        if (!isStaff(role)) {
          return { status: 403, body: { fehler: 'CSV-Export ist Coaches und Team Admins vorbehalten.' } };
        }
        return {
          status: 200,
          body: {
            filename: `attendance-stats-${teamId}-${season}.csv`,
            csv: buildStatsCsv(scopedPlayers),
          },
        };
      }

      return {
        status: 200,
        body: {
          ...report,
          players: scopedPlayers,
        },
      };
    }

    // 13. Einstellungen (Team & Benutzer)
    if (method === 'GET' && path === '/settings') {
      const [settings, userPrefRes] = await Promise.all([
        getTeamSettings(ctx.db, teamId),
        ctx.db.query<Record<string, unknown>>(
          `SELECT * FROM mod_attendance_user_settings WHERE team_id = $1 AND user_uuid = $2`,
          [teamId, userUuid]
        ),
      ]);
      return {
        status: 200,
        body: {
          settings,
          userSettings: mapUserSettings(teamId, userUuid, userPrefRes.rows[0]),
        },
      };
    }

    if (method === 'PUT' && path === '/settings') {
      if (role !== 'TEAM_ADMIN') {
        return { status: 403, body: { fehler: 'Nur Team Admins dürfen Team-Einstellungen ändern.' } };
      }

      const nonInvitedVisibility: NonInvitedVisibility =
        body.nonInvitedVisibility === 'HIDDEN' ? 'HIDDEN' : 'TRANSPARENT';
      const responseVisibility: ResponseVisibility =
        body.responseVisibility === 'STAFF_ONLY' ? 'STAFF_ONLY' : 'TEAM';
      const defaultCutoffMinutes =
        typeof body.defaultCutoffMinutes === 'number' && Number.isFinite(body.defaultCutoffMinutes) && body.defaultCutoffMinutes >= 0
          ? Math.floor(body.defaultCutoffMinutes)
          : 240;
      const liveCheckinEnabled = Boolean(body.liveCheckinEnabled);
      const reminderHoursBefore =
        typeof body.reminderHoursBefore === 'number' && Number.isFinite(body.reminderHoursBefore) && body.reminderHoursBefore >= 1
          ? Math.floor(body.reminderHoursBefore)
          : 24;

      await ctx.db.query(
        `INSERT INTO mod_attendance_team_settings (
           team_id, non_invited_visibility, response_visibility, default_cutoff_minutes,
           live_checkin_enabled, reminder_hours_before, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (team_id) DO UPDATE SET
           non_invited_visibility = EXCLUDED.non_invited_visibility,
           response_visibility = EXCLUDED.response_visibility,
           default_cutoff_minutes = EXCLUDED.default_cutoff_minutes,
           live_checkin_enabled = EXCLUDED.live_checkin_enabled,
           reminder_hours_before = EXCLUDED.reminder_hours_before,
           updated_at = NOW()`,
        [
          teamId,
          nonInvitedVisibility,
          responseVisibility,
          defaultCutoffMinutes,
          liveCheckinEnabled,
          reminderHoursBefore,
        ]
      );

      return {
        status: 200,
        body: {
          settings: {
            teamId,
            nonInvitedVisibility,
            responseVisibility,
            defaultCutoffMinutes,
            liveCheckinEnabled,
            reminderHoursBefore,
            updatedAt: new Date().toISOString(),
          } satisfies TeamAttendanceSettings,
        },
      };
    }

    if (method === 'PUT' && path === '/settings/user') {
      const notifyOnInvite = body.notifyOnInvite !== false;
      const notifyBeforeCutoff = body.notifyBeforeCutoff !== false;

      await ctx.db.query(
        `INSERT INTO mod_attendance_user_settings (team_id, user_uuid, notify_on_invite, notify_before_cutoff, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (team_id, user_uuid) DO UPDATE SET
           notify_on_invite = EXCLUDED.notify_on_invite,
           notify_before_cutoff = EXCLUDED.notify_before_cutoff,
           updated_at = NOW()`,
        [teamId, userUuid, notifyOnInvite, notifyBeforeCutoff]
      );

      return {
        status: 200,
        body: {
          userSettings: {
            teamId,
            userUuid,
            notifyOnInvite,
            notifyBeforeCutoff,
            updatedAt: new Date().toISOString(),
          } satisfies UserAttendanceSettings,
        },
      };
    }

    // 14. Vorbereiteter Cron- / Notification-Dispatch-Endpunkt
    if (method === 'POST' && path === '/reminders/dispatch') {
      if (!isStaff(role)) {
        return { status: 403, body: { fehler: 'Nur Coaches oder Team Admins dürfen Erinnerungen auslösen.' } };
      }
      const result = await dispatchDueReminders(ctx);
      return { status: 200, body: result };
    }

    return { status: 404, body: { fehler: `Unbekannte Attendance-Route: ${method} ${path}` } };
  },
};

export default backendPlugin;
