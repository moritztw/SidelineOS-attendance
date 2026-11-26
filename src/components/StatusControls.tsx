import {
  CalendarDays,
  Check,
  Dumbbell,
  HelpCircle,
  PauseCircle,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { AttendanceStatus, EventCategory, EventTargetCriteria } from '../types.ts';

export const STATUS_META: Record<
  AttendanceStatus,
  {
    labelDe: string;
    labelEn: string;
    idleClass: string;
    activeClass: string;
    textClass: string;
    badgeClass: string;
    Icon: typeof Check;
  }
> = {
  PRESENT: {
    labelDe: 'Anwesend',
    labelEn: 'Present',
    idleClass:
      'bg-sl-success/10 border-sl-success/40 text-sl-success-text hover:bg-sl-success/20 hover:border-sl-success/70',
    activeClass:
      'bg-sl-success border-sl-success text-white ring-1 ring-sl-success/40',
    textClass: 'text-sl-success-text',
    badgeClass: 'bg-sl-success/15 text-sl-success-text border border-sl-success/35',
    Icon: Check,
  },
  INACTIVE: {
    labelDe: 'Inaktiv',
    labelEn: 'Inactive',
    idleClass:
      'bg-sl-elevated/60 border-sl-border-strong text-sl-primary hover:bg-sl-elevated hover:text-sl-heading',
    activeClass:
      'bg-sl-elevated border-sl-heading/70 text-sl-heading ring-1 ring-sl-heading/30',
    textClass: 'text-sl-primary',
    badgeClass: 'bg-sl-elevated text-sl-primary border border-sl-border-strong',
    Icon: PauseCircle,
  },
  UNCERTAIN: {
    labelDe: 'Unsicher',
    labelEn: 'Uncertain',
    idleClass:
      'bg-sl-warning-text/10 border-sl-warning-text/40 text-sl-warning-text hover:bg-sl-warning-text/20 hover:border-sl-warning-text/75',
    activeClass:
      'bg-sl-warning-text/25 border-sl-warning-text text-sl-warning-text ring-1 ring-sl-warning-text/50',
    textClass: 'text-sl-warning-text',
    badgeClass: 'bg-sl-warning-text/15 text-sl-warning-text border border-sl-warning-text/35',
    Icon: HelpCircle,
  },
  ABSENT: {
    labelDe: 'Abwesend',
    labelEn: 'Absent',
    idleClass:
      'bg-sl-danger/10 border-sl-danger/40 text-sl-danger-text hover:bg-sl-danger/20 hover:border-sl-danger/70',
    activeClass:
      'bg-sl-danger border-sl-danger text-white ring-1 ring-sl-danger/40',
    textClass: 'text-sl-danger-text',
    badgeClass: 'bg-sl-danger/15 text-sl-danger-text border border-sl-danger/35',
    Icon: X,
  },
};

export const CATEGORY_META: Record<
  EventCategory,
  {
    Icon: typeof Dumbbell;
    tileClass: string;
  }
> = {
  TRAINING: {
    Icon: Dumbbell,
    tileClass: 'bg-sl-success/12 text-sl-success-text border-sl-success/25',
  },
  GAME: {
    Icon: Trophy,
    tileClass: 'bg-sl-accent/15 text-sl-accent border-sl-accent/30',
  },
  MEETING: {
    Icon: Users,
    tileClass: 'bg-sl-elevated text-sl-primary border-sl-border-strong',
  },
  OTHER: {
    Icon: CalendarDays,
    tileClass: 'bg-sl-elevated text-sl-muted border-sl-border',
  },
};

export function CategoryIconBadge({
  category,
  size = 'md',
}: {
  category: EventCategory;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.OTHER;
  const Icon = meta.Icon;

  const boxClasses =
    size === 'xs'
      ? 'w-5 h-5 rounded-md'
      : size === 'sm'
        ? 'w-8 h-8 rounded-lg'
        : size === 'lg'
          ? 'w-12 h-12 rounded-xl'
          : 'w-10 h-10 rounded-xl';

  const iconClasses =
    size === 'xs'
      ? 'w-3 h-3'
      : size === 'sm'
        ? 'w-4 h-4'
        : size === 'lg'
          ? 'w-6 h-6'
          : 'w-5 h-5';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center border shrink-0 ${boxClasses} ${meta.tileClass}`}
    >
      <Icon className={iconClasses} />
    </span>
  );
}

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

export function formatEventDateOnly(startsAt: string, locale = 'de'): string {
  const loc = locale.startsWith('en') ? 'en-GB' : 'de-DE';
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  return start.toLocaleDateString(loc, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatEventTimeRange(startsAt: string, endsAt: string, locale = 'de'): string {
  const loc = locale.startsWith('en') ? 'en-GB' : 'de-DE';
  const isEn = locale.startsWith('en');
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime())) return '';
  const startTime = start.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const endTime = Number.isNaN(end.getTime())
    ? ''
    : end.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const suffix = isEn ? '' : ' Uhr';
  return endTime ? `${startTime} – ${endTime}${suffix}` : `${startTime}${suffix}`;
}

export function formatEventDateRange(startsAt: string, endsAt: string, locale = 'de'): string {
  const datePart = formatEventDateOnly(startsAt, locale);
  const timePart = formatEventTimeRange(startsAt, endsAt, locale);
  return timePart ? `${datePart} · ${timePart}` : datePart;
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
  const isEn = locale.startsWith('en');
  const d = new Date(deadlineAt);
  if (Number.isNaN(d.getTime())) return deadlineAt;
  const formatted = d.toLocaleString(loc, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return isEn ? formatted : `${formatted} Uhr`;
}

export function StatusSegmentedPicker({
  value,
  disabled,
  busy,
  size = 'lg',
  locale = 'de',
  onSelect,
}: {
  value: AttendanceStatus | null;
  disabled: boolean;
  busy?: boolean;
  size?: 'sm' | 'lg';
  locale?: string;
  onSelect: (status: AttendanceStatus) => void;
}) {
  const isEn = locale.startsWith('en');
  const order: AttendanceStatus[] = ['PRESENT', 'INACTIVE', 'UNCERTAIN', 'ABSENT'];
  const isSmall = size === 'sm';

  return (
    <div
      role="group"
      aria-label={isEn ? 'Attendance status' : 'Anwesenheitsstatus'}
      className={isSmall ? 'grid grid-cols-4 gap-1.5' : 'grid grid-cols-2 sm:grid-cols-4 gap-2.5'}
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
            aria-pressed={selected}
            onClick={() => onSelect(status)}
            className={`border font-medium inline-flex flex-col items-center justify-center transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sl-accent disabled:opacity-45 disabled:cursor-not-allowed ${
              isSmall
                ? 'min-h-[54px] px-2.5 py-2 rounded-lg gap-1 text-[11px]'
                : 'min-h-[78px] px-3 py-3 rounded-xl gap-2 text-xs'
            } ${selected ? meta.activeClass : meta.idleClass}`}
          >
            <Icon className={isSmall ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0'} />
            <span>{isEn ? meta.labelEn : meta.labelDe}</span>
          </button>
        );
      })}
    </div>
  );
}
