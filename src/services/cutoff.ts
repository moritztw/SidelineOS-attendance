import type { TeamRolle } from '@sidelineos/plugin-sdk';

export interface CutoffEvaluation {
  allowed: boolean;
  lockedForPlayers: boolean;
  deadlineAt: string;
  reason: 'OPEN' | 'STAFF_OVERRIDE' | 'DEADLINE_PASSED' | 'NOT_INVITED';
}

export function getEffectiveCutoffMinutes(
  cutoffMinutesOverride: number | null | undefined,
  defaultCutoffMinutes: number
): number {
  if (typeof cutoffMinutesOverride === 'number' && Number.isFinite(cutoffMinutesOverride) && cutoffMinutesOverride >= 0) {
    return Math.floor(cutoffMinutesOverride);
  }
  return Math.max(0, Math.floor(defaultCutoffMinutes));
}

export function getCutoffDeadlineIso(startsAtIso: string, cutoffMinutes: number): string {
  const startMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startMs)) {
    return startsAtIso;
  }
  const deadlineMs = startMs - Math.max(0, cutoffMinutes) * 60_000;
  return new Date(deadlineMs).toISOString();
}

export function canEditRsvp(params: {
  startsAtIso: string;
  cutoffMinutes: number;
  teamRolle: TeamRolle;
  isInvited: boolean;
  now?: Date;
}): CutoffEvaluation {
  const deadlineAt = getCutoffDeadlineIso(params.startsAtIso, params.cutoffMinutes);
  const deadlineMs = Date.parse(deadlineAt);
  const nowMs = (params.now ?? new Date()).getTime();
  const lockedForPlayers = Number.isFinite(deadlineMs) ? nowMs >= deadlineMs : false;

  if (!params.isInvited && params.teamRolle === 'PLAYER') {
    return {
      allowed: false,
      lockedForPlayers,
      deadlineAt,
      reason: 'NOT_INVITED',
    };
  }

  if (params.teamRolle === 'TEAM_ADMIN' || params.teamRolle === 'COACH') {
    return {
      allowed: true,
      lockedForPlayers,
      deadlineAt,
      reason: lockedForPlayers ? 'STAFF_OVERRIDE' : 'OPEN',
    };
  }

  if (lockedForPlayers) {
    return {
      allowed: false,
      lockedForPlayers: true,
      deadlineAt,
      reason: 'DEADLINE_PASSED',
    };
  }

  return {
    allowed: true,
    lockedForPlayers: false,
    deadlineAt,
    reason: 'OPEN',
  };
}
