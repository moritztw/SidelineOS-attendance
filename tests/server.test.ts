import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  NotificationPayload,
  PluginBackendKontext,
  PluginDbScope,
  TeamRolle,
} from '@sidelineos/plugin-sdk';
import backendPlugin, { dispatchDueReminders } from '../src/server.ts';

function createMockDb(): PluginDbScope {
  const tables = {
    teamSettings: new Map<string, Record<string, unknown>>(),
    userSettings: new Map<string, Record<string, unknown>>(),
    roster: new Map<string, Record<string, unknown>>(),
    series: new Map<string, Record<string, unknown>>(),
    events: new Map<string, Record<string, unknown>>(),
    responses: new Map<string, Record<string, unknown>>(),
    checkins: new Map<string, Record<string, unknown>>(),
    absences: new Map<string, Record<string, unknown>>(),
    attachments: new Map<string, Record<string, unknown>>(),
    reminderLog: new Map<string, Record<string, unknown>>(),
  };

  return {
    schemaName: 'plugin_attendance',
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const s = sql.replace(/\s+/g, ' ').trim();

      // Roster Cache
      if (s.startsWith('INSERT INTO mod_attendance_roster_cache')) {
        const key = `${params[0]}::${params[1]}`;
        tables.roster.set(key, {
          team_id: params[0],
          user_uuid: params[1],
          voller_name: params[2],
          benutzername: params[3],
          rolle: params[4],
          units_json: JSON.parse(String(params[5])),
          position: params[6],
          trikot_nummer: params[7],
          status: params[8],
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_roster_cache WHERE team_id = $1')) {
        const rows = Array.from(tables.roster.values()).filter((r) => r.team_id === params[0]);
        return { rows: rows as T[], rowCount: rows.length };
      }

      // Team Settings
      if (s.startsWith('SELECT * FROM mod_attendance_team_settings WHERE team_id = $1')) {
        const row = tables.teamSettings.get(String(params[0]));
        return { rows: (row ? [row] : []) as T[], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('INSERT INTO mod_attendance_team_settings')) {
        tables.teamSettings.set(String(params[0]), {
          team_id: params[0],
          non_invited_visibility: params[1],
          response_visibility: params[2],
          default_cutoff_minutes: params[3],
          live_checkin_enabled: params[4],
          reminder_hours_before: params[5],
          updated_at: new Date(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      // User Settings
      if (s.startsWith('SELECT * FROM mod_attendance_user_settings WHERE team_id = $1 AND user_uuid = $2')) {
        const row = tables.userSettings.get(`${params[0]}::${params[1]}`);
        return { rows: (row ? [row] : []) as T[], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_user_settings WHERE team_id = $1')) {
        const rows = Array.from(tables.userSettings.values()).filter((r) => r.team_id === params[0]);
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('INSERT INTO mod_attendance_user_settings')) {
        tables.userSettings.set(`${params[0]}::${params[1]}`, {
          team_id: params[0],
          user_uuid: params[1],
          notify_on_invite: params[2],
          notify_before_cutoff: params[3],
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      // Events
      if (s.startsWith('INSERT INTO mod_attendance_events')) {
        tables.events.set(String(params[0]), {
          id: params[0],
          team_id: params[1],
          season: params[2],
          series_id: params[3],
          title: params[4],
          description: params[5],
          category: params[6],
          location: params[7],
          starts_at: params[8],
          ends_at: params[9],
          cutoff_minutes_override: params[10],
          target_all: params[11],
          target_units_json: JSON.parse(String(params[12])),
          target_positions_json: JSON.parse(String(params[13])),
          target_roles_json: JSON.parse(String(params[14])),
          target_user_uuids_json: JSON.parse(String(params[15])),
          invited_user_uuids_json: JSON.parse(String(params[16])),
          created_by: params[17],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_events WHERE id = $1 AND team_id = $2')) {
        const row = tables.events.get(String(params[0]));
        const matched = row && row.team_id === params[1] ? [row] : [];
        return { rows: matched as T[], rowCount: matched.length };
      }
      if (s.startsWith('SELECT invited_user_uuids_json FROM mod_attendance_events WHERE id = $1')) {
        const row = tables.events.get(String(params[0]));
        const matched = row && row.team_id === params[1] ? [row] : [];
        return { rows: matched as T[], rowCount: matched.length };
      }
      if (s.startsWith('SELECT created_by FROM mod_attendance_events WHERE id = $1')) {
        const row = tables.events.get(String(params[0]));
        const matched = row && row.team_id === params[1] ? [row] : [];
        return { rows: matched as T[], rowCount: matched.length };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_events WHERE team_id = $1 AND starts_at >')) {
        const rows = Array.from(tables.events.values()).filter(
          (r) => r.team_id === params[0] && String(r.starts_at) >= String(params[1])
        );
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_events WHERE team_id = $1')) {
        const rows = Array.from(tables.events.values()).filter(
          (r) => r.team_id === params[0] && (!params[1] || params[1] === 'ALL' || r.season === params[1])
        );
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('UPDATE mod_attendance_events SET invited_user_uuids_json')) {
        const row = tables.events.get(String(params[1]));
        if (row) row.invited_user_uuids_json = JSON.parse(String(params[0]));
        return { rows: [] as T[], rowCount: row ? 1 : 0 };
      }

      // Responses
      if (s.startsWith('SELECT manual_override FROM mod_attendance_responses')) {
        const row = tables.responses.get(`${params[0]}::${params[1]}`);
        return { rows: (row ? [row] : []) as T[], rowCount: row ? 1 : 0 };
      }
      if (s.startsWith('INSERT INTO mod_attendance_responses')) {
        const key = `${params[0]}::${params[2]}`;
        const existing = tables.responses.get(key);
        if (s.includes('ON CONFLICT (event_id, user_uuid) DO NOTHING') && existing) {
          return { rows: [] as T[], rowCount: 0 };
        }
        if (s.includes('WHERE mod_attendance_responses.manual_override = FALSE') && existing?.manual_override) {
          return { rows: [] as T[], rowCount: 0 };
        }
        const isManual = s.includes("'MANUAL'");
        tables.responses.set(key, {
          event_id: params[0],
          team_id: params[1],
          user_uuid: params[2],
          status: isManual ? params[3] : 'ABSENT',
          comment: isManual ? params[4] : params[3],
          source: isManual ? 'MANUAL' : 'LONG_TERM_ABSENCE',
          absence_id: isManual ? null : params[4],
          manual_override: isManual,
          updated_by: isManual ? params[5] : params[2],
          updated_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_responses WHERE event_id = $1 AND team_id = $2')) {
        const rows = Array.from(tables.responses.values()).filter(
          (r) => r.event_id === params[0] && r.team_id === params[1]
        );
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_responses WHERE team_id = $1')) {
        const rows = Array.from(tables.responses.values()).filter((r) => r.team_id === params[0]);
        return { rows: rows as T[], rowCount: rows.length };
      }

      // Absences
      if (s.startsWith('INSERT INTO mod_attendance_absences')) {
        tables.absences.set(String(params[0]), {
          id: params[0],
          team_id: params[1],
          user_uuid: params[2],
          reason_type: params[3],
          reason_text: params[4],
          starts_on: params[5],
          ends_on: params[6],
          created_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_absences WHERE team_id = $1 AND user_uuid = $2')) {
        const rows = Array.from(tables.absences.values()).filter(
          (r) => r.team_id === params[0] && r.user_uuid === params[1]
        );
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_absences WHERE team_id = $1')) {
        const rows = Array.from(tables.absences.values()).filter((r) => r.team_id === params[0]);
        return { rows: rows as T[], rowCount: rows.length };
      }

      // Attachments
      if (s.startsWith('SELECT event_id, COUNT(*)::int AS cnt FROM mod_attendance_event_attachments')) {
        return { rows: [] as T[], rowCount: 0 };
      }
      if (s.startsWith('SELECT * FROM mod_attendance_event_attachments')) {
        const rows = Array.from(tables.attachments.values()).filter(
          (r) => r.event_id === params[0] && r.team_id === params[1]
        );
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('INSERT INTO mod_attendance_event_attachments')) {
        tables.attachments.set(String(params[0]), {
          id: params[0],
          event_id: params[1],
          team_id: params[2],
          kind: params[3],
          title: params[4],
          url: params[5],
          core_attachment_id: params[6],
          mime_type: params[7],
          created_by: params[8],
          created_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      // Checkins
      if (s.startsWith('SELECT * FROM mod_attendance_checkins')) {
        const rows = Array.from(tables.checkins.values()).filter((r) => r.team_id === params[0] || r.event_id === params[0]);
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('INSERT INTO mod_attendance_checkins')) {
        tables.checkins.set(`${params[0]}::${params[2]}`, {
          event_id: params[0],
          team_id: params[1],
          user_uuid: params[2],
          actual_status: params[3],
          note: params[4],
          checked_by: params[5],
          checked_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      // Reminder log
      if (s.startsWith('SELECT l.* FROM mod_attendance_reminder_log')) {
        const rows = Array.from(tables.reminderLog.values());
        return { rows: rows as T[], rowCount: rows.length };
      }
      if (s.startsWith('INSERT INTO mod_attendance_reminder_log')) {
        tables.reminderLog.set(`${params[0]}::${params[1]}::${params[2]}`, {
          event_id: params[0],
          user_uuid: params[1],
          reminder_kind: params[2],
          sent_at: new Date().toISOString(),
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      return { rows: [] as T[], rowCount: 0 };
    },
  };
}

function createCtx(
  db: PluginDbScope,
  role: TeamRolle,
  userUuid: string,
  notificationsSent: NotificationPayload[]
): PluginBackendKontext {
  return {
    pluginId: 'attendance',
    manifest: backendPlugin.manifest,
    db,
    user: {
      uuid: userUuid,
      benutzername: userUuid,
      vollerName: userUuid,
      email: `${userUuid}@example.com`,
      istSysadmin: false,
      erstelltAm: '2026-01-01T00:00:00.000Z',
      customProfilWerte: {},
    },
    locale: 'de',
    team: {
      id: 'team-1',
      name: 'Munich Eagles',
      kurzname: 'ME',
      aktiveSaison: '2026',
      saisons: ['2026'],
      aktivierteModule: ['attendance'],
      customProfilFelder: [],
    },
    teamRolle: role,
    hasPermission: (p) => backendPlugin.manifest.permissions.includes(p),
    notifications: {
      async send(payload) {
        notificationsSent.push(payload);
        return { notificationIds: ['n1'], recipientCount: payload.recipientUserUuids?.length ?? 0, channelResults: [] };
      },
      async listChannels() {
        return [];
      },
    },
  };
}

test('Backend-Integration: RBAC, Zielgruppen-Einladung, Privacy, Abwesenheit, Check-In & Reminder', async () => {
  const db = createMockDb();
  const sent: NotificationPayload[] = [];
  const adminCtx = createCtx(db, 'TEAM_ADMIN', 'u-admin', sent);
  const qbCtx = createCtx(db, 'PLAYER', 'u-qb', sent);
  const lbCtx = createCtx(db, 'PLAYER', 'u-lb', sent);

  // Roster synchronisieren
  const syncRes = await backendPlugin.handleRequest!(
    {
      method: 'POST',
      path: '/roster-sync',
      params: {},
      query: {},
      body: {
        members: [
          {
            userUuid: 'u-admin',
            vollerName: 'Admin',
            benutzername: 'admin',
            rolle: 'TEAM_ADMIN',
            units: ['OFFENSE'],
            position: 'HC',
            trikotNummer: '',
            status: 'AKTIV',
          },
          {
            userUuid: 'u-qb',
            vollerName: 'QB One',
            benutzername: 'qb1',
            rolle: 'PLAYER',
            units: ['OFFENSE'],
            position: 'QB',
            trikotNummer: '12',
            status: 'AKTIV',
          },
          {
            userUuid: 'u-lb',
            vollerName: 'LB Fifty',
            benutzername: 'lb50',
            rolle: 'PLAYER',
            units: ['DEFENSE'],
            position: 'OLB',
            trikotNummer: '50',
            status: 'AKTIV',
          },
        ],
      },
    },
    adminCtx
  );
  assert.equal(syncRes.status, 200);

  // Spieler darf keine Termine anlegen
  const forbiddenCreate = await backendPlugin.handleRequest!(
    {
      method: 'POST',
      path: '/events',
      params: {},
      query: {},
      body: {
        title: 'Illegal',
        startsAt: '2026-08-01T18:00:00.000Z',
        endsAt: '2026-08-01T20:00:00.000Z',
      },
    },
    qbCtx
  );
  assert.equal(forbiddenCreate.status, 403);

  // Admin konfiguriert: Nicht-Eingeladene HIDDEN, Rückmeldungen STAFF_ONLY, Live-Check-In an
  const settingsRes = await backendPlugin.handleRequest!(
    {
      method: 'PUT',
      path: '/settings',
      params: {},
      query: {},
      body: {
        nonInvitedVisibility: 'HIDDEN',
        responseVisibility: 'STAFF_ONLY',
        defaultCutoffMinutes: 120,
        liveCheckinEnabled: true,
        reminderHoursBefore: 24,
      },
    },
    adminCtx
  );
  assert.equal(settingsRes.status, 200);

  // Admin legt Defense-Meeting an (nur u-lb eingeladen, nicht u-qb)
  const startsAt = new Date(Date.now() + 10 * 3_600_000).toISOString();
  const endsAt = new Date(Date.now() + 12 * 3_600_000).toISOString();
  const createRes = await backendPlugin.handleRequest!(
    {
      method: 'POST',
      path: '/events',
      params: {},
      query: {},
      body: {
        title: 'Defense Positional Meeting',
        category: 'MEETING',
        startsAt,
        endsAt,
        targetAll: false,
        targetUnits: ['DEFENSE'],
        targetPositions: [],
        targetRoles: [],
        targetUserUuids: [],
      },
    },
    adminCtx
  );
  assert.equal(createRes.status, 201);
  const eventId = (createRes.body as { eventIds: string[] }).eventIds[0];

  // u-qb sieht HIDDEN Termin nicht in /events und bekommt 403 auf /events/:id
  const qbList = await backendPlugin.handleRequest!(
    { method: 'GET', path: '/events', params: {}, query: {}, body: {} },
    qbCtx
  );
  assert.equal((qbList.body as { events: unknown[] }).events.length, 0);

  const qbDetail = await backendPlugin.handleRequest!(
    { method: 'GET', path: `/events/${eventId}`, params: {}, query: {}, body: {} },
    qbCtx
  );
  assert.equal(qbDetail.status, 403);

  // u-lb meldet sich INACTIVE an
  const rsvpRes = await backendPlugin.handleRequest!(
    {
      method: 'PUT',
      path: `/events/${eventId}/rsvp`,
      params: {},
      query: {},
      body: { status: 'INACTIVE', comment: 'Leichte Zerrung' },
    },
    lbCtx
  );
  assert.equal(rsvpRes.status, 200);

  // Admin fügt Link-Anhang hinzu -> Notification wird ausgelöst
  const attRes = await backendPlugin.handleRequest!(
    {
      method: 'POST',
      path: `/events/${eventId}/attachments`,
      params: {},
      query: {},
      body: { kind: 'LINK', title: 'Defense Film', url: 'https://example.com/film' },
    },
    adminCtx
  );
  assert.equal(attRes.status, 201);
  assert.ok(sent.some((n) => n.eventType === 'event.attachment_added'));

  // Live Check-In durch Coach/Admin
  const checkinRes = await backendPlugin.handleRequest!(
    {
      method: 'PUT',
      path: `/events/${eventId}/checkins`,
      params: {},
      query: {},
      body: { userUuid: 'u-lb', actualStatus: 'INACTIVE' },
    },
    adminCtx
  );
  assert.equal(checkinRes.status, 200);

  // Team-Training für alle in 8h anlegen -> Reminder-Dispatch benachrichtigt nur u-qb (u-lb antwortet oder fehlt)
  const remEventRes = await backendPlugin.handleRequest!(
    {
      method: 'POST',
      path: '/events',
      params: {},
      query: {},
      body: {
        title: 'Team Walk-Through',
        category: 'TRAINING',
        startsAt: new Date(Date.now() + 8 * 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 9 * 3_600_000).toISOString(),
        targetAll: true,
      },
    },
    adminCtx
  );
  assert.equal(remEventRes.status, 201);

  const remResult = await dispatchDueReminders(adminCtx);
  assert.equal(remResult.batchesSent, 1);
  assert.ok(remResult.recipientsNotified >= 2);
});
