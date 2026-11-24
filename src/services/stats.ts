import type { SpielerUnit } from '@sidelineos/plugin-sdk';
import type {
  AttendanceCheckIn,
  AttendanceEvent,
  AttendanceResponse,
  GroupAttendanceStat,
  PlayerAttendanceStat,
  RosterMember,
  StatsReport,
} from '../types.ts';
import { normalizePositionTokens } from './targeting.ts';

function roundRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function calculateStatsReport(params: {
  events: AttendanceEvent[];
  responses: AttendanceResponse[];
  checkins: AttendanceCheckIn[];
  roster: RosterMember[];
  fromIso?: string | null;
  toIso?: string | null;
}): StatsReport {
  const fromMs = params.fromIso ? Date.parse(params.fromIso) : null;
  const toMs = params.toIso ? Date.parse(params.toIso) : null;

  const filteredEvents = params.events.filter((ev) => {
    const startMs = Date.parse(ev.startsAt);
    if (!Number.isFinite(startMs)) return false;
    if (fromMs !== null && Number.isFinite(fromMs) && startMs < fromMs) return false;
    if (toMs !== null && Number.isFinite(toMs) && startMs > toMs) return false;
    return true;
  });

  const eventIds = new Set(filteredEvents.map((e) => e.id));
  const responseMap = new Map<string, AttendanceResponse>();
  for (const r of params.responses) {
    if (eventIds.has(r.eventId)) {
      responseMap.set(`${r.eventId}::${r.userUuid}`, r);
    }
  }

  const checkinMap = new Map<string, AttendanceCheckIn>();
  for (const c of params.checkins) {
    if (eventIds.has(c.eventId)) {
      checkinMap.set(`${c.eventId}::${c.userUuid}`, c);
    }
  }

  const activeRoster = params.roster.filter((m) => m.status === 'AKTIV');

  const players: PlayerAttendanceStat[] = activeRoster.map((member) => {
    let invitedCount = 0;
    let presentCount = 0;
    let inactiveCount = 0;
    let uncertainCount = 0;
    let absentCount = 0;
    let unansweredCount = 0;
    let checkinTotal = 0;
    let checkinPresentCount = 0;
    let checkinInactiveCount = 0;
    let checkinAbsentCount = 0;

    for (const ev of filteredEvents) {
      if (!ev.invitedUserUuids.includes(member.userUuid)) {
        continue;
      }
      invitedCount += 1;

      const resp = responseMap.get(`${ev.id}::${member.userUuid}`);
      if (!resp) {
        unansweredCount += 1;
      } else if (resp.status === 'PRESENT') {
        presentCount += 1;
      } else if (resp.status === 'INACTIVE') {
        inactiveCount += 1;
      } else if (resp.status === 'UNCERTAIN') {
        uncertainCount += 1;
      } else if (resp.status === 'ABSENT') {
        absentCount += 1;
      }

      const ci = checkinMap.get(`${ev.id}::${member.userUuid}`);
      if (ci) {
        checkinTotal += 1;
        if (ci.actualStatus === 'PRESENT') checkinPresentCount += 1;
        else if (ci.actualStatus === 'INACTIVE') checkinInactiveCount += 1;
        else if (ci.actualStatus === 'ABSENT') checkinAbsentCount += 1;
      }
    }

    return {
      userUuid: member.userUuid,
      vollerName: member.vollerName,
      trikotNummer: member.trikotNummer,
      position: member.position,
      units: member.units,
      rolle: member.rolle,
      invitedCount,
      presentCount,
      inactiveCount,
      uncertainCount,
      absentCount,
      unansweredCount,
      attendanceRatePercent: roundRate(presentCount, invitedCount),
      activeOrSidelineRatePercent: roundRate(presentCount + inactiveCount, invitedCount),
      checkinTotal,
      checkinPresentCount,
      checkinInactiveCount,
      checkinAbsentCount,
    };
  });

  players.sort((a, b) => b.attendanceRatePercent - a.attendanceRatePercent || a.vollerName.localeCompare(b.vollerName));

  const unitKeys: SpielerUnit[] = ['OFFENSE', 'DEFENSE', 'SPECIAL_TEAMS'];
  const byUnit: GroupAttendanceStat[] = unitKeys.map((unitKey) => {
    const groupPlayers = players.filter((p) => p.units.includes(unitKey));
    const invitedSlots = groupPlayers.reduce((sum, p) => sum + p.invitedCount, 0);
    const presentSlots = groupPlayers.reduce((sum, p) => sum + p.presentCount, 0);
    const inactiveSlots = groupPlayers.reduce((sum, p) => sum + p.inactiveCount, 0);
    const absentSlots = groupPlayers.reduce((sum, p) => sum + p.absentCount, 0);
    return {
      groupKey: unitKey,
      groupType: 'UNIT',
      memberCount: groupPlayers.length,
      invitedSlots,
      presentSlots,
      inactiveSlots,
      absentSlots,
      attendanceRatePercent: roundRate(presentSlots, invitedSlots),
    };
  });

  const positionBuckets = new Map<string, PlayerAttendanceStat[]>();
  for (const player of players) {
    const tokens = normalizePositionTokens(player.position);
    const keys = tokens.length > 0 ? tokens : ['OHNE_POSITION'];
    for (const pos of keys) {
      const existing = positionBuckets.get(pos) ?? [];
      existing.push(player);
      positionBuckets.set(pos, existing);
    }
  }

  const byPosition: GroupAttendanceStat[] = Array.from(positionBuckets.entries())
    .map(([posKey, groupPlayers]) => {
      const invitedSlots = groupPlayers.reduce((sum, p) => sum + p.invitedCount, 0);
      const presentSlots = groupPlayers.reduce((sum, p) => sum + p.presentCount, 0);
      const inactiveSlots = groupPlayers.reduce((sum, p) => sum + p.inactiveCount, 0);
      const absentSlots = groupPlayers.reduce((sum, p) => sum + p.absentCount, 0);
      return {
        groupKey: posKey,
        groupType: 'POSITION' as const,
        memberCount: groupPlayers.length,
        invitedSlots,
        presentSlots,
        inactiveSlots,
        absentSlots,
        attendanceRatePercent: roundRate(presentSlots, invitedSlots),
      };
    })
    .sort((a, b) => b.attendanceRatePercent - a.attendanceRatePercent || a.groupKey.localeCompare(b.groupKey));

  return {
    fromIso: params.fromIso ?? null,
    toIso: params.toIso ?? null,
    totalEventsEvaluated: filteredEvents.length,
    players,
    byUnit,
    byPosition,
  };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildStatsCsv(players: PlayerAttendanceStat[]): string {
  const header = [
    'Name',
    'Nummer',
    'Position',
    'Units',
    'Rolle',
    'Eingeladen',
    'Anwesend',
    'Inaktiv',
    'Unsicher',
    'Abwesend',
    'Offen',
    'Quote_Prozent',
    'Praesenz_Inkl_Inaktiv_Prozent',
    'CheckIn_Erfasst',
    'CheckIn_Anwesend',
  ];

  const rows = players.map((p) =>
    [
      p.vollerName,
      p.trikotNummer,
      p.position,
      p.units.join('|'),
      p.rolle,
      p.invitedCount,
      p.presentCount,
      p.inactiveCount,
      p.uncertainCount,
      p.absentCount,
      p.unansweredCount,
      p.attendanceRatePercent.toFixed(1),
      p.activeOrSidelineRatePercent.toFixed(1),
      p.checkinTotal,
      p.checkinPresentCount,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [header.join(','), ...rows].join('\n');
}
