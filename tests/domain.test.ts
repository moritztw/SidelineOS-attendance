import assert from 'node:assert/strict';
import test from 'node:test';
import { doesEventOverlapAbsence, findMatchingAbsenceForEvent } from '../src/services/absences.ts';
import { canEditRsvp, getEffectiveCutoffMinutes } from '../src/services/cutoff.ts';
import { generateSeriesOccurrences } from '../src/services/recurrence.ts';
import { findDueReminders } from '../src/services/reminders.ts';
import {
  buildEventDetailUrl,
  buildTabBaseUrl,
  readEventIdFromUrl,
} from '../src/services/routing.ts';
import { buildStatsCsv, calculateStatsReport } from '../src/services/stats.ts';
import {
  collectAvailablePositions,
  evaluateMemberInvitation,
  filterParticipants,
  resolveInvitedUserUuids,
} from '../src/services/targeting.ts';
import type {
  AttendanceEvent,
  AttendanceResponse,
  LongTermAbsence,
  RosterMember,
  TeamAttendanceSettings,
  UserAttendanceSettings,
} from '../src/types.ts';

const ROSTER: RosterMember[] = [
  {
    userUuid: 'u-qb',
    vollerName: 'Max Mustermann',
    benutzername: 'mmustermann',
    rolle: 'PLAYER',
    units: ['OFFENSE'],
    position: 'QB',
    trikotNummer: '12',
    status: 'AKTIV',
  },
  {
    userUuid: 'u-lb',
    vollerName: 'Lukas Weber',
    benutzername: 'lweber',
    rolle: 'PLAYER',
    units: ['DEFENSE', 'SPECIAL_TEAMS'],
    position: 'OLB',
    trikotNummer: '54',
    status: 'AKTIV',
  },
  {
    userUuid: 'u-coach',
    vollerName: 'Coach Klein',
    benutzername: 'cklein',
    rolle: 'COACH',
    units: ['DEFENSE'],
    position: 'DC',
    trikotNummer: '',
    status: 'AKTIV',
  },
  {
    userUuid: 'u-pending',
    vollerName: 'Wartend',
    benutzername: 'wartend',
    rolle: 'PLAYER',
    units: ['OFFENSE'],
    position: 'WR',
    trikotNummer: '88',
    status: 'WARTET_AUF_FREIGABE',
  },
];

test('Zielgruppen-Auflösung über Units, Positionen, Rollen und Einzelpersonen', () => {
  const defenseCriteria = {
    targetAll: false,
    targetUnits: ['DEFENSE' as const],
    targetPositions: [],
    targetRoles: [],
    targetUserUuids: [],
  };
  assert.deepEqual(resolveInvitedUserUuids(ROSTER, defenseCriteria), ['u-lb', 'u-coach']);

  const qbCriteria = {
    targetAll: false,
    targetUnits: [],
    targetPositions: ['QB'],
    targetRoles: [],
    targetUserUuids: [],
  };
  assert.deepEqual(resolveInvitedUserUuids(ROSTER, qbCriteria), ['u-qb']);

  // Wartende Mitglieder werden nicht eingeladen, auch bei targetAll = true
  const allActive = resolveInvitedUserUuids(ROSTER, {
    targetAll: true,
    targetUnits: [],
    targetPositions: [],
    targetRoles: [],
    targetUserUuids: [],
  });
  assert.deepEqual(allActive, ['u-qb', 'u-lb', 'u-coach']);
  assert.equal(evaluateMemberInvitation(ROSTER[3], { ...qbCriteria, targetAll: true }), false);

  const positions = collectAvailablePositions(ROSTER);
  assert.ok(positions.includes('QB'));
  assert.ok(positions.includes('DC'));
});

