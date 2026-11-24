import type { SpielerUnit, TeamRolle } from '@sidelineos/plugin-sdk';
import type {
  AbsenceReasonType,
  AttendanceCheckIn,
  AttendanceResponse,
  AttendanceStatus,
  CheckInStatus,
  CoreAttachmentBridgeAdapter,
  EventAttachment,
  EventCategory,
  EventDetailView,
  EventSummaryView,
  LongTermAbsence,
  NonInvitedVisibility,
  RecurrenceKind,
  ResponseVisibility,
  RosterMember,
  StatsReport,
  TeamAttendanceSettings,
  UserAttendanceSettings,
} from '../types.ts';

const PLUGIN_ID = 'attendance';

export async function pluginApi<T>(
  teamId: string,
  pfad: string,
  init: RequestInit = {}
): Promise<T> {
  const cleanPath = pfad.startsWith('/') ? pfad : `/${pfad}`;
  const res = await fetch(`/api/v1/plugins/${PLUGIN_ID}/teams/${encodeURIComponent(teamId)}${cleanPath}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { fehler?: string };
    throw new Error(body.fehler ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface CoreMemberResponseItem {
  membership: {
    userUuid: string;
    rolle: TeamRolle;
    status: 'AKTIV' | 'WARTET_AUF_FREIGABE';
    units: SpielerUnit[];
  };
  user: {
    uuid: string;
    benutzername: string;
    vollerName: string;
    trikotNummer?: string;
    position?: string;
  } | null;
}

export async function fetchCoreTeamRoster(teamId: string): Promise<RosterMember[]> {
  const res = await fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/members`, {
    credentials: 'include',
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as { members?: CoreMemberResponseItem[] };
  const rows = Array.isArray(data.members) ? data.members : [];
  return rows
    .filter((item) => item.user !== null)
    .map((item) => ({
      userUuid: item.membership.userUuid,
      vollerName: item.user!.vollerName,
      benutzername: item.user!.benutzername,
      rolle: item.membership.rolle,
      units: item.membership.units?.length ? item.membership.units : ['OFFENSE'],
      position: item.user!.position ?? '',
      trikotNummer: item.user!.trikotNummer ?? '',
      status: item.membership.status,
    }));
}

export async function syncRosterWithPlugin(teamId: string, members: RosterMember[]): Promise<void> {
  if (members.length === 0) return;
  await pluginApi(teamId, '/roster-sync', {
    method: 'POST',
    body: JSON.stringify({ members }),
  });
}

export interface BootstrapPayload {
  settings: TeamAttendanceSettings;
  userSettings: UserAttendanceSettings;
  events: EventSummaryView[];
  absences: LongTermAbsence[];
  roster: RosterMember[];
}

export function fetchBootstrap(teamId: string, season: string): Promise<BootstrapPayload> {
  return pluginApi<BootstrapPayload>(
    teamId,
    `/bootstrap?season=${encodeURIComponent(season)}`
  );
}

export function fetchEventDetail(teamId: string, eventId: string): Promise<EventDetailView> {
  return pluginApi<EventDetailView>(teamId, `/events/${encodeURIComponent(eventId)}`);
}

export interface SaveEventPayload {
  title: string;
  description: string;
  category: EventCategory;
  location: string;
  season: string;
  startsAt: string;
  endsAt: string;
  cutoffMinutesOverride: number | null;
  targetAll: boolean;
  targetUnits: SpielerUnit[];
  targetPositions: string[];
  targetRoles: TeamRolle[];
  targetUserUuids: string[];
  recurrenceKind?: RecurrenceKind;
  untilDate?: string;
  attachments?: Array<{ title: string; url: string }>;
}

export function createEvent(
  teamId: string,
  payload: SaveEventPayload
): Promise<{ eventIds: string[]; seriesId: string | null; count: number }> {
  return pluginApi(teamId, '/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateEvent(
  teamId: string,
  eventId: string,
  payload: Partial<SaveEventPayload>
): Promise<{ ok: boolean }> {
  return pluginApi(teamId, `/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteEvent(
  teamId: string,
  eventId: string,
  scope: 'single' | 'series' = 'single'
): Promise<{ ok: boolean }> {
  return pluginApi(
    teamId,
    `/events/${encodeURIComponent(eventId)}?scope=${encodeURIComponent(scope)}`,
    { method: 'DELETE' }
  );
}

export function submitRsvp(
  teamId: string,
  eventId: string,
  payload: { status: AttendanceStatus; comment: string; targetUserUuid?: string }
): Promise<{ ok: boolean; response: AttendanceResponse }> {
  return pluginApi(teamId, `/events/${encodeURIComponent(eventId)}/rsvp`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function saveCheckIn(
  teamId: string,
  eventId: string,
  payload: { userUuid: string; actualStatus: CheckInStatus; note?: string }
): Promise<{ checkin: AttendanceCheckIn }> {
  return pluginApi(teamId, `/events/${encodeURIComponent(eventId)}/checkins`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function createAbsence(
  teamId: string,
  payload: {
    reasonType: AbsenceReasonType;
    reasonText: string;
    startsOn: string;
    endsOn: string;
    targetUserUuid?: string;
  }
): Promise<{ absence: LongTermAbsence; autoUpdatedEvents: number }> {
  return pluginApi(teamId, '/absences', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAbsence(teamId: string, absenceId: string): Promise<{ ok: boolean }> {
  return pluginApi(teamId, `/absences/${encodeURIComponent(absenceId)}`, {
    method: 'DELETE',
  });
}

export function fetchStatsReport(
  teamId: string,
  params: { season: string; from?: string; to?: string }
): Promise<StatsReport> {
  const qs = new URLSearchParams({ season: params.season });
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return pluginApi<StatsReport>(teamId, `/stats?${qs.toString()}`);
}

export function fetchStatsCsvExport(
  teamId: string,
  params: { season: string; from?: string; to?: string }
): Promise<{ filename: string; csv: string }> {
  const qs = new URLSearchParams({ season: params.season });
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return pluginApi(teamId, `/stats/export?${qs.toString()}`);
}

export function fetchAttendanceSettings(
  teamId: string
): Promise<{ settings: TeamAttendanceSettings; userSettings: UserAttendanceSettings }> {
  return pluginApi(teamId, '/settings');
}

export function updateTeamSettings(
  teamId: string,
  payload: {
    nonInvitedVisibility: NonInvitedVisibility;
    responseVisibility: ResponseVisibility;
    defaultCutoffMinutes: number;
    liveCheckinEnabled: boolean;
    reminderHoursBefore: number;
  }
): Promise<{ settings: TeamAttendanceSettings }> {
  return pluginApi(teamId, '/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateUserSettings(
  teamId: string,
  payload: { notifyOnInvite: boolean; notifyBeforeCutoff: boolean }
): Promise<{ userSettings: UserAttendanceSettings }> {
  return pluginApi(teamId, '/settings/user', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function triggerDueReminders(
  teamId: string
): Promise<{ batchesSent: number; recipientsNotified: number }> {
  return pluginApi(teamId, '/reminders/dispatch', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Erzeugt die vorbereitete Attachment-Adapter-Instanz für ein Team.
 * Sobald SidelineOS-Core das zentrale Attachment-Modul im SDK bereitstellt,
 * wird `isCoreAttachmentModuleAvailable` aktiviert und `attachCoreReference` angebunden.
 */
export function createEventAttachmentAdapter(teamId: string): CoreAttachmentBridgeAdapter {
  return {
    isCoreAttachmentModuleAvailable: false,
    async listForEvent(eventId: string): Promise<EventAttachment[]> {
      const detail = await fetchEventDetail(teamId, eventId);
      return detail.attachments;
    },
    async addLink(eventId: string, input: { title: string; url: string }): Promise<EventAttachment> {
      const res = await pluginApi<{ attachment: EventAttachment }>(
        teamId,
        `/events/${encodeURIComponent(eventId)}/attachments`,
        {
          method: 'POST',
          body: JSON.stringify({ kind: 'LINK', title: input.title, url: input.url }),
        }
      );
      return res.attachment;
    },
    async attachCoreReference(
      eventId: string,
      input: { coreAttachmentId: string; title: string; mimeType?: string }
    ): Promise<EventAttachment> {
      const res = await pluginApi<{ attachment: EventAttachment }>(
        teamId,
        `/events/${encodeURIComponent(eventId)}/attachments`,
        {
          method: 'POST',
          body: JSON.stringify({
            kind: 'CORE_ATTACHMENT',
            title: input.title,
            coreAttachmentId: input.coreAttachmentId,
            mimeType: input.mimeType,
          }),
        }
      );
      return res.attachment;
    },
    async remove(eventId: string, attachmentId: string): Promise<void> {
      await pluginApi(
        teamId,
        `/events/${encodeURIComponent(eventId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE' }
      );
    },
  };
}
