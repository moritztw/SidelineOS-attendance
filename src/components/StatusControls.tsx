import { Check, HelpCircle, PauseCircle, X } from 'lucide-react';
import type { AttendanceStatus, EventCategory, EventTargetCriteria } from '../types.ts';

export const STATUS_META: Record<
  AttendanceStatus,
  {
    labelDe: string;
    labelEn: string;
    activeClass: string;
    textClass: string;
    Icon: typeof Check;
  }
> = {
  PRESENT: {
    labelDe: 'Anwesend',
    labelEn: 'Present',
    activeClass: 'bg-emerald-600 text-white border-emerald-500',
    textClass: 'text-emerald-400',
    Icon: Check,
  },
  INACTIVE: {
    labelDe: 'Inaktiv',
    labelEn: 'Inactive',
    activeClass: 'bg-amber-600 text-white border-amber-500',
    textClass: 'text-amber-400',
    Icon: PauseCircle,
  },
  UNCERTAIN: {
    labelDe: 'Unsicher',
    labelEn: 'Uncertain',
    activeClass: 'bg-slate-600 text-white border-slate-500',
    textClass: 'text-slate-300',
    Icon: HelpCircle,
  },
  ABSENT: {
    labelDe: 'Abwesend',
    labelEn: 'Absent',
    activeClass: 'bg-red-600 text-white border-red-500',
    textClass: 'text-red-400',
    Icon: X,
  },
};

export function formatCategoryLabel(category: EventCategory, locale = 'de'): string {
  const isEn = locale.startsWith('en');
  switch (category) {
    case 'TRAINING':
      return isEn ? 'Practice' : 'Training';
    case 'MEETING':
      return 'Meeting';
    case 'GAME':
      return isEn ? 'Game' : 'Spiel';
    default:
      return isEn ? 'Other' : 'Sonstiges';
  }
}

export function formatEventDateRange(startsAt: string, endsAt: string, locale = 'de'): string {
  const loc = locale.startsWith('en') ? 'en-GB' : 'de-DE';
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return startsAt;

  const datePart = start.toLocaleDateString(loc, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startTime = start.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const endTime = Number.isNaN(end.getTime())
    ? ''
    : end.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return endTime ? `${datePart} · ${startTime}–${endTime}` : `${datePart} · ${startTime}`;
}

export function formatTargetSummary(target: EventTargetCriteria, locale = 'de'): string {
  const isEn = locale.startsWith('en');
  if (target.targetAll) {
    return isEn ? 'Entire Team' : 'Gesamtes Team';
  }
  const parts: string[] = [];
  if (target.targetUnits.length > 0) {
    parts.push(target.targetUnits.join(', '));
  }
  if (target.targetPositions.length > 0) {
    parts.push(target.targetPositions.join(', '));
  }
  if (target.targetRoles.length > 0) {
    parts.push(target.targetRoles.join(', '));
  }
  if (target.targetUserUuids.length > 0) {
    parts.push(
      isEn
        ? `${target.targetUserUuids.length} individual(s)`
        : `${target.targetUserUuids.length} Einzelperson(en)`
    );
  }
  return parts.length > 0 ? parts.join(' · ') : isEn ? 'No target group' : 'Keine Zielgruppe';
}

export function formatDeadlineLabel(deadlineAt: string, locale = 'de'): string {
  const loc = locale.startsWith('en') ? 'en-GB' : 'de-DE';
  const d = new Date(deadlineAt);
  if (Number.isNaN(d.getTime())) return deadlineAt;
  return d.toLocaleString(loc, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StatusSegmentedPicker({
  value,
  disabled,
  busy,
  locale = 'de',
  onSelect,
}: {
  value: AttendanceStatus | null;
  disabled: boolean;
  busy?: boolean;
  locale?: string;
  onSelect: (status: AttendanceStatus) => void;
}) {
  const isEn = locale.startsWith('en');
  const order: AttendanceStatus[] = ['PRESENT', 'INACTIVE', 'UNCERTAIN', 'ABSENT'];

  return (
    <div
      role="group"
      aria-label={isEn ? 'Attendance status' : 'Anwesenheitsstatus'}
      className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
    >
      {order.map((status) => {
        const meta = STATUS_META[status];
        const Icon = meta.Icon;
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled || busy}
            onClick={() => onSelect(status)}
            className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-45 disabled:cursor-not-allowed ${
              selected
                ? meta.activeClass
                : 'border-slate-800 bg-[#0b0e11] text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? meta.labelEn : meta.labelDe}</span>
          </button>
        );
      })}
    </div>
  );
}
