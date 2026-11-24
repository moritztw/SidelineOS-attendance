import type { SpielerUnit } from '@sidelineos/plugin-sdk';
import {
  FOOTBALL_POSITIONS,
  type AttendanceStatus,
  type EventParticipantView,
  type EventTargetCriteria,
  type RosterMember,
} from '../types.ts';

export function normalizePositionTokens(rawPosition: string | undefined | null): string[] {
  if (!rawPosition) return [];
  return rawPosition
    .split(/[/,;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
}

export function collectAvailablePositions(members: RosterMember[]): string[] {
  const known = new Set<string>(FOOTBALL_POSITIONS);
  for (const member of members) {
    for (const token of normalizePositionTokens(member.position)) {
      known.add(token);
    }
  }
  return Array.from(known);
}

export function evaluateMemberInvitation(
  member: RosterMember,
  criteria: EventTargetCriteria
): boolean {
  if (member.status !== 'AKTIV') {
    return false;
  }

  if (criteria.targetAll) {
    return true;
  }

  if (criteria.targetUserUuids.includes(member.userUuid)) {
    return true;
  }

  if (criteria.targetRoles.includes(member.rolle)) {
    return true;
  }

  if (criteria.targetUnits.some((unit) => member.units.includes(unit))) {
    return true;
  }

  if (criteria.targetPositions.length > 0) {
    const wanted = new Set(criteria.targetPositions.map((p) => p.trim().toUpperCase()).filter(Boolean));
    const memberTokens = normalizePositionTokens(member.position);
    if (memberTokens.some((token) => wanted.has(token))) {
      return true;
    }
  }

  return false;
}

export function resolveInvitedUserUuids(
  members: RosterMember[],
  criteria: EventTargetCriteria
): string[] {
  const invited = new Set<string>();
  for (const member of members) {
    if (evaluateMemberInvitation(member, criteria)) {
      invited.add(member.userUuid);
    }
  }
  if (!criteria.targetAll) {
    // Explizit ausgewählte Einzel-UUIDs auch dann erhalten, wenn Roster-Cache noch unvollständig ist
    const knownInactive = new Set(
      members.filter((m) => m.status !== 'AKTIV').map((m) => m.userUuid)
    );
    for (const uuid of criteria.targetUserUuids) {
      if (uuid && !knownInactive.has(uuid)) {
        invited.add(uuid);
      }
    }
  }
  return Array.from(invited);
}

export interface ParticipantFilterOptions {
  unit?: SpielerUnit | 'ALL';
  position?: string | 'ALL';
  status?: AttendanceStatus | 'UNANSWERED' | 'ALL';
  query?: string;
}

export function filterParticipants(
  participants: EventParticipantView[],
  filters: ParticipantFilterOptions
): EventParticipantView[] {
  const normalizedQuery = (filters.query ?? '').trim().toLowerCase();
  const normalizedPos = (filters.position ?? 'ALL').trim().toUpperCase();

  return participants.filter((entry) => {
    if (filters.unit && filters.unit !== 'ALL') {
      if (!entry.member.units.includes(filters.unit)) {
        return false;
      }
    }

    if (normalizedPos && normalizedPos !== 'ALL') {
      const tokens = normalizePositionTokens(entry.member.position);
      if (!tokens.includes(normalizedPos)) {
        return false;
      }
    }

    if (filters.status && filters.status !== 'ALL') {
      if (filters.status === 'UNANSWERED') {
        if (entry.response !== null) return false;
      } else if (entry.response?.status !== filters.status) {
        return false;
      }
    }

    if (normalizedQuery) {
      const jerseyWithHash = entry.member.trikotNummer ? `#${entry.member.trikotNummer}` : '';
      const haystack = `${entry.member.vollerName} ${entry.member.benutzername} ${entry.member.position} ${entry.member.trikotNummer} ${jerseyWithHash}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });
}
