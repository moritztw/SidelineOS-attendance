import type { RecurrenceKind } from '../types.ts';

export interface OccurrenceSlot {
  startsAt: string;
  endsAt: string;
}

const MAX_OCCURRENCES = 52;

export function generateSeriesOccurrences(params: {
  startsAtIso: string;
  endsAtIso: string;
  recurrenceKind: RecurrenceKind;
  untilDate?: string;
}): OccurrenceSlot[] {
  const startMs = Date.parse(params.startsAtIso);
  const endMs = Date.parse(params.endsAtIso);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('Ungültiger Terminzeitraum: Endzeit muss nach Startzeit liegen.');
  }

  const durationMs = endMs - startMs;

  if (params.recurrenceKind === 'NONE' || !params.untilDate) {
    return [
      {
        startsAt: new Date(startMs).toISOString(),
        endsAt: new Date(endMs).toISOString(),
      },
    ];
  }

  const untilMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.untilDate.trim());
  if (!untilMatch) {
    throw new Error('Enddatum der Serie muss im Format JJJJ-MM-TT angegeben werden.');
  }

  const untilEndMs = Date.UTC(
    Number(untilMatch[1]),
    Number(untilMatch[2]) - 1,
    Number(untilMatch[3]),
    23,
    59,
    59,
    999
  );

  if (untilEndMs < startMs) {
    throw new Error('Das Enddatum der Serie darf nicht vor dem ersten Termin liegen.');
  }

  const stepDays = params.recurrenceKind === 'BIWEEKLY' ? 14 : 7;
  const stepMs = stepDays * 24 * 60 * 60 * 1000;
  const slots: OccurrenceSlot[] = [];

  for (let i = 0; i < MAX_OCCURRENCES; i += 1) {
    const currentStart = startMs + i * stepMs;
    if (currentStart > untilEndMs) {
      break;
    }
    slots.push({
      startsAt: new Date(currentStart).toISOString(),
      endsAt: new Date(currentStart + durationMs).toISOString(),
    });
  }

  return slots;
}
