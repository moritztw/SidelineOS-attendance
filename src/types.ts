import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';

export type AttendanceStatus = 'PRESENT' | 'INACTIVE' | 'UNCERTAIN' | 'ABSENT';
export type CheckInStatus = 'PRESENT' | 'INACTIVE' | 'ABSENT';
export type EventCategory = 'TRAINING' | 'MEETING' | 'GAME' | 'OTHER';
export type NonInvitedVisibility = 'TRANSPARENT' | 'HIDDEN';
export type ResponseVisibility = 'TEAM' | 'STAFF_ONLY';
export type ResponseSource = 'MANUAL' | 'LONG_TERM_ABSENCE';
export type AbsenceReasonType = 'VACATION' | 'INJURY' | 'PERSONAL';
export type AttachmentKind = 'LINK' | 'CORE_ATTACHMENT';
export type RecurrenceKind = 'NONE' | 'WEEKLY' | 'BIWEEKLY';

export const FOOTBALL_POSITIONS: readonly string[] = [
  'QB',
  'RB',
  'FB',
  'WR',
  'TE',
  'OL',
  'OT',
  'OG',
  'C',
  'DL',
  'DE',
  'DT',
  'NT',
  'LB',
  'ILB',
  'OLB',
  'DB',
  'CB',
  'S',
  'K',
  'P',
  'LS',
  'ATH',
];

export interface RosterMember {
  userUuid: string;
  vollerName: string;
  benutzername: string;
  rolle: TeamRolle;
  units: SpielerUnit[];
  position: string;
  trikotNummer: string;
  status: 'AKTIV' | 'WARTET_AUF_FREIGABE';
}

export interface TeamAttendanceSettings {
  teamId: string;
  nonInvitedVisibility: NonInvitedVisibility;
  responseVisibility: ResponseVisibility;
  defaultCutoffMinutes: number;
  liveCheckinEnabled: boolean;
  reminderHoursBefore: number;
  updatedAt?: string;
}

export interface UserAttendanceSettings {
  teamId: string;
  userUuid: string;
  notifyOnInvite: boolean;
  notifyBeforeCutoff: boolean;
  updatedAt?: string;
}

export interface EventTargetCriteria {
  targetAll: boolean;
  targetUnits: SpielerUnit[];
  targetPositions: string[];
  targetRoles: TeamRolle[];
  targetUserUuids: string[];
}

export interface EventAttachment {
  id: string;
  eventId: string;
  teamId: string;
  kind: AttachmentKind;
  title: string;
  url: string;
  coreAttachmentId: string | null;
  mimeType: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * Vorbereitete Adapter-Schnittstelle für das kommende Core-SDK-Attachment-Modul.
 * Ermöglicht sofortige Link-Anhänge und nahtlose Erweiterung um Core-Datei-Uploads.
 */
export interface CoreAttachmentBridgeAdapter {
  readonly isCoreAttachmentModuleAvailable: boolean;
  listForEvent(eventId: string): Promise<EventAttachment[]>;
  addLink(eventId: string, input: { title: string; url: string }): Promise<EventAttachment>;
  attachCoreReference?(
    eventId: string,
    input: { coreAttachmentId: string; title: string; mimeType?: string }
  ): Promise<EventAttachment>;
  remove(eventId: string, attachmentId: string): Promise<void>;
}

export interface AttendanceEvent extends EventTargetCriteria {
  id: string;
  teamId: string;
  season: string;
  seriesId: string | null;
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  startsAt: string;
  endsAt: string;
  cutoffMinutesOverride: number | null;
  invitedUserUuids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceResponse {
  eventId: string;
  teamId: string;
  userUuid: string;
  status: AttendanceStatus;
  comment: string;
  source: ResponseSource;
  absenceId: string | null;
  manualOverride: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceCheckIn {
  eventId: string;
  teamId: string;
  userUuid: string;
  actualStatus: CheckInStatus;
  note: string;
  checkedBy: string;
  checkedAt: string;
}

export interface LongTermAbsence {
  id: string;
  teamId: string;
  userUuid: string;
  reasonType: AbsenceReasonType;
  reasonText: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
}

export interface EventSummaryView extends AttendanceEvent {
  isInvited: boolean;
  canRespond: boolean;
  effectiveCutoffMinutes: number;
  cutoffDeadlineAt: string;
  isCutoffLockedForPlayers: boolean;
  myResponse: AttendanceResponse | null;
  counts: {
    invited: number;
    present: number;
    inactive: number;
    uncertain: number;
    absent: number;
    unanswered: number;
  };
  attachmentCount: number;
}

export interface EventParticipantView {
  member: RosterMember;
  response: AttendanceResponse | null;
  checkin: AttendanceCheckIn | null;
}

export interface EventDetailView {
  event: EventSummaryView;
  attachments: EventAttachment[];
  participants: EventParticipantView[];
  responsesHiddenForRole: boolean;
}

export interface PlayerAttendanceStat {
  userUuid: string;
  vollerName: string;
  trikotNummer: string;
  position: string;
  units: SpielerUnit[];
  rolle: TeamRolle;
  invitedCount: number;
  presentCount: number;
  inactiveCount: number;
  uncertainCount: number;
  absentCount: number;
  unansweredCount: number;
  attendanceRatePercent: number;
  activeOrSidelineRatePercent: number;
  checkinTotal: number;
  checkinPresentCount: number;
  checkinInactiveCount: number;
  checkinAbsentCount: number;
}

export interface GroupAttendanceStat {
  groupKey: string;
  groupType: 'UNIT' | 'POSITION';
  memberCount: number;
  invitedSlots: number;
  presentSlots: number;
  inactiveSlots: number;
  absentSlots: number;
  attendanceRatePercent: number;
}

export interface StatsReport {
  fromIso: string | null;
  toIso: string | null;
  totalEventsEvaluated: number;
  players: PlayerAttendanceStat[];
  byUnit: GroupAttendanceStat[];
  byPosition: GroupAttendanceStat[];
}

export interface ReminderLogEntry {
  eventId: string;
  userUuid: string;
  reminderKind: string;
  sentAt: string;
}
