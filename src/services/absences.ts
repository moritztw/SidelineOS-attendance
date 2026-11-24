import type { LongTermAbsence } from '../types.ts';

export function extractDateKey(isoTimestamp: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) {
    return isoTimestamp.slice(0, 10);
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

export function isValidIsoDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed);
}

export function doesEventOverlapAbsence(
  eventStartsAtIso: string,
  absence: Pick<LongTermAbsence, 'startsOn' | 'endsOn'>
): boolean {
  const eventDay = extractDateKey(eventStartsAtIso);
  return absence.startsOn <= eventDay && eventDay <= absence.endsOn;
}

export function findMatchingAbsenceForEvent(
  eventStartsAtIso: string,
  absences: LongTermAbsence[]
): LongTermAbsence | null {
  for (const absence of absences) {
    if (doesEventOverlapAbsence(eventStartsAtIso, absence)) {
      return absence;
    }
  }
  return null;
}