test('Teilnehmer-Filterung nach Unit, Position, Status und Suchtext', () => {
  const participants = [
    { member: ROSTER[0], response: null, checkin: null },
    {
      member: ROSTER[1],
      response: {
        eventId: 'e1',
        teamId: 't1',
        userUuid: 'u-lb',
        status: 'PRESENT' as const,
        comment: '',
        source: 'MANUAL' as const,
        absenceId: null,
        manualOverride: true,
        updatedBy: 'u-lb',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
      checkin: null,
    },
  ];

  assert.equal(filterParticipants(participants, { unit: 'DEFENSE' }).length, 1);
  assert.equal(filterParticipants(participants, { position: 'QB' }).length, 1);
  assert.equal(filterParticipants(participants, { status: 'UNANSWERED' }).length, 1);
  assert.equal(filterParticipants(participants, { query: '#54' }).length, 1);
});

test('Cut-Off-Fristen sperren Spieler nach Fristablauf, erlauben aber Coach-Override', () => {
  const effective = getEffectiveCutoffMinutes(null, 240);
  assert.equal(effective, 240);
  assert.equal(getEffectiveCutoffMinutes(60, 240), 60);

  const startsAtIso = '2026-07-01T18:00:00.000Z';
  const beforeDeadline = new Date('2026-07-01T12:00:00.000Z');
  const afterDeadline = new Date('2026-07-01T15:00:00.000Z');

  assert.equal(
    canEditRsvp({
      startsAtIso,
      cutoffMinutes: 240,
      teamRolle: 'PLAYER',
      isInvited: true,
      now: beforeDeadline,
    }).allowed,
    true
  );

  const locked = canEditRsvp({
    startsAtIso,
    cutoffMinutes: 240,
    teamRolle: 'PLAYER',
    isInvited: true,
    now: afterDeadline,
  });
  assert.equal(locked.allowed, false);
  assert.equal(locked.reason, 'DEADLINE_PASSED');

  const coachOverride = canEditRsvp({
    startsAtIso,
    cutoffMinutes: 240,
    teamRolle: 'COACH',
    isInvited: true,
    now: afterDeadline,
  });
  assert.equal(coachOverride.allowed, true);
  assert.equal(coachOverride.reason, 'STAFF_OVERRIDE');

  assert.equal(
    canEditRsvp({
      startsAtIso,
      cutoffMinutes: 240,
      teamRolle: 'PLAYER',
      isInvited: false,
      now: beforeDeadline,
    }).reason,
    'NOT_INVITED'
  );
});

test('Serientermine generieren eigenständige Einzeltermine', () => {
  const slots = generateSeriesOccurrences({
    startsAtIso: '2026-06-01T17:00:00.000Z',
    endsAtIso: '2026-06-01T19:00:00.000Z',
    recurrenceKind: 'WEEKLY',
    untilDate: '2026-06-22',
  });
  assert.equal(slots.length, 4);
  assert.equal(slots[0].startsAt, '2026-06-01T17:00:00.000Z');
  assert.equal(slots[3].startsAt, '2026-06-22T17:00:00.000Z');
});

test('Langzeitabwesenheiten gleichen Datumsgrenzen sauber ab', () => {
  const absence: LongTermAbsence = {
    id: 'abs-1',
    teamId: 't1',
    userUuid: 'u-qb',
    reasonType: 'VACATION',
    reasonText: 'Sommerurlaub',
    startsOn: '2026-08-01',
    endsOn: '2026-08-14',
    createdAt: '2026-07-01T00:00:00.000Z',
  };

  assert.equal(doesEventOverlapAbsence('2026-08-01T18:00:00.000Z', absence), true);
  assert.equal(doesEventOverlapAbsence('2026-08-14T18:00:00.000Z', absence), true);
  assert.equal(doesEventOverlapAbsence('2026-08-15T18:00:00.000Z', absence), false);
  assert.equal(findMatchingAbsenceForEvent('2026-08-05T18:00:00.000Z', [absence])?.id, 'abs-1');
});

test('Statistik-Berechnung berücksichtigt ausschließlich eingeladene Termine und exportiert CSV', () => {
  const events: AttendanceEvent[] = [
    {
      id: 'e1',
      teamId: 't1',
      season: '2026',
      seriesId: null,
      title: 'Team Training',
      description: '',
      category: 'TRAINING',
      location: '',
      startsAt: '2026-06-01T18:00:00.000Z',
      endsAt: '2026-06-01T20:00:00.000Z',
      cutoffMinutesOverride: null,
      targetAll: true,
      targetUnits: [],
      targetPositions: [],
      targetRoles: [],
      targetUserUuids: [],
      invitedUserUuids: ['u-qb', 'u-lb'],
      createdBy: 'u-coach',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'e2',
      teamId: 't1',
      season: '2026',
      seriesId: null,
      title: 'Defense Meeting',
      description: '',
      category: 'MEETING',
      location: '',
      startsAt: '2026-06-03T18:00:00.000Z',
      endsAt: '2026-06-03T19:00:00.000Z',
      cutoffMinutesOverride: null,
      targetAll: false,
      targetUnits: ['DEFENSE'],
      targetPositions: [],
      targetRoles: [],
      targetUserUuids: [],
      invitedUserUuids: ['u-lb'],
      createdBy: 'u-coach',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const responses: AttendanceResponse[] = [
    {
      eventId: 'e1',
      teamId: 't1',
      userUuid: 'u-qb',
      status: 'PRESENT',
      comment: '',
      source: 'MANUAL',
      absenceId: null,
      manualOverride: true,
      updatedBy: 'u-qb',
      updatedAt: '',
    },
    {
      eventId: 'e1',
      teamId: 't1',
      userUuid: 'u-lb',
      status: 'INACTIVE',
      comment: 'Knöchel',
      source: 'MANUAL',
      absenceId: null,
      manualOverride: true,
      updatedBy: 'u-lb',
      updatedAt: '',
    },
    {
      eventId: 'e2',
      teamId: 't1',
      userUuid: 'u-lb',
      status: 'PRESENT',
      comment: '',
      source: 'MANUAL',
      absenceId: null,
      manualOverride: true,
      updatedBy: 'u-lb',
      updatedAt: '',
    },
  ];

  const report = calculateStatsReport({
    events,
    responses,
    checkins: [],
    roster: ROSTER,
  });

  const qbStat = report.players.find((p) => p.userUuid === 'u-qb')!;
  const lbStat = report.players.find((p) => p.userUuid === 'u-lb')!;
  assert.equal(qbStat.invitedCount, 1);
  assert.equal(qbStat.attendanceRatePercent, 100);
  assert.equal(lbStat.invitedCount, 2);
  assert.equal(lbStat.presentCount, 1);
  assert.equal(lbStat.inactiveCount, 1);
  assert.equal(lbStat.attendanceRatePercent, 50);
  assert.equal(lbStat.activeOrSidelineRatePercent, 100);

  const csv = buildStatsCsv(report.players);
  assert.match(csv, /Max Mustermann/);
  assert.match(csv, /100\.0/);
});

test('Erinnerungs-Logik findet fällige offene Einladungen ohne Doppelversand', () => {
  const settings: TeamAttendanceSettings = {
    teamId: 't1',
    nonInvitedVisibility: 'TRANSPARENT',
    responseVisibility: 'TEAM',
    defaultCutoffMinutes: 240,
    liveCheckinEnabled: false,
    reminderHoursBefore: 24,
  };

  const event: AttendanceEvent = {
    id: 'e-rem',
    teamId: 't1',
    season: '2026',
    seriesId: null,
    title: 'Freitags-Training',
    description: '',
    category: 'TRAINING',
    location: '',
    startsAt: '2026-07-10T18:00:00.000Z',
    endsAt: '2026-07-10T20:00:00.000Z',
    cutoffMinutesOverride: null,
    targetAll: true,
    targetUnits: [],
    targetPositions: [],
    targetRoles: [],
    targetUserUuids: [],
    invitedUserUuids: ['u-qb', 'u-lb'],
    createdBy: 'u-coach',
    createdAt: '',
    updatedAt: '',
  };

  // Cutoff ist 14:00Z; 12h vorher (02:00Z) liegt im 24h-Vorlauf-Fenster
  const now = new Date('2026-07-10T02:00:00.000Z');
  const userSettingsMap = new Map<string, UserAttendanceSettings>([
    [
      'u-lb',
      { teamId: 't1', userUuid: 'u-lb', notifyOnInvite: true, notifyBeforeCutoff: false },
    ],
  ]);

  const batches = findDueReminders({
    events: [event],
    responses: [],
    reminderLog: [],
    teamSettings: settings,
    userSettingsMap,
    now,
  });

  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].recipientUserUuids, ['u-qb']);

  const afterLog = findDueReminders({
    events: [event],
    responses: [],
    reminderLog: [
      {
        eventId: 'e-rem',
        userUuid: 'u-qb',
        reminderKind: 'CUTOFF_REMINDER',
        sentAt: now.toISOString(),
      },
    ],
    teamSettings: settings,
    userSettingsMap,
    now,
  });
  assert.equal(afterLog.length, 0);
});

test('Deep-Link-Routing für Termindetails erzeugt Core-kompatible URLs und überlebt Reloads', () => {
  const fromCalendar = buildEventDetailUrl('evt-123', {
    currentTab: 'calendar',
    currentPathname: '/modules/attendance/calendar',
    currentSearch: '',
  });
  assert.equal(fromCalendar, '/modules/attendance/calendar?event=evt-123');
  assert.equal(readEventIdFromUrl({ search: '?event=evt-123' }), 'evt-123');
  assert.equal(readEventIdFromUrl({ search: '', hash: '#event=evt-456' }), 'evt-456');

  const fromUnknownTab = buildEventDetailUrl('evt-123', {
    currentTab: 'stats',
    currentPathname: '/modules/attendance/stats',
    currentSearch: '?foo=bar',
  });
  assert.equal(fromUnknownTab, '/modules/attendance/overview?foo=bar&event=evt-123');

  const backUrl = buildTabBaseUrl({
    currentTab: 'calendar',
    currentPathname: '/modules/attendance/calendar',
    currentSearch: '?foo=bar&event=evt-123',
  });
  assert.equal(backUrl, '/modules/attendance/calendar?foo=bar');
});

